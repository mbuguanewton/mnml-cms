'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './button.js';
import { useAdmin } from './context.js';
import { inputClass, labelClass } from './styles.js';

export function LoginForm() {
  const { post } = useAdmin();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [show, setShow] = useState(false);
  const showId = useId();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const r = await post<{ ok: boolean; message?: string; redirect?: string }>('login', { password: new FormData(e.currentTarget).get('password') });
      if (r.ok && r.redirect) return router.replace(r.redirect);
      setError(r.message ?? 'Sign-in failed.');
    } catch (err) {
      setError((err as Error).message);
    }
    setPending(false);
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type={show ? 'text' : 'password'}
          required
          autoFocus
          autoComplete="current-password"
          aria-invalid={!!error}
          aria-describedby={error ? 'login-error' : undefined}
          className={inputClass}
          style={{ height: 40 }}
        />
        <label htmlFor={showId} className="text-mnml-text-soft select-none" style={{ display: 'flex', width: 'fit-content', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input id={showId} type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--mnml-primary)' }} />
          Show password
        </label>
      </div>
      {error && (
        <p id="login-error" role="alert" style={{ margin: 0, padding: '8px 12px', borderRadius: 6, color: 'var(--mnml-danger)', background: 'color-mix(in srgb, var(--mnml-danger) 10%, transparent)' }}>
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} style={{ width: '100%', height: 40 }}>
        {pending ? 'Checking…' : 'Sign in'}
      </Button>
    </form>
  );
}
