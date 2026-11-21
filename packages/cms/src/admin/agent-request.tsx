'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BotIcon } from 'lucide-react';
import { Button } from './button.js';
import { useAdmin } from './context.js';

/** An agent's request (from the MCP server) to delete this entry or discard its draft, for an editor to approve or reject. */
export function AgentRequest({ schemaKey, slug, action, by, at }: { schemaKey: string; slug?: string; action: 'delete' | 'discard'; by: string; at: string }) {
  const [pending, startTransition] = useTransition();
  const { post, confirm, alert } = useAdmin();
  const router = useRouter();
  const what = action === 'delete' ? 'delete this entry' : 'discard the unpublished changes';

  const answer = (approve: boolean) =>
    startTransition(async () => {
      const r = await post<{ ok: boolean; message?: string; redirect?: string }>('request', { key: schemaKey, slug, approve });
      if (!r.ok) await alert({ title: 'Request not carried out', description: r.message ?? 'Something went wrong.' });
      if (r.redirect) router.push(r.redirect);
      router.refresh();
    });

  return (
    // Stacked on phones (message, then full-width buttons); one row from `sm` up.
    <div
      role="status"
      className="flex flex-col gap-3 border-b border-mnml-line bg-mnml-warn px-6 py-3 text-sm text-mnml-on-warn sm:flex-row sm:items-center sm:py-2.5"
    >
      <p className="flex min-w-0 flex-1 items-start gap-2">
        <BotIcon className="mt-0.5 size-4 shrink-0" />
        <span>
          Agent <strong>{by}</strong> asked to {what}. {/* The server and the browser can be in different time zones. */}
          <span className="whitespace-nowrap opacity-75" suppressHydrationWarning>
            {new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </span>
        </span>
      </p>
      <div className="flex gap-2 sm:shrink-0">
        <Button size="sm" variant="outline" className="flex-1 sm:flex-none" disabled={pending} onClick={() => answer(false)}>
          Reject
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="flex-1 sm:flex-none"
          disabled={pending}
          onClick={async () => {
            const ok = await confirm({
              title: action === 'delete' ? 'Delete this entry?' : 'Discard the unpublished changes?',
              description:
                action === 'delete'
                  ? 'This removes the entry and any unpublished changes. It cannot be undone.'
                  : 'The draft goes back to the live version. It cannot be undone.',
              confirmLabel: action === 'delete' ? 'Delete' : 'Discard',
              danger: true,
            });
            if (ok) answer(true);
          }}
        >
          {action === 'delete' ? 'Approve delete' : 'Approve discard'}
        </Button>
      </div>
    </div>
  );
}
