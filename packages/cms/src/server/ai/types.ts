// The model adapter: the one thing the admin assistant needs from an AI provider. The package has no vendor code;
// an adapter is a small function over the provider's HTTP API (see the docs for Anthropic, OpenAI and Gemini).

/** A tool the model may call. `parameters` is a JSON Schema object. */
export type AiTool = { name: string; description: string; parameters: Record<string, unknown> };

export type AiToolCall = { id: string; name: string; args: Record<string, unknown> };

/** The conversation so far. A `tool` message answers the `assistant` message's call with the same `id`. */
export type AiMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: AiToolCall[] }
  | { role: 'tool'; id: string; name: string; content: string };

/** What a model streams back: text as it is written, and each tool call once its arguments are complete. */
export type AiEvent = { type: 'text'; text: string } | ({ type: 'tool_call' } & AiToolCall);

export type AiRequest = { system: string; messages: AiMessage[]; tools: AiTool[]; signal?: AbortSignal };

export type AiModel = {
  /** Streams one model turn. Ends when the model has finished; stop early when `signal` aborts. */
  stream(request: AiRequest): AsyncIterable<AiEvent>;
};

export type AiOptions = {
  model: AiModel;
  /** Most model turns for one question (each tool call is another turn). Default 6. */
  maxSteps?: number;
  /** What the panel and the button are called, and what the model calls itself. Default 'Assistant'. Up to 40 characters. */
  name?: string;
  /** How it writes and answers, in your words: 'Friendly and concise, plain words.' Up to 300 characters. */
  tone?: string;
};
