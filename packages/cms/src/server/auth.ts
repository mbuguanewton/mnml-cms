import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { cache, type ReactNode } from 'react';
import { cookies } from 'next/headers';
import type { Context } from './context.js';
import { SESSION_COOKIE } from './session.js';
import type { EntryStorage } from './storage.js';

/**
 * Plug in your own login (Auth.js, Better Auth, Clerk…) instead of the built-in password:
 *
 *   auth: { isAdmin: async () => (await getSession())?.user.role === 'admin', loginUrl: '/sign-in' }
 *
 * The admin page and every API route call `isAdmin()`, so a `false` locks them. Leave `adminProxy` out:
 * it only knows the built-in session cookie.
 */
export type AuthAdapter = {
  /** Whether the current request is signed in as an admin. Runs on each admin request. */
  isAdmin(): Promise<boolean>;
  /** Ends the session when someone clicks Sign out; the admin then goes to the sign-in page. */
  signOut?(): Promise<void>;
} & (
  | {
      /** Your sign-in UI (a server or client component), shown in the admin's own login card at `/admin/login`,
       *  e.g. a "Continue with SSO" button. */
      login: ReactNode;
      loginUrl?: never;
    }
  | {
      /** A sign-in page of your own, outside the admin: signed-out visitors are redirected there. */
      loginUrl: string;
      login?: never;
    }
);

/** The built-in single shared password. */
export type PasswordAuth = { password: string | undefined; secret: string | undefined };

// Auth state lives in the entries table under this collection (it isn't in your config, so the API can't touch it).
const AUTH = '_auth';

const fingerprint = (password: string | undefined, secret: string | undefined) =>
  createHash('sha256').update(`${password ?? ''}\0${secret ?? ''}`).digest('hex').slice(0, 12);

const readEpoch = cache(async (storage: EntryStorage) => {
  const row = await storage.readRow(AUTH, 'epoch');
  return Number((row?.data as { value?: number } | undefined)?.value ?? 0);
});

/**
 * Sessions are only valid while this is unchanged: it changes when the password or secret does,
 * and when someone uses "Sign out everywhere".
 */
export async function sessionVersion(ctx: Pick<Context, 'storage' | 'options'>) {
  const a = ctx.options.auth as PasswordAuth;
  return `${fingerprint(a.password, a.secret)}-${await readEpoch(ctx.storage)}`;
}

/** Invalidates every existing session. */
export async function signOutEverywhere(ctx: Pick<Context, 'storage'>) {
  await ctx.storage.upsert(AUTH, 'epoch', { value: (await readEpoch(ctx.storage)) + 1 }, 'published');
}

export async function isAdmin(ctx: Pick<Context, 'session' | 'storage' | 'options' | 'authAdapter'>) {
  if (ctx.authAdapter) return ctx.authAdapter.isAdmin();
  const session = await ctx.session.read((await cookies()).get(SESSION_COOKIE)?.value);
  return !!session && session.version === (await sessionVersion(ctx));
}

export function checkPassword(expected: string | undefined, input: string) {
  if (!expected) throw new Error('The CMS admin password is not set (e.g. ADMIN_PASSWORD).');
  // Hash first so both buffers have the same length for timingSafeEqual.
  const a = createHash('sha256').update(input).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

// Failed-login throttling, per client IP, kept in the entries table so it works on serverless too.
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

type Attempts = { count: number; first: number; lockedUntil?: number };

const attemptsSlug = (ip: string) => `login:${createHash('sha256').update(ip).digest('hex').slice(0, 16)}`;

export function clientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

/** Seconds until this client may try again, or 0 if it may now. */
export async function lockedFor(storage: EntryStorage, ip: string) {
  const a = (await storage.readRow(AUTH, attemptsSlug(ip)))?.data as Attempts | undefined;
  return a?.lockedUntil && a.lockedUntil > Date.now() ? Math.ceil((a.lockedUntil - Date.now()) / 1000) : 0;
}

export async function recordFailure(storage: EntryStorage, ip: string) {
  const slug = attemptsSlug(ip);
  const prev = (await storage.readRow(AUTH, slug))?.data as Attempts | undefined;
  const now = Date.now();
  const fresh = !prev || now - prev.first > WINDOW_MS;
  const count = fresh ? 1 : prev.count + 1;
  const next: Attempts = { count, first: fresh ? now : prev.first, ...(count >= MAX_FAILURES && { lockedUntil: now + LOCK_MS }) };
  await storage.upsert(AUTH, slug, next, 'published');
}

export async function clearFailures(storage: EntryStorage, ip: string) {
  await storage.remove(AUTH, attemptsSlug(ip));
}
