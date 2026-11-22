// Framework-free core: the schema builders, validation and types. Safe to import anywhere.
export * from './schema/define.js';
export type { JSONContent } from '@tiptap/core';
export { seoMetadata } from './schema/seo.js';
export { plainText, readingTime } from './schema/derive.js';
export { collectReferences, type RichTextReferences } from './rich-text/references.js';
