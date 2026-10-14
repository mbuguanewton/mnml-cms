'use client';

import { useMemo } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import {
  BoldIcon,
  ChevronDownIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  Heading5Icon,
  Heading6Icon,
  HeadingIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  PilcrowIcon,
  QuoteIcon,
  Redo2Icon,
  Undo2Icon,
} from 'lucide-react';
import { resolveExtensions } from '../rich-text.js';
import type { EditorTool } from '../editor.js';
import { menuItemClass, useMenu } from './action-menu.js';
import { useAdmin } from './context.js';
import { useEditorConfig } from './editor-context.js';
import { uploadImage } from './upload.js';

export function RichTextEditor({ value, onChange, invalid }: { value: JSONContent; onChange: (v: JSONContent) => void; invalid?: boolean }) {
  const config = useEditorConfig();
  const extensions = useMemo(() => resolveExtensions(config), [config]);
  const editor = useEditor({
    extensions,
    content: value,
    // Render on the client only, otherwise SSR and hydration disagree.
    immediatelyRender: false,
    editorProps: { attributes: { class: 'mnml-prose min-h-48 px-3 py-2.5 focus:outline-none' } },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  return (
    <div aria-invalid={invalid} className="rounded-[6px] border border-mnml-line bg-mnml-bg focus-within:border-mnml-text-mute/50 aria-invalid:border-mnml-danger">
      {editor && <Toolbar editor={editor} extra={config?.tools ?? noTools} />}
      <EditorContent editor={editor} />
    </div>
  );
}

const noTools: EditorTool[] = [];

function Toolbar({ editor, extra }: { editor: Editor; extra: EditorTool[] }) {
  const { apiPath, alert } = useAdmin();
  // The heading extension's levels (1–4 by default; a site can change them), or none if it was removed.
  const levels = useMemo(
    () => (editor.extensionManager.extensions.find((e) => e.name === 'heading')?.options.levels as Level[] | undefined) ?? [],
    [editor],
  );
  const hasQuote = useMemo(() => editor.extensionManager.extensions.some((e) => e.name === 'blockquote'), [editor]);
  const s = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      // Level of the heading at the cursor, or 0 for any other block.
      heading: levels.find((level) => editor.isActive('heading', { level })) ?? (0 as const),
      bullet: editor.isActive('bulletList'),
      ordered: editor.isActive('orderedList'),
      quote: editor.isActive('blockquote'),
      code: editor.isActive('code'),
      link: editor.isActive('link'),
      // Alt text of the selected image, or null when no image is selected.
      imageAlt: editor.isActive('image') ? ((editor.getAttributes('image').alt as string | null) ?? '') : null,
      undo: editor.can().undo(),
      redo: editor.can().redo(),
      // The site's own tools, by name.
      extra: Object.fromEntries(extra.map((t) => [t.name, { active: t.isActive?.(editor) ?? false, disabled: t.disabled?.(editor) ?? false }])),
    }),
  });
  const chain = () => editor.chain().focus();

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const href = window.prompt('Link URL (leave empty to remove)', prev ?? 'https://');
    if (href === null) return;
    if (href.trim() === '') chain().extendMarkRange('link').unsetLink().run();
    else chain().extendMarkRange('link').setLink({ href: href.trim() }).run();
  };

  const addImage = async (f: File) => {
    try {
      const src = await uploadImage(apiPath, f);
      chain().setImage({ src, alt: '' }).run();
    } catch (e) {
      await alert({ title: 'Upload failed', description: (e as Error).message });
    }
  };

  type Tool = { name: string; icon: React.ReactNode; label: string; active?: boolean; disabled?: boolean; run: () => void };
  const own = (group?: EditorTool['group']): Tool[] =>
    extra.filter((t) => t.group === group).map((t) => ({ name: `extra:${t.name}`, icon: t.icon, label: t.label, ...s.extra[t.name], run: () => t.run(editor) }));
  const buttons = (tools: Tool[]) => tools.map((t) => <ToolButton key={t.name} {...t} />);

  const history: Tool[] = [
    { name: 'undo', icon: <Undo2Icon />, label: 'Undo', disabled: !s.undo, run: () => chain().undo().run() },
    { name: 'redo', icon: <Redo2Icon />, label: 'Redo', disabled: !s.redo, run: () => chain().redo().run() },
  ];
  const format: Tool[] = [
    { name: 'bold', icon: <BoldIcon />, label: 'Bold', active: s.bold, run: () => chain().toggleBold().run() },
    { name: 'italic', icon: <ItalicIcon />, label: 'Italic', active: s.italic, run: () => chain().toggleItalic().run() },
    ...own('format'),
    { name: 'code', icon: <CodeIcon />, label: 'Code', active: s.code, run: () => chain().toggleCode().run() },
  ];
  const blocks: Tool[] = [
    { name: 'bullet', icon: <ListIcon />, label: 'Bullet list', active: s.bullet, run: () => chain().toggleBulletList().run() },
    { name: 'ordered', icon: <ListOrderedIcon />, label: 'Numbered list', active: s.ordered, run: () => chain().toggleOrderedList().run() },
    ...own('block'),
  ];
  const rest = own(undefined);

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 rounded-t-[5px] border-b border-mnml-line bg-mnml-panel p-1">
      {buttons(history)}
      <Divider />
      <BlockMenu
        levels={levels}
        quote={hasQuote}
        current={s.quote ? 'quote' : s.heading}
        onPick={(style) => {
          if (style === 'quote') {
            if (!s.quote) chain().setBlockquote().run();
            return;
          }
          // Paragraphs and headings leave the quote they are in.
          const c = s.quote ? chain().unsetBlockquote() : chain();
          (style ? c.setHeading({ level: style }) : c.setParagraph()).run();
        }}
      />
      <Divider />
      {buttons(format)}
      <Divider />
      {buttons(blocks)}
      <Divider />
      <ToolButton name="link" icon={<LinkIcon />} label="Link" active={s.link} run={setLink} />
      <label title="Image" className="mnml-state flex size-7 cursor-pointer items-center justify-center rounded-[6px] text-mnml-text-soft">
        <ImageIcon className="size-4" />
        <input
          type="file"
          aria-label="Image"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) addImage(f);
          }}
        />
      </label>
      {buttons(own('insert'))}
      {rest.length > 0 && (
        <>
          <Divider />
          {buttons(rest)}
        </>
      )}
      {s.imageAlt !== null && (
        <input
          aria-label="Image alt text"
          placeholder="Alt text: describe the selected image (leave empty only if decorative)"
          maxLength={300}
          className="ml-1 min-w-48 flex-1 rounded-[6px] border border-mnml-line bg-mnml-bg px-2 text-xs focus:border-mnml-primary focus:outline-none"
          value={s.imageAlt}
          // No focus() here: it would pull the cursor out of this input on every keystroke.
          onChange={(e) => editor.chain().updateAttributes('image', { alt: e.target.value }).run()}
        />
      )}
    </div>
  );
}

