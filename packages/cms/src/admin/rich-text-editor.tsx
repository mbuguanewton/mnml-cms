'use client';

import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import {
  BoldIcon,
  CodeIcon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  Redo2Icon,
  Undo2Icon,
} from 'lucide-react';
import { extensions } from '../rich-text.js';
import { useAdmin } from './context.js';
import { uploadImage } from './upload.js';

export function RichTextEditor({ value, onChange, invalid }: { value: JSONContent; onChange: (v: JSONContent) => void; invalid?: boolean }) {
  const editor = useEditor({
    extensions,
    content: value,
    // Render on the client only, otherwise SSR and hydration disagree.
    immediatelyRender: false,
    editorProps: { attributes: { class: 'cms-prose min-h-48 px-3 py-2.5 focus:outline-none' } },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  return (
    <div aria-invalid={invalid} className="overflow-hidden rounded-[6px] border border-cms-line bg-cms-bg focus-within:border-cms-primary focus-within:ring-2 focus-within:ring-cms-primary/20 aria-invalid:border-cms-danger">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const { apiPath, alert } = useAdmin();
  const s = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
      bullet: editor.isActive('bulletList'),
      ordered: editor.isActive('orderedList'),
      quote: editor.isActive('blockquote'),
      code: editor.isActive('code'),
      link: editor.isActive('link'),
      // Alt text of the selected image, or null when no image is selected.
      imageAlt: editor.isActive('image') ? ((editor.getAttributes('image').alt as string | null) ?? '') : null,
      undo: editor.can().undo(),
      redo: editor.can().redo(),
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

  const tools = [
    { icon: BoldIcon, label: 'Bold', active: s.bold, run: () => chain().toggleBold().run() },
    { icon: ItalicIcon, label: 'Italic', active: s.italic, run: () => chain().toggleItalic().run() },
    { icon: Heading2Icon, label: 'Heading', active: s.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
    { icon: Heading3Icon, label: 'Subheading', active: s.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
    { icon: ListIcon, label: 'Bullet list', active: s.bullet, run: () => chain().toggleBulletList().run() },
    { icon: ListOrderedIcon, label: 'Numbered list', active: s.ordered, run: () => chain().toggleOrderedList().run() },
    { icon: QuoteIcon, label: 'Quote', active: s.quote, run: () => chain().toggleBlockquote().run() },
    { icon: CodeIcon, label: 'Code', active: s.code, run: () => chain().toggleCode().run() },
    { icon: LinkIcon, label: 'Link', active: s.link, run: setLink },
    { icon: Undo2Icon, label: 'Undo', active: false, disabled: !s.undo, run: () => chain().undo().run() },
    { icon: Redo2Icon, label: 'Redo', active: false, disabled: !s.redo, run: () => chain().redo().run() },
  ];

  return (
    <div className="flex flex-wrap gap-0.5 border-b border-cms-line bg-cms-panel p-1">
      {tools.map(({ icon: Icon, label, active, disabled, run }) => (
        <button
          key={label}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={run}
          className={`flex size-7 items-center justify-center rounded-[6px] disabled:opacity-40 ${active ? 'bg-cms-surface text-cms-text' : 'cms-state text-cms-text-soft'}`}
        >
          <Icon className="size-4" />
        </button>
      ))}
      <label title="Image" className="cms-state flex size-7 cursor-pointer items-center justify-center rounded-[6px] text-cms-text-soft">
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
      {s.imageAlt !== null && (
        <input
          aria-label="Image alt text"
          placeholder="Alt text: describe the selected image (leave empty only if decorative)"
          maxLength={300}
          className="ml-1 min-w-48 flex-1 rounded-[6px] border border-cms-line bg-cms-bg px-2 text-xs focus:border-cms-primary focus:outline-none"
          value={s.imageAlt}
          // No focus() here: it would pull the cursor out of this input on every keystroke.
          onChange={(e) => editor.chain().updateAttributes('image', { alt: e.target.value }).run()}
        />
      )}
    </div>
  );
}
