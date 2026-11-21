'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, CircleCheckIcon, CopyIcon, KeyRoundIcon } from 'lucide-react';
import { Button } from './button.js';
import { useAdmin } from './context.js';
import { cardClass, inputClass, labelClass } from './styles.js';

type Scope = 'read' | 'draft' | 'publish' | 'delete';
type Token = { id?: string; name: string; scopes: Scope[]; collections: string[] | null; createdAt?: string; lastUsedAt?: string | null };

const SCOPES: { scope: Scope; hint: string }[] = [
  { scope: 'read', hint: 'Read content and docs' },
  { scope: 'draft', hint: 'Create entries, save drafts, import images' },
  { scope: 'publish', hint: 'Publish, unpublish, ask to discard drafts' },
  { scope: 'delete', hint: 'Ask to delete entries' },
];

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Never');

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      aria-label={label}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <CheckIcon /> : <CopyIcon />} {done ? 'Copied' : 'Copy'}
    </Button>
  );
}

/** The Agent access page: create MCP tokens (shown once), list them, revoke them. */
export function AgentAccess({
  tokens,
  configTokens,
  content,
  mcpUrl,
}: {
  tokens: Token[];
  configTokens: Token[];
  content: { key: string; label: string }[];
  mcpUrl: string;
}) {
  const { post, confirm, alert } = useAdmin();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<Scope[]>(['read', 'draft']);
  const [all, setAll] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<{ name: string; token: string } | null>(null);
  const labelOf = (key: string) => content.find((c) => c.key === key)?.label ?? key;
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  // Own flag, not the transition: the list refresh afterwards shouldn't keep the button busy.
  const [creating, setCreating] = useState(false);
  const create = async () => {
    setCreating(true);
    try {
      const r = await post<{ ok: boolean; token?: string; message?: string; errors?: Record<string, string> }>('tokens/create', {
        name,
        scopes,
        collections: all ? null : picked,
      });
      if (!r.ok || !r.token) {
        setErrors(r.errors ?? {});
        if (!r.errors || Object.keys(r.errors).length === 0) await alert({ title: 'Token not created', description: r.message ?? 'Something went wrong.' });
        return;
      }
      setErrors({});
      setCreated({ name: name.trim(), token: r.token });
      setName('');
    } finally {
      setCreating(false);
    }
    router.refresh();
  };

  const revoke = async (t: Token) => {
    const ok = await confirm({
      title: `Revoke “${t.name}”?`,
      description: 'Agents using this token lose access on their next request. This cannot be undone.',
      confirmLabel: 'Revoke',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await post<{ ok: boolean; message?: string }>('tokens/revoke', { id: t.id });
      if (!r.ok) await alert({ title: 'Revoke failed', description: r.message ?? 'Something went wrong.' });
      router.refresh();
    });
  };

  const command = created ? `claude mcp add --transport http mnml ${mcpUrl} --header "Authorization: Bearer ${created.token}"` : '';
  const rows = [...tokens, ...configTokens];

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-mnml-text-soft">
        Tokens let AI agents use this site&apos;s MCP server at <code className="break-all">{mcpUrl}</code>. Agents write drafts; editors approve deletes and
        discards.
      </p>

      {created && (
        <section role="status" className="flex flex-col gap-3 rounded-[8px] border border-mnml-line bg-mnml-panel p-4 text-sm">
          <p className="flex items-start gap-2">
            <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-mnml-success" />
            <span>
              <span className="font-semibold">Token “{created.name}” created.</span>{' '}
              <span className="text-mnml-text-soft">Copy it now: it won&apos;t be shown again.</span>
            </span>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 rounded-[6px] border border-mnml-line bg-mnml-bg px-3 py-2 break-all text-mnml-text">{created.token}</code>
            <CopyButton text={created.token} label="Copy token" />
          </div>
          <p className="text-mnml-text-soft">Claude Code:</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 rounded-[6px] border border-mnml-line bg-mnml-bg px-3 py-2 text-xs break-all text-mnml-text">{command}</code>
            <CopyButton text={command} label="Copy command" />
          </div>
          <div>
            <Button size="sm" variant="outline" onClick={() => setCreated(null)}>
              Done
            </Button>
          </div>
        </section>
      )}

      <form
        className={`${cardClass} flex flex-col gap-4 p-4`}
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <h2 className="text-sm font-semibold [font-family:inherit]">New token</h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="token-name" className={labelClass}>
            Name
          </label>
          <input
            id="token-name"
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. claude-newton"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'token-name-error' : undefined}
          />
          {errors.name && (
            <p id="token-name-error" className="text-xs text-mnml-danger">
              {errors.name}
            </p>
          )}
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className={`${labelClass} mb-1.5`}>Scopes</legend>
          {SCOPES.map(({ scope, hint }) => (
            <label key={scope} className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" checked={scopes.includes(scope)} onChange={() => setScopes(toggle(scopes, scope))} />
              <span>
                <code>{scope}</code> <span className="text-mnml-text-soft">{hint}</span>
              </span>
            </label>
          ))}
          {errors.scopes && <p className="text-xs text-mnml-danger">{errors.scopes}</p>}
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className={`${labelClass} mb-1.5`}>Content</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={all} onChange={() => setAll(!all)} /> All content
          </label>
          {!all && (
            <div className="flex flex-wrap gap-x-4 gap-y-2 pl-6">
              {content.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={picked.includes(c.key)} onChange={() => setPicked(toggle(picked, c.key))} /> {c.label}
                </label>
              ))}
            </div>
          )}
          {errors.collections && <p className="text-xs text-mnml-danger">{errors.collections}</p>}
        </fieldset>
        <div>
          <Button type="submit" disabled={creating || !name.trim() || scopes.length === 0 || (!all && picked.length === 0)}>
            <KeyRoundIcon /> {creating ? 'Creating…' : 'Create token'}
          </Button>
        </div>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold [font-family:inherit]">Tokens</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-mnml-text-mute">No tokens yet.</p>
        ) : (
          <ul className={`${cardClass} divide-y divide-mnml-line`}>
            {rows.map((t) => (
              <li key={t.id ?? `config:${t.name}`} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="break-all">{t.name}</span>
                    {!t.id && <span className="rounded-full bg-mnml-surface px-2 py-0.5 text-xs font-normal text-mnml-text-soft">from config</span>}
                  </p>
                  <p className="text-sm text-mnml-text-soft">
                    {t.scopes.join(', ')} · {t.collections ? t.collections.map(labelOf).join(', ') : 'All content'}
                  </p>
                  {t.id && (
                    <p className="text-xs text-mnml-text-mute">
                      Created {when(t.createdAt)} · Last used {when(t.lastUsedAt)}
                    </p>
                  )}
                </div>
                {t.id && (
                  <Button size="sm" variant="danger" disabled={pending} onClick={() => revoke(t)} className="self-start">
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
