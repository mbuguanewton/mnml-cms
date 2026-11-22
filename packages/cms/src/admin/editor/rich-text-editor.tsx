'use client';

import { PortalHost } from '../ui/context.js';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { Menu } from '../ui/menu.js';
import type { MenuAction } from '../ui/slots.js';
import { Tooltip } from '../ui/tooltip.js';
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
  Maximize2Icon,
  Minimize2Icon,
  PilcrowIcon,
  QuoteIcon,
  Redo2Icon,
  Undo2Icon,
} from 'lucide-react';
import { resolveExtensions } from '../../rich-text/extensions.js';
import { orderTools, type EditorTool } from '../../editor/config.js';
import { menuItemClass, useMenu } from '../shell/action-menu.js';
import { useAdmin } from '../shell/context.js';
import { useEditorConfig } from './editor-context.js';
import { useEntry } from '../entry/entry-context.js';
import { useForm } from './form-context.js';
import { withNodeForms } from './node-view.js';
import { uploadImage } from './upload.js';

export function RichTextEditor({
  value,
  onChange,
  invalid,
  label,
}: {
  value: JSONContent;
  onChange: (v: JSONContent) => void;
  invalid?: boolean;
  /** The field's label, shown in the fullscreen header. */
  label?: string;
}) {
  const config = useEditorConfig();
  const entry = useEntry();
  const extensions = useMemo(() => withNodeForms(resolveExtensions(config), config?.tools ?? noTools), [config]);
  const editor = useEditor({
    extensions,
    content: value,
    // Render on the client only, otherwise SSR and hydration disagree.
    immediatelyRender: false,
    editorProps: { attributes: { class: 'mnml-prose px-3 py-2.5 focus:outline-none' } },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  const content = useRef<HTMLDivElement>(null);
  const tools = config?.tools ?? noTools;
  // Tools with a `context` show above that node instead of in the main toolbar.
  const mainTools = useMemo(() => tools.filter((t) => !t.context), [tools]);
  const contexts = useMemo(() => [...new Set(tools.flatMap((t) => (t.context ? [t.context] : [])))], [tools]);

  // Fullscreen: the shell is a <dialog> that is always rendered as a plain block, and opened as a modal. The editor's
  // DOM never moves, so the cursor and undo history survive, and the browser makes the page behind inert.
  const shell = useRef<HTMLDialogElement>(null);
  const expand = useRef<HTMLButtonElement>(null);
  const [full, setFull] = useState(false);
  const toggleFull = () => {
    const d = shell.current;
    if (!d) return;
    if (d.open) return d.close();
    d.showModal();
    setFull(true);
    editor?.commands.focus();
  };
  useEffect(() => {
    if (!full) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
    };
  }, [full]);

  return (
    <dialog
      ref={shell}
      // Closed, it is just the field's frame; open, a fullscreen dialog named after the field.
      role={full ? undefined : 'none'}
      aria-label={full ? `${label ?? 'Rich text'}, fullscreen` : undefined}
      // ProseMirror binds Escape (select parent node) and cancels it, so the dialog's own Escape never fires from the
      // editor. Close here, unless a menu inside is open: Escape closes that first.
      onKeyDown={(e) => {
        const d = shell.current;
        if (e.key !== 'Escape' || !d?.open || d.querySelector('[aria-expanded="true"]')) return;
        e.preventDefault();
        d.close();
      }}
      onClose={() => {
        setFull(false);
        expand.current?.focus();
      }}
      className="static m-0 block h-auto w-full max-w-none border-0 bg-transparent p-0 text-inherit open:fixed open:inset-0 open:size-full open:max-h-none open:overflow-hidden open:bg-mnml-bg"
    >
      <PortalHost active={full}>
        <div
          aria-invalid={invalid}
          className={`flex flex-col bg-mnml-bg ${full ? 'h-full' : 'rounded-[6px] border border-mnml-line focus-within:border-mnml-text-mute/50 aria-invalid:border-mnml-danger'}`}
        >
          {full && (
            <div className="flex h-12 shrink-0 items-center gap-3 border-b border-mnml-line px-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-mnml-text">{entry?.title || label}</p>
                {entry?.title && label && <p className="truncate text-xs text-mnml-text-mute">{label}</p>}
              </div>
              {entry?.status}
            </div>
          )}
          {editor && (
            <Toolbar
              editor={editor}
              extra={mainTools}
              full={full}
              end={
                <Tooltip content={full ? 'Exit fullscreen' : 'Fullscreen'}>
                  <button ref={expand} type="button" aria-label={full ? 'Exit fullscreen' : 'Fullscreen'} onClick={toggleFull} className={toolClass}>
                    {full ? <Minimize2Icon /> : <Maximize2Icon />}
                  </button>
                </Tooltip>
              }
            />
          )}
          {/* Inline: a fixed height that scrolls, with a drag handle to make it taller (like a textarea). */}
          <div
            onMouseDown={(e) => {
              // A press on the empty space under the text puts the cursor at the end. Not on the scrollbar or the
              // resize corner, which need the press themselves.
              const box = e.currentTarget;
              const r = box.getBoundingClientRect();
              if (e.clientX - r.left >= box.clientWidth || (r.right - e.clientX < 16 && r.bottom - e.clientY < 16)) return;
              if (editor && !editor.view.dom.contains(e.target as Node) && (e.target as HTMLElement).closest('[role="toolbar"]') === null) {
                e.preventDefault();
                editor.commands.focus('end');
              }
            }}
            className={full ? 'min-h-0 flex-1 cursor-text overflow-y-auto' : 'h-72 min-h-32 cursor-text resize-y overflow-y-auto rounded-b-[5px]'}
          >
            <div ref={content} className={`relative ${full ? 'mx-auto w-full max-w-[70ch] px-2 py-6 [&_.mnml-prose]:min-h-[60vh]' : ''}`}>
              <EditorContent editor={editor} />
              {editor &&
                contexts.map((node) => (
                  <ContextToolbar key={node} editor={editor} node={node} tools={tools.filter((t) => t.context === node)} container={content} />
                ))}
            </div>
          </div>
        </div>
      </PortalHost>
    </dialog>
  );
}

const noTools: EditorTool[] = [];

// One toolbar entry: drawn as a button while it fits, as a menu item once it overflows into "More tools".
type Item = { key: string; group: string; pinned?: boolean; node: React.ReactNode; menu?: MenuAction };
type Tool = { name: string; icon: React.ReactNode; label: string; active?: boolean; disabled?: boolean; run: () => void };

// Layout constants for the overflow sums: the row's gap, a divider (1px + 12px margin) and the "More tools" button.
const GAP = 2;
const DIVIDER = 13 + GAP;
const MORE = 28 + GAP;

function Toolbar({ editor, extra, end, full }: { editor: Editor; extra: EditorTool[]; end: React.ReactNode; full: boolean }) {
  const { apiPath, alert, confirm } = useAdmin();
  const form = useForm();
  const file = useRef<HTMLInputElement>(null);
  // The heading extension's levels (1–4 by default; a site can change them), or none if it was removed.
  const levels = useMemo(() => (editor.extensionManager.extensions.find((e) => e.name === 'heading')?.options.levels as Level[] | undefined) ?? [], [editor]);
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
      extra: toolStates(extra, editor),
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

  const own = (group?: EditorTool['group']): Tool[] =>
    orderTools(extra)
      .filter((t) => t.group === group && s.extra[t.name]?.visible !== false)
      .map((t) => ({
        name: `extra:${t.name}`,
        icon: t.icon,
        label: t.label,
        // Only tools that can be on or off show as pressed (and as a checked menu item).
        active: t.isActive ? s.extra[t.name]?.active : undefined,
        disabled: s.extra[t.name]?.disabled,
        run: () => t.run(editor, { form, confirm, alert }),
      }));
  // In fullscreen there is room to show each tool's name next to its icon (undo and redo stay icons).
  const item =
    (group: string, pinned?: boolean, labelled = full) =>
    (t: Tool): Item => ({
      key: t.name,
      group,
      pinned,
      node: <ToolButton {...t} labelled={labelled} />,
      menu: { id: t.name, label: t.label, icon: t.icon, checked: t.active, disabled: t.disabled, onSelect: t.run },
    });

  // In toolbar order; items overflow from the end, the pinned ones (history, text style) never do.
  const items: Item[] = [
    ...[
      { name: 'undo', icon: <Undo2Icon />, label: 'Undo', disabled: !s.undo, run: () => chain().undo().run() },
      { name: 'redo', icon: <Redo2Icon />, label: 'Redo', disabled: !s.redo, run: () => chain().redo().run() },
    ].map(item('history', true, false)),
    {
      key: 'style',
      group: 'style',
      pinned: true,
      node: (
        <BlockMenu
          levels={levels}
          quote={hasQuote}
          current={s.quote ? 'quote' : s.heading}
          labelled={full}
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
      ),
    },
    ...[
      { name: 'bold', icon: <BoldIcon />, label: 'Bold', active: s.bold, run: () => chain().toggleBold().run() },
      { name: 'italic', icon: <ItalicIcon />, label: 'Italic', active: s.italic, run: () => chain().toggleItalic().run() },
      ...own('format'),
      { name: 'code', icon: <CodeIcon />, label: 'Code', active: s.code, run: () => chain().toggleCode().run() },
    ].map(item('format')),
    ...[
      { name: 'bullet', icon: <ListIcon />, label: 'Bullet list', active: s.bullet, run: () => chain().toggleBulletList().run() },
      { name: 'ordered', icon: <ListOrderedIcon />, label: 'Numbered list', active: s.ordered, run: () => chain().toggleOrderedList().run() },
      ...own('block'),
    ].map(item('block')),
    ...[
      { name: 'link', icon: <LinkIcon />, label: 'Link', active: s.link, run: setLink },
      { name: 'image', icon: <ImageIcon />, label: 'Image', run: () => file.current?.click() },
      ...own('insert'),
    ].map(item('insert')),
    ...own(undefined).map(item('rest')),
  ];

  // How many items fit: widths come from a hidden copy of the whole row, the room from the row itself.
  const row = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const endBox = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(Infinity);
  const shape = items.map((i) => `${i.group}:${i.key}`).join('|');
  useLayoutEffect(() => {
    const r = row.current;
    const m = measure.current;
    if (!r || !m) return;
    const calc = () => {
      const widths = [...m.children].map((el) => el.getBoundingClientRect().width);
      const cs = getComputedStyle(r);
      const room = r.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - (endBox.current?.offsetWidth ?? 0) - GAP;
      const groups = shape.split('|').map((k) => k.split(':')[0]);
      let used = 0;
      const ends: number[] = [];
      groups.forEach((g, i) => {
        used += widths[i] + (i > 0 ? GAP : 0) + (i > 0 && g !== groups[i - 1] ? DIVIDER : 0);
        ends.push(used);
      });
      if (used <= room) return setFit(Infinity);
      const pinned = items.filter((i) => i.pinned).length;
      let n = groups.length;
      while (n > pinned && ends[n - 1] + DIVIDER + MORE > room) n--;
      setFit(n);
    };
    calc();
    const observer = new ResizeObserver(calc);
    observer.observe(r);
    return () => observer.disconnect();
    // oxlint-disable-next-line react/exhaustive-deps
  }, [shape, full]);

  const shown = items.slice(0, fit);
  const more = items.slice(fit).flatMap((i) => (i.menu ? [i.menu] : []));

  return (
    <>
      <div
        ref={row}
        role="toolbar"
        aria-label="Formatting"
        // inline-size containment: the row takes the field's width instead of growing to fit every tool.
        className={`relative flex shrink-0 items-center gap-0.5 border-b [contain:inline-size] border-mnml-line bg-mnml-panel p-1 ${full ? '' : 'rounded-t-[5px]'}`}
      >
        {shown.map((it, i) => (
          <Fragment key={it.key}>
            {i > 0 && it.group !== shown[i - 1].group && <Divider />}
            {it.node}
          </Fragment>
        ))}
        {more.length > 0 && (
          <>
            <Divider />
            <Menu label="More tools" items={more} className={`${toolClass} aria-expanded:bg-mnml-surface aria-expanded:text-mnml-text`} />
          </>
        )}
        <div ref={endBox} className="ml-auto flex items-center">
          {end}
        </div>
        {/* A hidden copy of every item, measured to decide how many fit. */}
        <div
          ref={measure}
          aria-hidden
          inert
          className="pointer-events-none invisible absolute left-0 top-0 flex h-0 w-0 gap-0.5 overflow-hidden [&>*]:shrink-0"
        >
          {items.map((it) => (
            <div key={it.key} className="flex">
              {it.node}
            </div>
          ))}
        </div>
        <input
          ref={file}
          type="file"
          tabIndex={-1}
          aria-hidden
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void addImage(f);
          }}
        />
      </div>
      {s.imageAlt !== null && (
        <div className="flex shrink-0 items-center border-b border-mnml-line bg-mnml-panel px-1 pb-1">
          <input
            aria-label="Image alt text"
            placeholder="Alt text: describe the selected image (leave empty only if decorative)"
            maxLength={300}
            className="h-7 min-w-0 flex-1 rounded-[6px] border border-mnml-line bg-mnml-bg px-2 text-xs focus:border-mnml-primary focus:outline-none"
            value={s.imageAlt}
            // No focus() here: it would pull the cursor out of this input on every keystroke.
            onChange={(e) => editor.chain().updateAttributes('image', { alt: e.target.value }).run()}
          />
        </div>
      )}
    </>
  );
}

