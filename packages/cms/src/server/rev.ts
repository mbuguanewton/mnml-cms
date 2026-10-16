import 'server-only';
import { createHash } from 'node:crypto';
import { canonical } from '../canonical.js';
import { withDefaults, type Collection, type Singleton } from '../define.js';

/**
 * A short fingerprint of an entry's content (missing fields filled in first). The admin form holds the one it
 * last saw or saved; autosave refuses to write when the stored entry no longer matches it.
 */
export const revOf = (def: Singleton | Collection, data: unknown) =>
  createHash('sha1')
    .update(JSON.stringify(canonical(withDefaults(def.fields, data))))
    .digest('base64url')
    .slice(0, 16);
