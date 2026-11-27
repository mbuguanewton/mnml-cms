// The assistant's entry point (`@n3wtou/mnml-cms/ai`). It imports the `ai` package, so it is kept apart from
// `@n3wtou/mnml-cms/next`: sites that don't use the assistant never load it.
export { assistant } from './assistant.js';
export type { AssistantOptions, AssistantPage } from './types.js';