/** What the toolbars show for each site tool: pressed, disabled, shown. */
function toolStates(tools: EditorTool[], editor: Editor) {
  return Object.fromEntries(
    tools.map((t) => [t.name, { active: t.isActive?.(editor) ?? false, disabled: t.disabled?.(editor) ?? false, visible: t.visible?.(editor) ?? true }]),
  );
}

/** Re-renders when the element's size changes (images loading, the window resizing), so positions stay right. */
function useElementSize(el: React.RefObject<HTMLElement | null>) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const observer = new ResizeObserver(onChange);
      if (el.current) observer.observe(el.current);
      return () => observer.disconnect();
    },
    [el],
  );
  return useSyncExternalStore(
    subscribe,
    () => (el.current ? `${el.current.offsetWidth}x${el.current.offsetHeight}` : ''),
    () => '',
  );
}

/**
 * A small toolbar above the nearest `node` (e.g. a table) around the cursor, while the editor has focus: the tools
 * whose `context` is that node.
 */
function ContextToolbar({
  editor,
  node,
  tools,
  container,
}: {
  editor: Editor;
  node: string;
  tools: EditorTool[];
  container: React.RefObject<HTMLDivElement | null>;
}) {
  const { alert, confirm } = useAdmin();
  const form = useForm();
  // Where the node starts in the document (it doesn't move while typing inside it), and the tools' states.
  const s = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor.isFocused) return null;
      const { $from } = editor.state.selection;
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === node) return { pos: $from.before(d), tools: toolStates(tools, editor) };
      }
      return null;
    },
  });
  // Measured on render; the size subscription re-renders when layout shifts without an edit.
  useElementSize(container);
  const shown = s ? tools.filter((t) => s.tools[t.name]?.visible !== false) : [];
  const dom = s ? editor.view.nodeDOM(s.pos) : null;
  const box = container.current?.getBoundingClientRect();
  if (!s || shown.length === 0 || !(dom instanceof HTMLElement) || !box) return null;
  const r = dom.getBoundingClientRect();
  return (
    <div
      role="toolbar"
      aria-label={`${node[0].toUpperCase()}${node.slice(1)} tools`}
      // Clicking a button must not move the cursor out of the node.
      onMouseDown={(e) => e.preventDefault()}
      className="absolute z-10 flex items-center gap-0.5 rounded-[8px] border border-mnml-line bg-mnml-panel p-0.5 shadow-md"
      // Just above the node's right end, where a line of text above it usually ends before. At the very top it
      // overlaps the node's first line instead of the main toolbar.
      style={{ top: Math.max(2, r.top - box.top - 36), right: Math.max(2, box.right - r.right) }}
    >
      {shown.map((t) => (
        <ToolButton
          key={t.name}
          name={t.name}
          icon={t.icon}
          label={t.label}
          active={s.tools[t.name]?.active}
          disabled={s.tools[t.name]?.disabled}
          run={() => t.run(editor, { form, confirm, alert })}
        />
      ))}
    </div>
  );
}

