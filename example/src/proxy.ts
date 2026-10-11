import { adminProxy } from '@newtou/mnml-cms/proxy';

export const proxy = adminProxy({ secret: process.env.ADMIN_SESSION_SECRET });

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
