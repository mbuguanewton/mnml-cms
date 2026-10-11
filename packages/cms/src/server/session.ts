// Signed admin session cookie. Web Crypto only, so it also runs in the proxy.

export const SESSION_COOKIE = 'cms_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // seconds

const enc = new TextEncoder();

const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** Token format: `<expiry ms>.<base64url HMAC of "admin:<expiry>">`. */
export function sessionCodec(secret: string | undefined) {
  const key = () => {
    if (!secret || secret.length < 32) throw new Error('The CMS session secret must be at least 32 characters (e.g. ADMIN_SESSION_SECRET).');
    return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  };

  return {
    async create() {
      const expires = Date.now() + SESSION_MAX_AGE * 1000;
      const sig = await crypto.subtle.sign('HMAC', await key(), enc.encode(`admin:${expires}`));
      return `${expires}.${toB64(sig)}`;
    },
    async verify(token: string | undefined) {
      if (!token) return false;
      const [exp, sig] = token.split('.');
      const expires = Number(exp);
      if (!sig || !Number.isFinite(expires) || expires < Date.now()) return false;
      try {
        // subtle.verify compares in constant time.
        return await crypto.subtle.verify('HMAC', await key(), fromB64(sig), enc.encode(`admin:${expires}`));
      } catch {
        return false;
      }
    },
  };
}
