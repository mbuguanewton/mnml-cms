// The assistant's entry point (`@n3wtou/mnml-cms/ai`). It imports the `ai` package, so it is kept apart from
// `@n3wtou/mnml-cms/next`: sites that don't use the assistant never load it.
export { assistant } from './assistant.js';
export type { AssistantOptions, AssistantPage, AssistantStore } from './types.js';
export type { AssistantFill, AssistantTurn } from '../../api.js';
// Puts recorded turns back into chats, for a store's own `turns()` or a page of your own.
export { groupTurns, type SavedChat } from '../../assistant-turns.js';
