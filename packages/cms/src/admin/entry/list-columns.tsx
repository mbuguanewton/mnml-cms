'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDownIcon, Columns3Icon } from 'lucide-react';
import { Menu } from '../ui/menu.js';
import { buttonVariants } from '../ui/button-variants.js';
import { useAdmin } from '../shell/context.js';

export type ColumnChoice = { key: string; label: string };

/**
 * The list's Columns menu: a check mark for each column an editor may show, and the first column fixed. A choice is
 * kept in a cookie for this collection, so the server renders the right table; the menu stays open while ticking.
 */
export function ListColumns({
  cookie,
  primary,
  choices,
  visible,
  defaults,
  customized,
}: {
  /** The cookie's name. */
  cookie: string;
  /** The first column's label: always shown. */
  primary: string;
  choices: ColumnChoice[];
  /** Keys of the choices showing now, and the ones the collection shows by default. */
  visible: string[];
  defaults: string[];
  /** The editor has chosen (so "Reset to default" does something). */
  customized: boolean;
}) {
  const { adminPath } = useAdmin();
  const router = useRouter();
  const [shown, setShown] = useState(new Set(visible));
  const [custom, setCustom] = useState(customized);

  // The page re-rendered with other columns (back button, reset elsewhere): show those. Adjusted during render, not in an effect.
  const signature = `${visible.join(',')}|${customized}`;
  const [seen, setSeen] = useState(signature);
  if (signature !== seen) {
    setSeen(signature);
    setShown(new Set(visible));
    setCustom(customized);
  }

  const write = (value: string | null) => {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie =
      value === null
        ? `${cookie}=; path=${adminPath}; max-age=0; SameSite=Lax${secure}`
        : `${cookie}=${encodeURIComponent(value || '-')}; path=${adminPath}; max-age=31536000; SameSite=Lax${secure}`;
    router.refresh();
  };

  const toggle = (key: string) => {
    const next = new Set(shown);
    if (!next.delete(key)) next.add(key);
    setShown(next);
    setCustom(true);
    write(
      choices
        .filter((c) => next.has(c.key))
        .map((c) => c.key)
        .join(','),
    );
  };
  const reset = () => {
    setShown(new Set(defaults));
    setCustom(false);
    write(null);
  };

  return (
    <Menu
      label="Columns"
      className={buttonVariants({ variant: 'outline' })}
      trigger={
        <>
          <Columns3Icon /> Columns <ChevronDownIcon />
        </>
      }
      items={[
        { id: 'primary', label: primary, checked: true, disabled: true, keepOpen: true, onSelect: () => {} },
        ...choices.map((c) => ({ id: c.key, label: c.label, checked: shown.has(c.key), keepOpen: true, onSelect: () => toggle(c.key) })),
        ...(custom ? [{ id: 'reset', label: 'Reset to default', onSelect: reset }] : []),
      ]}
    />
  );
}
