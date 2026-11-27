import type { LanguageModel, ToolSet } from 'ai';
import type { AssistantEvent, AssistantInput } from '../../api.js';
import type { ContentService } from '../content/content.js';
import type { Context } from '../context.js';

/** What `createCms({ ai })` takes: the assistant, made with `assistant()` from `@n3wtou/mnml-cms/ai`. */
export type AssistantEngine = {
  /** What the button and panel are called. Default 'Assistant'. */
  readonly name?: string;
  /** Answers one question. Yields what the panel shows. It never writes content. */
  run(call: AssistantCall): AsyncIterable<AssistantEvent>;
};

export type AssistantCall = { ctx: Context; content: ContentService; input: AssistantInput; signal?: AbortSignal };

/** The page the editor has open, which `tools` can depend on. */
export type AssistantPage = { key?: string; slug?: string };

export type AssistantOptions = {
  /**
   * The model: an AI Gateway id such as `'anthropic/claude-sonnet-5-5'` (needs `AI_GATEWAY_API_KEY`, or OIDC on Vercel),
   * or any AI SDK model such as `google('gemini-2.5-flash')` from `@ai-sdk/google`.
   */
  model: LanguageModel;
  /**
   * Your own tools, made with `tool()` from `ai`: an object, or a function of the open page. They run on your
   * server for signed-in editors and can do whatever your code does, so keep them to reading.
   */
  tools?: ToolSet | ((o: { page: AssistantPage }) => ToolSet);
  /** What the button and panel are called, and what the model calls itself. Default 'Assistant'. Up to 40 characters. */
  name?: string;
  /** How it writes and answers, in your words: 'Friendly and concise, plain words.' Up to 300 characters. */
  tone?: string;
  /** Most model turns for one question (each tool call is another turn). Default 6. */
  maxSteps?: number;
};
