// Earlier chats, kept in the browser (localStorage), a list for each page. Only the words are kept: the questions,
// the answers and which fields were filled. The form's values are never stored, and nothing leaves the browser.

export type SavedMessage = {
  role: 'user' | 'assistant';
  text: string;
  error?: string;
  /** Fields the assistant filled during this answer. Undo needs the form as it was, so it is not kept. */
  fills?: { keys: string[]; dropped: Record<string, string> }[];
};

export type SavedChat = { id: string; title: string; updatedAt: number; messages: SavedMessage[] };

type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'setItem' | 'removeItem'>;

/** Chats kept for one page, and the most characters stored for them. The oldest go first. */
export const MAX_CHATS = 12;
export const MAX_CHARS = 150_000;
const TITLE = 48;

/** What a stored chat may look like before it is checked. */
type Raw = { id?: unknown; title?: unknown; updatedAt?: unknown; messages?: unknown };

const keyOf = (pageId: string) => `mnml-assistant:${pageId}`;

const isMessage = (m: unknown): m is SavedMessage =>
  !!m &&
  typeof m === 'object' &&
  ((m as SavedMessage).role === 'user' || (m as SavedMessage).role === 'assistant') &&
  typeof (m as SavedMessage).text === 'string';

/** What is stored for `pageId`, as written ('' for none). A string, so React can tell when it changed. */
export function rawChats(store: Reader | null | undefined, pageId: string): string {
  try {
    return store?.getItem(keyOf(pageId)) ?? '';
  } catch {
    return '';
  }
}

/** The chats in `raw` (from `rawChats`), newest first. Anything unreadable (hand-edited, from another version) is skipped. */
export function parseChats(raw: string): SavedChat[] {
  try {
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return (list as Raw[])
      .flatMap((c): SavedChat[] => {
        if (!c || typeof c !== 'object' || typeof c.id !== 'string' || typeof c.title !== 'string' || !Array.isArray(c.messages)) return [];
        const messages = (c.messages as unknown[]).filter(isMessage).map((m) => ({
          role: m.role,
          text: m.text,
          ...(typeof m.error === 'string' && { error: m.error }),
          // Whatever the file holds, only the shape the panel reads gets through.
          ...(Array.isArray(m.fills) && {
            fills: (m.fills as { keys?: unknown; dropped?: unknown }[]).flatMap((f) =>
              f && Array.isArray(f.keys)
                ? [{ keys: f.keys.map(String), dropped: f.dropped && typeof f.dropped === 'object' ? (f.dropped as Record<string, string>) : {} }]
                : [],
            ),
          }),
        }));
        return messages.length ? [{ id: c.id, title: c.title, updatedAt: Number(c.updatedAt) || 0, messages }] : [];
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/** The chats saved for `pageId`, newest first. */
export const readChats = (store: Reader | null | undefined, pageId: string): SavedChat[] => parseChats(rawChats(store, pageId));

const size = (c: SavedChat) => c.messages.reduce((n, m) => n + m.text.length + (m.error?.length ?? 0), c.title.length);

/** Adds or replaces a chat, newest first, within the limits. */
export function upsertChat(chats: SavedChat[], chat: SavedChat): SavedChat[] {
  const all = [chat, ...chats.filter((c) => c.id !== chat.id)].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CHATS);
  let chars = 0;
  // The newest chat is always kept, even when it alone is over the limit.
  return all.filter((c, i) => ((chars += size(c)), i === 0 || chars <= MAX_CHARS));
}

const listeners = new Set<() => void>();

/** Calls `onChange` when chats change: saved here, or in another tab. For `useSyncExternalStore`. */
export function subscribeChats(onChange: () => void) {
  listeners.add(onChange);
  const other = (e: StorageEvent) => (e.key === null || e.key.startsWith('mnml-assistant:') ? onChange() : undefined);
  if (typeof window !== 'undefined') window.addEventListener('storage', other);
  return () => {
    listeners.delete(onChange);
    if (typeof window !== 'undefined') window.removeEventListener('storage', other);
  };
}

/** Saves the list. A full or blocked storage (private mode) is not an error: the chat just isn't kept. */
export function writeChats(store: Writer | null | undefined, pageId: string, chats: SavedChat[]) {
  try {
    if (chats.length === 0) store?.removeItem(keyOf(pageId));
    else store?.setItem(keyOf(pageId), JSON.stringify(chats));
  } catch {
    // Nothing to do.
  }
  listeners.forEach((l) => l());
}

/** The first question, shortened: what the chat is called in the list. */
export function chatTitle(messages: { role: string; text: string }[]): string {
  const first =
    messages
      .find((m) => m.role === 'user')
      ?.text.replace(/\s+/g, ' ')
      .trim() ?? '';
  return first.length > TITLE ? `${first.slice(0, TITLE - 1).trimEnd()}…` : first || 'Chat';
}

/** The browser's storage, or null where there is none (a server render, or storage turned off). */
export function browserStore(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
