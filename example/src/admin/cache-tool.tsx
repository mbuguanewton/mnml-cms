'use client';

import { useState, useTransition } from 'react';
import { InfoIcon } from 'lucide-react';
import { AdminHeader, Button, Checkbox, Select, Switch, Tooltip, bodyClass, cardClass, labelClass, useAdmin } from '@n3wtou/mnml-cms/admin';
import { refreshCache } from './actions';

type Section = 'site' | 'posts' | 'authors';

/** A custom admin page (the `pages` option) built from the admin's own components. */
export function CacheTool() {
  const { toast, confirm } = useAdmin();
  const [section, setSection] = useState<Section>('posts');
  const [withHome, setWithHome] = useState(true);
  const [ask, setAsk] = useState(true);
  const [pending, start] = useTransition();

  const run = async () => {
    if (ask && section === 'site' && !(await confirm({ title: 'Refresh the whole site?', description: 'Every page is rebuilt on its next visit.' }))) return;
    start(async () => {
      const r = await refreshCache(section, withHome);
      toast({ title: r.message, tone: r.ok ? 'success' : 'danger' });
    });
  };

  return (
    <>
      <AdminHeader crumbs={[{ label: 'Cache' }]} />
      <div className={`${bodyClass} flex flex-col gap-6`}>
        <form
          className={`${cardClass} flex flex-col gap-4 p-4`}
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cache-section" className={`${labelClass} flex items-center gap-1.5`}>
              Section
              <Tooltip content="Pages under this path are rebuilt on their next visit">
                <button type="button" aria-label="About sections" className="text-mnml-text-mute">
                  <InfoIcon className="size-3.5" />
                </button>
              </Tooltip>
            </label>
            <Select
              id="cache-section"
              value={section}
              onChange={(v) => setSection((v ?? 'posts') as Section)}
              options={[
                { value: 'site', label: 'Whole site' },
                { value: 'posts', label: 'Posts' },
                { value: 'authors', label: 'Authors' },
              ]}
            />
          </div>
          <Checkbox checked={withHome} onChange={setWithHome} disabled={section === 'site'} label="Also refresh the home page" />
          <Switch checked={ask} onChange={setAsk} label="Confirm before refreshing the whole site" />
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
