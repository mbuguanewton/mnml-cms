import { adminProxy } from '@n3wtou/mnml-cms/proxy';

export const proxy = adminProxy({ secret: process.env.ADMIN_SESSION_SECRET });

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
