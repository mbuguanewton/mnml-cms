'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2Icon } from 'lucide-react';
import { MenuItem } from './action-menu.js';
import { useAdmin } from './context.js';

export function DeleteButton({ schemaKey, slug, title }: { schemaKey: string; slug: string; title: string }) {
  const [pending, startTransition] = useTransition();
  const { post, confirm, alert } = useAdmin();
  const router = useRouter();
  return (
    <MenuItem
      danger
      disabled={pending}
      onClick={async () => {
        const ok = await confirm({
          title: `Delete “${title}”?`,
          description: 'This removes the entry and any unpublished changes. It cannot be undone.',
          confirmLabel: 'Delete',
          danger: true,
        });
        if (!ok) return;
        startTransition(async () => {
          const r = await post<{ ok: boolean; redirect?: string; message?: string }>('delete', { key: schemaKey, slug });
          if (!r.ok || !r.redirect) return alert({ title: 'Delete failed', description: r.message ?? 'Something went wrong.' });
          router.push(r.redirect);
          router.refresh();
        });
      }}
    >
      <Trash2Icon /> {pending ? 'Deleting…' : 'Delete'}
    </MenuItem>
  );
}
