import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { AgentScope, Context } from './context.js';

// MCP tokens created in the admin (`mcp: { adminTokens: true }`). Rows in the entries table under `mnml:tokens`,
// keyed by the SHA-256 of the token, so the token itself is never stored and a lookup is one read.

export const TOKENS = 'mnml:tokens';
export const SCOPES: readonly AgentScope[] = ['read', 'draft', 'publish', 'delete'];
/** Last used is written at most this often per token. */
const TOUCH_MS = 60_000;

export type StoredToken = { name: string; scopes: AgentScope[]; collections: string[] | null; createdAt: string; lastUsedAt: string | null };
/** A token as the admin lists it. `id` is the token's hash: enough to revoke it, useless to sign in with. */
export type TokenSummary = StoredToken & { id: string };

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const ID = /^[0-9a-f]{64}$/;

type Invalid = { ok: false; message: string; errors: Record<string, string> };

export function agentTokens(ctx: Context) {
  const { storage, config } = ctx;
  const keys = Object.keys(config);
  /** Names config tokens already use: a stored token can't take one, since `change.by` shows the name. */
  const configNames = (ctx.options.mcp?.tokens ?? []).filter((t) => t.token).map((t) => t.name ?? 'agent');

  const input = z.object({
    name: z
      .string()
      .trim()
      .min(1, 'Required')
      .max(60, 'Keep it under 60 characters')
      .regex(/^[\w .@-]+$/, 'Letters, numbers, spaces and . _ - @ only'),
    scopes: z.array(z.enum(SCOPES as [AgentScope, ...AgentScope[]])).min(1, 'Pick at least one'),
    collections: z.array(z.enum(keys as [string, ...string[]])).nullish(),
  });

  async function list(): Promise<TokenSummary[]> {
    const rows = await storage.readRows(TOKENS);
    return rows.map((r) => ({ id: r.slug, ...(r.data as StoredToken) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return {
    list,

    /** Validates and stores a new token. Returns the token once; afterwards only its hash exists. */
    async create(body: unknown): Promise<{ ok: true; token: string; id: string } | Invalid> {
      const parsed = input.safeParse(body);
      if (!parsed.success) {
        const errors: Record<string, string> = {};
        for (const i of parsed.error.issues) errors[i.path.join('.') || '$'] ??= i.message;
        return { ok: false, message: 'Fix the highlighted fields.', errors };
      }
      const { name, scopes, collections } = parsed.data;
      const taken = [...configNames, ...(await list()).map((t) => t.name)].some((n) => n.toLowerCase() === name.toLowerCase());
      if (taken) return { ok: false, message: 'That name is in use.', errors: { name: 'Already in use' } };
      const token = `mnml_${randomBytes(32).toString('base64url')}`;
      const id = hashToken(token);
      const data: StoredToken = {
        name,
        scopes: SCOPES.filter((s) => scopes.includes(s)),
        // All content, or a subset in config order.
        collections: collections?.length && collections.length < keys.length ? keys.filter((k) => collections.includes(k)) : null,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
      };
      await storage.insertIfAbsent(TOKENS, id, data, 'published');
      return { ok: true, token, id };
    },

    /** The stored token for a bearer value, or null. */
    async find(token: string): Promise<{ id: string; data: StoredToken } | null> {
      const id = hashToken(token);
      const row = await storage.readRow(TOKENS, id);
      return row ? { id, data: row.data as StoredToken } : null;
    },

    /** Records a use, at most once a minute per token. */
    async touch(id: string, data: StoredToken, now = Date.now()) {
      if (data.lastUsedAt && now - Date.parse(data.lastUsedAt) < TOUCH_MS) return;
      await storage.upsert(TOKENS, id, { ...data, lastUsedAt: new Date(now).toISOString() }, 'published');
    },

    async revoke(id: unknown): Promise<{ ok: true } | Invalid> {
      if (typeof id !== 'string' || !ID.test(id)) return { ok: false, message: 'Unknown token.', errors: {} };
      await storage.remove(TOKENS, id);
      return { ok: true };
    },
  };
}

export type AgentTokens = ReturnType<typeof agentTokens>;
