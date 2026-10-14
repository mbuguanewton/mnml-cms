'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2Icon } from 'lucide-react';
import { Button } from './button.js';
import { useAdmin } from './context.js';

/** Deletes one stored file, after a confirmation that warns if entries still use it. */
export function MediaDeleteButton({ mediaKey, name, usedIn }: { mediaKey: string; name: string; usedIn: number }) {
  const { post, confirm, alert } = useAdmin();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="danger"
      size="sm"
      className="px-2"
      disabled={pending}
      onClick={async () => {
        const ok = await confirm({
          title: `Delete “${name}”?`,
          description:
            usedIn > 0
              ? `It is used in ${usedIn} ${usedIn === 1 ? 'entry' : 'entries'}, where the image will be broken. This cannot be undone.`
              : 'This permanently deletes the file. It cannot be undone.',
          confirmLabel: 'Delete',
          danger: true,
        });
        if (!ok) return;
        startTransition(async () => {
          const r = await post<{ ok: boolean; message?: string }>('media/delete', { key: mediaKey });
          if (!r.ok) return alert({ title: 'Delete failed', description: r.message ?? 'Something went wrong.' });
          router.refresh();
        });
      }}
    >
      <Trash2Icon /> {pending ? 'Deleting…' : 'Delete'}
    </Button>
  );
}