function ToolButton({ icon, label, active, disabled, run }: { name: string; icon: React.ReactNode; label: string; active?: boolean; disabled?: boolean; run: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={run}
      className={`flex size-7 items-center justify-center rounded-[6px] disabled:opacity-40 [&_svg]:size-4 ${active ? 'bg-mnml-surface text-mnml-text' : 'mnml-state text-mnml-text-soft'}`}
    >
      {icon}
    </button>
  );
}

// Inline styles: --mnml-line is too faint on the toolbar, and this shows even before the host's Tailwind rescans.
const Divider = () => (
  <span
    aria-hidden
    style={{ width: 1, height: 18, margin: '0 6px', flexShrink: 0, background: 'color-mix(in srgb, var(--mnml-text-mute) 45%, transparent)' }}
  />
);

type Level = 1 | 2 | 3 | 4 | 5 | 6;
const headingIcons = { 1: Heading1Icon, 2: Heading2Icon, 3: Heading3Icon, 4: Heading4Icon, 5: Heading5Icon, 6: Heading6Icon };

type BlockStyle = Level | 0 | 'quote';

/** One button for the block type: Paragraph, a heading level or Quote, showing the current one. */
function BlockMenu({ levels, quote, current, onPick }: { levels: Level[]; quote: boolean; current: BlockStyle; onPick: (style: BlockStyle) => void }) {
  const { open, setOpen, root } = useMenu();
  const options: { style: BlockStyle; label: string; Icon: typeof HeadingIcon }[] = [
    { style: 0, label: 'Paragraph', Icon: PilcrowIcon },
    ...levels.map((level) => ({ style: level, label: `Heading ${level}`, Icon: headingIcons[level] })),
    ...(quote ? [{ style: 'quote' as const, label: 'Quote', Icon: QuoteIcon }] : []),
  ];
  const selected = options.find((o) => o.style === current) ?? options[0];
  const Current = current ? selected.Icon : HeadingIcon;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        title="Text style"
        aria-label={`Text style: ${selected.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`flex h-7 items-center gap-0.5 rounded-[6px] px-1.5 [&>svg:first-child]:size-4 ${current ? 'bg-mnml-surface text-mnml-text' : 'mnml-state text-mnml-text-soft'}`}
      >
        <Current />
        <ChevronDownIcon className="size-3" />
      </button>
      <div role="menu" hidden={!open} className="absolute left-0 top-full z-20 mt-1 w-40 rounded-[8px] border border-mnml-line bg-mnml-bg p-1 shadow-lg">
        {options.map(({ style, label, Icon }) => (
          <button
            key={style}
            type="button"
            role="menuitemradio"
            aria-checked={current === style}
            onClick={() => {
              setOpen(false);
              onPick(style);
            }}
            className={`${menuItemClass} ${current === style ? 'bg-mnml-surface' : ''}`}
          >
            <Icon /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}
