import 'server-only';
import type { AiEvent, AiMessage, AiModel, AiRequest } from '@n3wtou/mnml-cms/next';

// Model adapters for the admin assistant (`ai: { model }` in createCms). The package has no provider code: an
// adapter is one `stream()` over a provider's HTTP API. Copy the one you use, or write your own the same way.

/** The `data:` payloads of a server-sent-events response. */
async function* sse(res: Response, signal?: AbortSignal): AsyncGenerator<string> {
  if (!res.ok || !res.body) throw new Error(`Model request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    if (signal?.aborted) return;
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) if (line.startsWith('data:')) yield line.slice(5).trim();
  }
}

const parse = (s: string): Record<string, unknown> => {
  try {
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
};

/** Claude, over the Messages API. */
export function anthropicModel({ apiKey, model = 'claude-sonnet-5-5' }: { apiKey: string; model?: string }): AiModel {
  const toMessages = (messages: AiMessage[]) =>
    messages.map((m) =>
      m.role === 'tool'
        ? { role: 'user', content: [{ type: 'tool_result', tool_use_id: m.id, content: m.content }] }
        : m.role === 'assistant' && m.toolCalls?.length
          ? {
              role: 'assistant',
              content: [
                ...(m.content ? [{ type: 'text', text: m.content }] : []),
                ...m.toolCalls.map((c) => ({ type: 'tool_use', id: c.id, name: c.name, input: c.args })),
              ],
            }
          : { role: m.role, content: m.content },
    );
  return {
    async *stream({ system, messages, tools, signal }: AiRequest): AsyncGenerator<AiEvent> {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal,
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          stream: true,
          system,
          messages: toMessages(messages),
          tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
        }),
      });
      let call: { id: string; name: string; json: string } | null = null;
      for await (const data of sse(res, signal)) {
        const e = parse(data) as {
          type?: string;
          content_block?: { type: string; id: string; name: string };
          delta?: { type: string; text?: string; partial_json?: string };
        };
        if (e.type === 'content_block_start' && e.content_block?.type === 'tool_use') call = { id: e.content_block.id, name: e.content_block.name, json: '' };
        else if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta') yield { type: 'text', text: e.delta.text ?? '' };
        else if (e.type === 'content_block_delta' && e.delta?.type === 'input_json_delta' && call) call.json += e.delta.partial_json ?? '';
        else if (e.type === 'content_block_stop' && call) {
          yield { type: 'tool_call', id: call.id, name: call.name, args: parse(call.json) };
          call = null;
        }
      }
    },
  };
}

/** OpenAI (or anything that speaks its Chat Completions API: set `baseUrl`). */
export function openaiModel({
  apiKey,
  model = 'gpt-4.1',
  baseUrl = 'https://api.openai.com/v1',
}: {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}): AiModel {
  const toMessages = (system: string, messages: AiMessage[]) => [
    { role: 'system', content: system },
    ...messages.map((m) =>
      m.role === 'tool'
        ? { role: 'tool', tool_call_id: m.id, content: m.content }
        : m.role === 'assistant' && m.toolCalls?.length
          ? {
              role: 'assistant',
              content: m.content || null,
              tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })),
            }
          : { role: m.role, content: m.content },
    ),
  ];
  return {
    async *stream({ system, messages, tools, signal }: AiRequest): AsyncGenerator<AiEvent> {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal,
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: true,
          messages: toMessages(system, messages),
          tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
        }),
      });
      // Tool calls arrive in pieces, keyed by index.
      const calls = new Map<number, { id: string; name: string; json: string }>();
      for await (const data of sse(res, signal)) {
        if (data === '[DONE]') break;
        const delta = (
          parse(data) as {
            choices?: { delta?: { content?: string; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] } }[];
          }
        ).choices?.[0]?.delta;
        if (delta?.content) yield { type: 'text', text: delta.content };
        for (const c of delta?.tool_calls ?? []) {
          const have = calls.get(c.index) ?? { id: '', name: '', json: '' };
          calls.set(c.index, { id: c.id ?? have.id, name: c.function?.name ?? have.name, json: have.json + (c.function?.arguments ?? '') });
        }
      }
      for (const c of calls.values()) yield { type: 'tool_call', id: c.id, name: c.name, args: parse(c.json) };
    },
  };
}

/** Gemini, over the Generative Language API. */
export function geminiModel({ apiKey, model = 'gemini-2.5-flash' }: { apiKey: string; model?: string }): AiModel {
  const toContents = (messages: AiMessage[]) =>
    messages.map((m) =>
      m.role === 'tool'
        ? { role: 'user', parts: [{ functionResponse: { name: m.name, response: { result: parse(m.content) } } }] }
        : {
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [
              ...(m.content ? [{ text: m.content }] : []),
              ...(m.role === 'assistant' ? (m.toolCalls ?? []).map((c) => ({ functionCall: { name: c.name, args: c.args } })) : []),
            ],
          },
    );
  return {
    async *stream({ system, messages, tools, signal }: AiRequest): AsyncGenerator<AiEvent> {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        signal,
        headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: toContents(messages),
          tools: [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.parameters })) }],
        }),
      });
      let n = 0;
      for await (const data of sse(res, signal)) {
        const parts = (
          parse(data) as { candidates?: { content?: { parts?: { text?: string; functionCall?: { name: string; args?: Record<string, unknown> } }[] } }[] }
        ).candidates?.[0]?.content?.parts;
        for (const p of parts ?? []) {
          if (p.text) yield { type: 'text', text: p.text };
          if (p.functionCall) yield { type: 'tool_call', id: `call-${n++}`, name: p.functionCall.name, args: p.functionCall.args ?? {} };
        }
      }
    },
  };
}

/** The adapter for whichever provider key is set, or undefined (the assistant stays off). */
export function modelFromEnv(): AiModel | undefined {
  const { ANTHROPIC_API_KEY, OPENAI_API_KEY } = process.env;
  const GEMINI_KEY = process.env.GEMINI_KEY ?? process.env.GEMINI_API_KEY;
  if (ANTHROPIC_API_KEY) return anthropicModel({ apiKey: ANTHROPIC_API_KEY });
  if (OPENAI_API_KEY) return openaiModel({ apiKey: OPENAI_API_KEY });
  if (GEMINI_KEY) return geminiModel({ apiKey: GEMINI_KEY });
}
