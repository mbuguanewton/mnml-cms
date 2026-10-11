import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { Context } from './context.js';
import { SESSION_COOKIE } from './session.js';

export async function isAdmin(ctx: Pick<Context, 'session'>) {
  return ctx.session.verify((await cookies()).get(SESSION_COOKIE)?.value);
}

export function checkPassword(ctx: { options: { auth: { password: string | undefined } } }, input: string) {
  const expected = ctx.options.auth.password;
  if (!expected) throw new Error('The CMS admin password is not set (e.g. ADMIN_PASSWORD).');
  // Hash first so both buffers have the same length for timingSafeEqual.
  const a = createHash('sha256').update(input).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
