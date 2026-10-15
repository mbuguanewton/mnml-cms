// Signed admin session cookie. Web Crypto only, so it also runs in the proxy.

export const SESSION_COOKIE = 'mnml_session';
// An idle timeout: the proxy re-issues the cookie while the editor is active (see adminProxy).
export const SESSION_MAX_AGE = 60 * 60 * 24; // seconds

export const sessionCookieOptions = () =>
  ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE }) as const;

const enc = new TextEncoder();

const toB64 = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const fromB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export type Session = { expires: number; version: string };

/**
 * Token format: `<expiry ms>.<version>.<base64url HMAC of "admin:<expiry>:<version>">`.
 * `version` ties the session to the current password and "sign out everywhere" counter; the route
 * handlers compare it, the proxy (which can't reach the database) only checks the signature.
 */
export function sessionCodec(secret: string | undefined) {
  const key = () => {
    if (!secret || secret.length < 32) throw new Error('The CMS session secret must be at least 32 characters (e.g. ADMIN_SESSION_SECRET).');
    return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  };

  return {
    async create(version = '0') {
      const expires = Date.now() + SESSION_MAX_AGE * 1000;
      const sig = await crypto.subtle.sign('HMAC', await key(), enc.encode(`admin:${expires}:${version}`));
      return `${expires}.${version}.${toB64(sig)}`;
    },
    /** The session if the signature is valid and it hasn't expired. */
    async read(token: string | undefined): Promise<Session | null> {
      if (!token) return null;
      const [exp, version, sig] = token.split('.');
      const expires = Number(exp);
      if (!sig || !version || !Number.isFinite(expires) || expires < Date.now()) return null;
      try {
        // subtle.verify compares in constant time.
        const ok = await crypto.subtle.verify('HMAC', await key(), fromB64(sig), enc.encode(`admin:${expires}:${version}`));
        return ok ? { expires, version } : null;
      } catch {
        return null;
      }
    },
  };
}
