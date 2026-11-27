import type { LanguageModel, ToolSet } from 'ai';
import type { AssistantEvent, AssistantInput, AssistantTurn } from '../../api.js';
import type { ContentService } from '../content/content.js';
import type { Context } from '../context.js';

/** What `createCms({ ai })` takes: the assistant, made with `assistant()` from `@n3wtou/mnml-cms/ai`. */
export type AssistantEngine = {
  /** What the button and panel are called. Default 'Assistant'. */
  readonly name?: string;
  /** Where the record of turns goes, when the site keeps it in its own database. */
  readonly store?: AssistantStore;
  /** Answers one question. Yields what the panel shows. It never writes content. */
  run(call: AssistantCall): AsyncIterable<AssistantEvent>;
};

export type AssistantCall = {
  ctx: Context;
  content: ContentService;
  input: AssistantInput;
  signal?: AbortSignal;
  /** Called once when the answer is over (finished, stopped or failed) with the record of it. */
  onTurn?: (turn: AssistantTurn) => void;
};

/**
 * Where a site keeps what the assistant did, in its own database. Write one for your database; the package has no
 * database code. `record` runs after the answer is sent, so it never slows an answer, and a failure is logged and
 * never shown. Both get the request, so your code can read its own session (who asked).
 */
export type AssistantStore = {
  /** Append one row for the turn. Never update or delete: this is the audit record. */
  record(turn: AssistantTurn, o: { request: Request }): void | Promise<void>;
  /**
   * Optional. Every recorded turn of a page (`posts/hello`, `settings/`, or `site`), in any order, up to a few
   * hundred. With it, the History menu reads from your database (shared between editors and devices, and without
   * "Delete") instead of the browser. Use a parameterised query: `page` comes from the request.
   */
  turns?(page: string, o: { request: Request }): Promise<AssistantTurn[]>;
};

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
  /**
   * Keep a record of what the assistant did (the questions, answers, tools, fills with before and after values, model,
   * usage) in your own database. Default: none; the panel keeps its own chat list in the browser.
   */
  store?: AssistantStore;
};