function ToolButton({
  icon,
  label,
  active,
  disabled,
  run,
  labelled,
}: {
  name: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  run: () => void;
  /** Show the name next to the icon (fullscreen), so no tooltip is needed. */
  labelled?: boolean;
}) {
  const button = (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={run}
      className={`flex h-7 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] disabled:opacity-40 [&_svg]:size-4 ${labelled ? 'px-2 text-xs' : 'size-7'} ${active ? 'bg-mnml-surface text-mnml-text' : 'mnml-state text-mnml-text-soft'}`}
    >
      {icon}
      {labelled && label}
    </button>
  );
  return labelled ? button : <Tooltip content={label}>{button}</Tooltip>;
}

/** A tooltip, unless there is no content for it (the label is already on screen). */
const MaybeTooltip = ({ content, children }: { content: string | null; children: React.ReactElement }) =>
  content === null ? children : <Tooltip content={content}>{children}</Tooltip>;

const toolClass = 'mnml-state flex size-7 shrink-0 items-center justify-center rounded-[6px] text-mnml-text-soft [&_svg]:size-4';

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
function BlockMenu({
  levels,
  quote,
  current,
  onPick,
  labelled,
}: {
  levels: Level[];
  quote: boolean;
  current: BlockStyle;
  onPick: (style: BlockStyle) => void;
  /** Show the current style's name in the button (fullscreen). */
  labelled?: boolean;
}) {
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
      <MaybeTooltip content={labelled ? null : `Text style: ${selected.label}`}>
        <button
          type="button"
          aria-label={`Text style: ${selected.label}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          // A fixed width when labelled, so the toolbar doesn't shift (or need measuring again) as the style changes.
          className={`flex h-7 items-center gap-0.5 rounded-[6px] px-1.5 [&>svg:first-child]:size-4 ${labelled ? 'w-32 gap-1.5 text-xs' : ''} ${current ? 'bg-mnml-surface text-mnml-text' : 'mnml-state text-mnml-text-soft'}`}
        >
          <Current />
          {labelled && <span className="min-w-0 flex-1 truncate text-left">{selected.label}</span>}
          <ChevronDownIcon className="size-3 shrink-0" />
        </button>
      </MaybeTooltip>
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
