import 'server-only';
import { isStepCount, streamText, type ModelMessage, type ToolSet } from 'ai';
import type { AssistantEvent, AssistantFill, AssistantTurn } from '../../api.js';
import { fillTools, readTools, RESERVED, statusOf } from './tools.js';
import { systemPrompt, withValues } from './prompt.js';
import type { Fill } from './fill.js';
import type { AssistantEngine, AssistantOptions } from './types.js';

/** A tool's input as it is recorded: cut when long, so a record stays small. */
const brief = (input: unknown) => {
  const text = JSON.stringify(input) ?? '';
  return text.length > 2000 ? `${text.slice(0, 2000)}…` : input;
};

const modelName = (m: AssistantOptions['model']) => (typeof m === 'string' ? m : `${m.provider ?? ''}/${m.modelId ?? ''}`.replace(/^\//, ''));

const FILL = ['fill_field', 'fill_entry'];

/** Names of `tools` a site may not use, because the assistant's own tools have them. */
function checkTools(tools: ToolSet) {
  const clash = Object.keys(tools).filter((n) => RESERVED.includes(n));
  if (clash.length) throw new Error(`ai tools can't be named ${clash.join(', ')}: the assistant has tools with those names.`);
}

/**
 * Makes the assistant for `createCms({ ai })`. This file is the only one that imports the `ai` package, so a site that
 * doesn't turn the assistant on doesn't need it.
 *
 *   ai: assistant({ model: 'anthropic/claude-sonnet-5-5' })
 */
export function assistant(options: AssistantOptions): AssistantEngine {
  const name = options.name?.trim() || undefined;
  const tone = options.tone?.trim() || undefined;
  if (!options.model || (typeof options.model !== 'string' && typeof options.model !== 'object'))
    throw new Error("assistant needs a model: an AI Gateway id like 'anthropic/claude-sonnet-5-5', or an AI SDK model.");
  if ((name?.length ?? 0) > 40) throw new Error('assistant name is up to 40 characters.');
  if ((tone?.length ?? 0) > 300) throw new Error('assistant tone is up to 300 characters.');
  if (options.tools && typeof options.tools !== 'function') checkTools(options.tools);
  const steps = Math.max(1, Math.floor(options.maxSteps ?? 6));

  return {
    name,
    store: options.store,
    async *run({ ctx, content, input, signal, onTurn }): AsyncGenerator<AssistantEvent> {
      const { key, slug, values } = input.page;
      const canFill = !!key && Object.hasOwn(ctx.config, key);
      const fills: Fill[] = [];

      const custom = typeof options.tools === 'function' ? options.tools({ page: { key, slug } }) : (options.tools ?? {});
      checkTools(custom);
      const tools: ToolSet = {
        ...custom,
        ...readTools(ctx, content),
        ...(canFill ? fillTools(ctx, { key: key!, slug, values, onFill: (f) => fills.push(f) }) : {}),
      };

      // A conversation has to open with a question.
      const asked = input.messages.map((m): ModelMessage => ({ role: m.role, content: m.content }));
      while (asked.length > 1 && asked[0].role === 'assistant') asked.shift();
      const last = asked[asked.length - 1];
      if (canFill && last?.role === 'user' && typeof last.content === 'string') last.content = withValues(ctx, input, last.content);

      // What happened, for the record (the site's `store`, when it has one).
      const started = Date.now();
      const question = input.messages[input.messages.length - 1]?.content ?? '';
      const page = key && Object.hasOwn(ctx.config, key) ? `${key}/${slug ?? ''}` : 'site';
      const record = {
        answer: '',
        status: 'done' as AssistantTurn['status'],
        tools: [] as NonNullable<AssistantTurn['tools']>,
        fills: [] as AssistantFill[],
        usage: undefined as AssistantTurn['usage'],
      };
      const sendFill = (f: Fill) => {
        const before = values && typeof values === 'object' ? (values as Record<string, unknown>) : {};
        record.fills.push({
          fields: Object.keys(f.values),
          dropped: f.dropped,
          before: Object.fromEntries(Object.keys(f.values).map((k) => [k, before[k]])),
          after: f.values,
        });
        return { type: 'fill', ...f } as AssistantEvent;
      };

      try {
        const result = streamText({
          model: options.model,
          system: systemPrompt(ctx, input, { name, tone }),
          messages: asked,
          tools,
          stopWhen: isStepCount(steps),
          abortSignal: signal,
        });

        let finish: string | undefined;
        for await (const part of result.fullStream) {
          if (signal?.aborted) return;
          if (part.type === 'text-delta') {
            record.answer += part.text;
            yield { type: 'text', text: part.text };
          } else if (part.type === 'tool-call') {
            record.tools.push({ name: part.toolName, input: brief(part.input) });
            if (!FILL.includes(part.toolName)) yield { type: 'status', text: statusOf(part.toolName) };
          } else if (part.type === 'tool-result' || part.type === 'tool-error') {
            // A fill tool has finished (it queued what passed): send it to the form.
            while (fills.length) yield sendFill(fills.shift()!);
          } else if (part.type === 'finish-step') finish = part.finishReason;
          else if (part.type === 'finish') record.usage = { inputTokens: part.totalUsage.inputTokens, outputTokens: part.totalUsage.outputTokens };
          // The route logs it and tells the editor the request failed, without the provider's message.
          else if (part.type === 'error') throw part.error;
        }
        while (fills.length) yield sendFill(fills.shift()!);
        // The last step was a tool call, so the step limit stopped it before an answer.
        if (finish === 'tool-calls') {
          record.status = 'stopped';
          yield { type: 'error', message: 'Stopped: the assistant used all its steps without finishing. Ask again, more narrowly.' };
        }
      } catch (e) {
        record.status = 'error';
        throw e;
      } finally {
        // The editor stopped it (Stop, New chat, a closed tab).
        if (signal?.aborted && record.status === 'done') record.status = 'stopped';
        onTurn?.({
          chatId: input.chatId || crypto.randomUUID(),
          page,
          at: new Date().toISOString(),
          question,
          answer: record.answer,
          status: record.status,
          ...(record.fills.length && { fills: record.fills }),
          tools: record.tools,
          model: modelName(options.model),
          ...(record.usage && { usage: record.usage }),
          durationMs: Date.now() - started,
        });
      }
    },
  };
}
