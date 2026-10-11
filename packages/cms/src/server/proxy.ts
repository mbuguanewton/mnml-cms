import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, sessionCodec } from './session.js';

/**
 * Optimistic gate for the admin UI: signed-out visitors go to the login page.
 * The route handler re-checks the session on every request, so this is not the only guard.
 *
 *   // proxy.ts
 *   export const proxy = adminProxy({ secret: process.env.ADMIN_SESSION_SECRET });
 *   export const config = { matcher: ['/admin', '/admin/:path*'] };
 */
export function adminProxy({ secret, adminPath = '/admin' }: { secret: string | undefined; adminPath?: string }) {
  const session = sessionCodec(secret);
  return async function proxy(request: NextRequest) {
    if (request.nextUrl.pathname === `${adminPath}/login`) return NextResponse.next();
    if (await session.verify(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
    return NextResponse.redirect(new URL(`${adminPath}/login`, request.url));
  };
}
