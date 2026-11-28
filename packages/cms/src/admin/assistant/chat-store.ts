import type { AssistantTurn } from '../../api.js';
import { parseTurns, pruneTurns } from '../../assistant-turns.js';

// The browser's record of the assistant (localStorage), a list of turns for each page. It is the default: a site can
// keep the full record in its own database instead (`store` on `assistant()`). Here only the words are kept: the
// questions, the answers and which fields were filled. The form's values are never stored, and nothing leaves the
// browser.

type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'setItem' | 'removeItem'>;

/** Chats kept for one page, and the most characters stored for them. Whole chats go, oldest first. */
export const MAX_CHATS = 12;
export const MAX_CHARS = 150_000;

const keyOf = (pageId: string) => `mnml-assistant-turns:${pageId}`;

/** What is stored for `pageId`, as written ('' for none). A string, so React can tell when it changed. */
export function rawTurns(store: Reader | null | undefined, pageId: string): string {
  try {
    return store?.getItem(keyOf(pageId)) ?? '';
  } catch {
    return '';
  }
}

/** The turns in `raw` (from `rawTurns`). Anything unreadable (hand-edited, from another version) is skipped. */
export function parseStored(raw: string): AssistantTurn[] {
  try {
    return parseTurns(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

const listeners = new Set<() => void>();

/** Calls `onChange` when the record changes: here, or in another tab. For `useSyncExternalStore`. */
export function subscribeChats(onChange: () => void) {
  listeners.add(onChange);
  const other = (e: StorageEvent) => (e.key === null || e.key.startsWith('mnml-assistant-turns:') ? onChange() : undefined);
  if (typeof window !== 'undefined') window.addEventListener('storage', other);
  return () => {
    listeners.delete(onChange);
    if (typeof window !== 'undefined') window.removeEventListener('storage', other);
  };
}

function write(store: Writer | null | undefined, pageId: string, turns: AssistantTurn[]) {
  try {
    if (turns.length === 0) store?.removeItem(keyOf(pageId));
    else store?.setItem(keyOf(pageId), JSON.stringify(turns));
  } catch {
    // A full or blocked storage (private mode) is not an error: the chat just isn't kept.
  }
  listeners.forEach((l) => l());
}

/** Adds a turn, then drops the oldest chats past the limits. */
export function appendTurn(store: (Reader & Writer) | null | undefined, pageId: string, turn: AssistantTurn) {
  const turns = pruneTurns([...parseStored(rawTurns(store, pageId)), turn], { maxChats: MAX_CHATS, maxChars: MAX_CHARS });
  write(store, pageId, turns);
}

/** Removes every turn of a chat. */
export function removeChat(store: (Reader & Writer) | null | undefined, pageId: string, chatId: string) {
  write(
    store,
    pageId,
    parseStored(rawTurns(store, pageId)).filter((t) => t.chatId !== chatId),
  );
}

/** The browser's storage, or null where there is none (a server render, or storage turned off). */
export function browserStore(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
