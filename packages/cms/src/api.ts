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
export type Invalid = { ok: false; message: string; errors: Record<string, string> };
export type SaveResult = { ok: true; message: string; redirect?: string } | Invalid;
export type PreviewResult = { ok: true; url: string } | Invalid;
