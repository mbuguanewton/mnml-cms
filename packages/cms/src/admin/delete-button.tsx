'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2Icon } from 'lucide-react';
import { Button } from './button.js';
import { useAdmin } from './context.js';

export function DeleteButton({ schemaKey, slug, title }: { schemaKey: string; slug: string; title: string }) {
  const [pending, startTransition] = useTransition();
  const { post } = useAdmin();
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="danger"
      size="icon"
      aria-label="Delete"
      title="Delete"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete “${title}”? This cannot be undone.`)) return;
        startTransition(async () => {
          const r = await post<{ ok: boolean; redirect?: string; message?: string }>('delete', { key: schemaKey, slug });
          if (!r.ok || !r.redirect) return alert(r.message ?? 'Delete failed.');
          router.push(r.redirect);
          router.refresh();
        });
      }}
    >
      <Trash2Icon />
    </Button>
  );
}
