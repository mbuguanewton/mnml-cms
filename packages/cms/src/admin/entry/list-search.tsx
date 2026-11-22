'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SearchIcon, XIcon } from 'lucide-react';
import { Input } from '../ui/input.js';

/**
 * The collection list's search box. A plain GET form, so Enter works without JavaScript; with it, the list follows
 * the typing (~300 ms after it stops) and a new search starts at page 1.
 */
export function ListSearch({ q, label }: { q: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(q);

  // The URL changed from outside (back button, Clear search link): show its search. Adjusted during render, not in
  // an effect, so the box doesn't flash the old value.
  const [shownQ, setShownQ] = useState(q);
  if (q !== shownQ) {
    setShownQ(q);
    if (value.trim() !== q) setValue(q);
  }

  // Only when the typed search differs from the URL's, so mounting (and React's double effects in dev) never navigates.
  useEffect(() => {
    const term = value.trim();
    if (term === q) return;
    const t = setTimeout(() => router.replace(term ? `${pathname}?q=${encodeURIComponent(term)}` : pathname, { scroll: false }), 300);
    return () => clearTimeout(t);
  }, [value, q, pathname, router]);

  return (
    <form method="get" role="search" className="relative w-full sm:max-w-xs">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-mnml-text-mute" />
      <Input
        type="search"
        name="q"
        value={value}
        onChange={setValue}
        placeholder={`Search ${label.toLowerCase()}`}
        aria-label={`Search ${label.toLowerCase()} by title or slug`}
        className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setValue('')}
          className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[4px] text-mnml-text-mute hover:bg-mnml-surface hover:text-mnml-text"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </form>
  );
}
