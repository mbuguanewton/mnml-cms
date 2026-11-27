// Request and response shapes of the CMS route handler, shared by the server and the admin UI.

export type EntryStatus = 'draft' | 'published';
/**
 * What a save does to a collection entry (singletons always publish):
 *  - 'publish': make this version the live one.
 *  - 'draft': keep it off the site. On a published entry it is stored as pending changes and the live version stays.
 *  - 'unpublish': take the entry off the site, keeping this version as its draft.
 */
export type SaveAction = 'publish' | 'draft' | 'unpublish';
export type EntryInput = { key: string; slug?: string; mode: 'create' | 'update'; data: unknown; action?: SaveAction };
/** `rev` is the revision the form last knew; a mismatch means someone else changed the entry. */
export type AutosaveInput = EntryInput & { rev: string };
export type Invalid = { ok: false; message: string; errors: Record<string, string> };
export type SaveResult = { ok: true; message: string; redirect?: string; rev?: string } | Invalid;
/** `changes`: the draft now differs from the live version. */
export type AutosaveResult = { ok: true; rev: string; changes: boolean } | (Invalid & { conflict?: true });
export type PreviewResult = { ok: true; url: string } | Invalid;
/** A bulk action on list rows: `action` is publish, unpublish, delete, or the name of a site's `listActions` entry. */
export type BulkInput = { key: string; slugs: string[]; action: string };
/** What happened to each entry: `done`, `skipped` (nothing to do, e.g. already published) or `failed` (with why). */
export type BulkResult =
  | { ok: true; results: { done: string[]; skipped: { slug: string; message: string }[]; failed: { slug: string; message: string }[] } }
  | { ok: false; message: string };
/** What the "Create new" panel of a reference field needs: the target collection's form, its defaults and the entries its own reference fields offer. */
export type ReferenceSchemaResult =
  | {
      ok: true;
      schema: import('./schema/define.js').Collection;
      initial: Record<string, unknown>;
      refOptions: Record<string, { slug: string; label: string }[]>;
    }
  | Invalid;

/** The page the editor has open, sent with each assistant question. `values` are the form's current values. */
export type AssistantPage = { key?: string; slug?: string; values?: unknown };
export type AssistantInput = {
  messages: { role: 'user' | 'assistant'; content: string }[];
  page: AssistantPage;
  /** The chat this question belongs to (made by the panel), so the answers of one chat can be put back together. */
  chatId?: string;
};
/**
 * What `<apiPath>/ai/chat` streams, one JSON object per line. `fill` carries values the editor's form should take
 * (already checked like a save) and the fields that were left out, with the reason.
 */
export type AssistantEvent =
  | { type: 'text'; text: string }
  | { type: 'status'; text: string }
  | { type: 'fill'; values: Record<string, unknown>; dropped: Record<string, string> }
  | { type: 'error'; message: string };

/** What the assistant did to the form in one answer. `before` and `after` are only in what the server records. */
export type AssistantFill = {
  fields: string[];
  dropped: Record<string, string>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

/**
 * One question and its answer: the unit of the assistant's record. The server records all of it for a site's `store`;
 * the browser keeps a lighter one (no tools, usage, or before and after values) for the History menu.
 */
export type AssistantTurn = {
  chatId: string;
  /** `posts/hello`, `settings/` for a singleton, or `site` away from an entry. */
  page: string;
  /** ISO time the answer finished. */
  at: string;
  question: string;
  answer: string;
  /** 'stopped': the editor stopped it, or it ran out of steps. */
  status: 'done' | 'stopped' | 'error';
  fills?: AssistantFill[];
  /** Every tool it called, with its input (cut when long). */
  tools?: { name: string; input?: unknown }[];
  model?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  durationMs?: number;
};

/** Who did something. `label` is what the Activity view shows; `id` is the site's own identifier, if it gave one. */
export type ActivityActor = { type: 'admin' | 'agent' | 'assistant'; id?: string; label: string };

export type ActivityAction = 'create' | 'update' | 'autosave' | 'draft' | 'publish' | 'unpublish' | 'discard' | 'delete' | 'request' | 'reject' | 'assistant';

/** What the assistant did in one answer, kept on its activity event. */
export type ActivityAssistant = {
  chatId: string;
  question: string;
  status: AssistantTurn['status'];
  model?: string;
  tools: { name: string; input?: unknown }[];
  fills: AssistantFill[];
};

/** One row of an entry's Activity view. */
export type ActivityEvent = {
  id: string;
  key: string;
  /** `singleton` for a singleton. */
  slug: string;
  action: ActivityAction;
  by: ActivityActor;
  /** For an assistant event, the editor who asked. */
  for?: ActivityActor;
  /** ISO time. */
  at: string;
  summary?: string;
  /** Top-level fields that changed. */
  fields?: string[];
  assistant?: ActivityAssistant;
};
