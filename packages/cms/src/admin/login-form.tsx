'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './button.js';
import { useAdmin } from './context.js';
import { inputClass, labelClass } from './styles.js';

export function LoginForm() {
  const { post } = useAdmin();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="password" className={labelClass}>
        Password
      </label>
      <input id="password" name="password" type="password" required autoFocus autoComplete="current-password" className={inputClass} />
      {error && <p className="text-sm text-cms-danger">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Checking…' : 'Sign in'}
      </Button>
    </form>
  );
}
