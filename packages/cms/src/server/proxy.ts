import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, SESSION_MAX_AGE, sessionCodec, sessionCookieOptions } from './session.js';

/**
 * Optimistic gate for the admin UI: signed-out visitors go to the login page.
 * The route handler re-checks the session on every request, so this is not the only guard.
 * While an editor is active it re-issues the cookie, so a session lasts a day from the last visit.
 * Only for the built-in password login; with a custom `auth` adapter, leave it out.
 *
 *   // proxy.ts
 *   export const proxy = adminProxy({ secret: process.env.ADMIN_SESSION_SECRET });
 *   export const config = { matcher: ['/admin', '/admin/:path*'] };
 */
export function adminProxy({ secret, adminPath = '/admin' }: { secret: string | undefined; adminPath?: string }) {
  const session = sessionCodec(secret);
  return async function proxy(request: NextRequest) {
    if (request.nextUrl.pathname === `${adminPath}/login`) return NextResponse.next();
    const current = await session.read(request.cookies.get(SESSION_COOKIE)?.value);
    if (!current) return NextResponse.redirect(new URL(`${adminPath}/login`, request.url));
    const response = NextResponse.next();
    // Renew once half the lifetime is gone, keeping the same version (the proxy can't see the database).
    if (current.expires - Date.now() < (SESSION_MAX_AGE * 1000) / 2) {
      response.cookies.set(SESSION_COOKIE, await session.create(current.version), sessionCookieOptions());
    }
    return response;
  };
}
