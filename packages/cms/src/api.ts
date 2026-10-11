// Request and response shapes of the CMS route handler, shared by the server and the admin UI.

export type EntryInput = { key: string; slug?: string; mode: 'create' | 'update'; data: unknown };
export type Invalid = { ok: false; message: string; errors: Record<string, string> };
export type SaveResult = { ok: true; message: string; redirect?: string } | Invalid;
export type PreviewResult = { ok: true; url: string } | Invalid;
