'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { SearchIcon, UploadIcon, XIcon } from 'lucide-react';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { useAdmin } from '../shell/context.js';
import { mediaName } from '../shell/media-name.js';
import { uploadImage } from './upload.js';

type StoredFile = { key: string; url: string; size: number | null; uploadedAt: string | null };

/** Files shown before "Show more". */
const PAGE = 48;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif';

/**
 * A modal that lists the stored uploads (newest first, searchable by name) and hands back the one picked, or uploads a
 * new image and picks that. A portal on <body>: the entry form's own Enter and the editor's fullscreen Escape must not see it.
 */
export function MediaPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (url: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  // No document on the server.
  const client = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
  }, [open, client]);

  if (!client) return null;

  const close = () => {
    dialog.current?.close();
    onClose();
  };
  const pick = (url: string) => {
    dialog.current?.close();
    onPick(url);
  };

  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby="mnml-media-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
      // Escape closes only this dialog, not the fullscreen editor it was opened from.
      onKeyDown={(e) => e.key === 'Escape' && e.stopPropagation()}
      className="mnml-root h-[min(40rem,calc(100dvh-2rem))] w-[min(52rem,calc(100vw-2rem))] rounded-[10px] border border-mnml-line bg-mnml-bg p-0 text-sm text-mnml-text shadow-xl backdrop:bg-black/40 [font-family:ui-sans-serif,system-ui,sans-serif]"
      style={{ margin: 'auto' }}
    >
      {/* Mounted only while open, so each opening starts with a fresh search and a fresh read of the library. */}
      {open && <PickerBody onClose={close} onPick={pick} />}
    </dialog>,
    document.body,
  );
}

function PickerBody({ onClose, onPick }: { onClose: () => void; onPick: (url: string) => void }) {
  const { post, apiPath, mediaLibrary } = useAdmin();
  const file = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<StoredFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    if (!mediaLibrary) return;
    let live = true;
    post<{ ok: boolean; files?: StoredFile[]; message?: string }>('media/list', {})
      .then((r) => live && (r.ok && r.files ? setFiles(r.files) : setError(r.message ?? 'Could not load the uploads.')))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [mediaLibrary, post]);

  const needle = q.trim().toLowerCase();
  const matches = (files ?? []).filter((f) => !needle || mediaName(f.key).toLowerCase().includes(needle));

  const upload = async (f: File) => {
    setBusy(true);
    setError(null);
    try {
      onPick(await uploadImage(apiPath, f));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-mnml-line" style={{ padding: '14px 16px' }}>
        <h2 id="mnml-media-title" className="mr-auto text-base font-semibold [font-family:inherit]">
          Choose an image
        </h2>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => file.current?.click()}>
          <UploadIcon /> {busy ? 'Uploading…' : 'Upload new'}
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <XIcon />
        </Button>
        <input
          ref={file}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void upload(f);
          }}
        />
      </div>
      {mediaLibrary && (
        <div className="relative border-b border-mnml-line" style={{ padding: '10px 16px' }}>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-1/2 text-mnml-text-mute" />
          <Input
            type="search"
            value={q}
            onChange={(v) => {
              setQ(v);
              setShown(PAGE);
            }}
            placeholder="Search uploads"
            aria-label="Search uploads by name"
            className="pl-8 [&::-webkit-search-cancel-button]:hidden"
            // Enter must not submit anything the dialog was opened from.
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: 16 }}>
        {error && <p className="break-words text-mnml-danger">{error}</p>}
        {mediaLibrary && !error && files === null && <p className="text-mnml-text-mute">Loading…</p>}
        {files && files.length === 0 && <p className="text-mnml-text-mute">No uploads yet. Use “Upload new”.</p>}
        {files && files.length > 0 && matches.length === 0 && <p className="text-mnml-text-mute">No uploads match “{q.trim()}”.</p>}
        {matches.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {matches.slice(0, shown).map((f) => {
              const name = mediaName(f.key);
              return (
                <li key={f.key}>
                  <button
                    type="button"
                    onClick={() => onPick(f.url)}
                    title={name}
                    className="group flex w-full cursor-pointer flex-col overflow-hidden rounded-[8px] border border-mnml-line bg-mnml-panel text-left outline-none hover:border-mnml-primary focus-visible:border-mnml-primary focus-visible:ring-2 focus-visible:ring-mnml-primary/20"
                  >
                    {/* Plain <img>: served by the CMS media route. */}
                    {/* oxlint-disable-next-line nextjs/no-img-element */}
                    <img src={f.url} alt="" loading="lazy" className="aspect-[4/3] w-full bg-mnml-surface object-cover" />
                    <span className="truncate px-2 py-1.5 text-xs">{name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {matches.length > shown && (
          <div className="flex justify-center pt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => setShown(shown + PAGE)}>
              Show more ({matches.length - shown} left)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
