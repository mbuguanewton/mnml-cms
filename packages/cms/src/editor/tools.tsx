import type { Attribute } from '@tiptap/core';
import { MinusIcon, StrikethroughIcon, UnderlineIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { emptyValue, fields as f, type EntryOf } from '../schema/define.js';
import { displayText } from '../schema/text.js';
import type { Editor } from '@tiptap/core';
import type { EditorTool, NodeFormConfig, NodeFormField, NodeFormFields, ToolContext } from './config.js';

// Buttons for marks and nodes StarterKit already has in the schema, so they need no extra extension.
const builtins = {
  underline: {
    name: 'underline',
    builtIn: true,
    label: 'Underline',
    group: 'format',
    icon: <UnderlineIcon />,
    isActive: (e) => e.isActive('underline'),
    run: (e) => e.chain().focus().toggleUnderline().run(),
  },
  strike: {
    name: 'strike',
    builtIn: true,
    label: 'Strikethrough',
    group: 'format',
    icon: <StrikethroughIcon />,
    isActive: (e) => e.isActive('strike'),
    run: (e) => e.chain().focus().toggleStrike().run(),
  },
  horizontalRule: {
    name: 'horizontalRule',
    builtIn: true,
    label: 'Horizontal rule',
    group: 'insert',
    icon: <MinusIcon />,
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
} satisfies Record<string, EditorTool>;

export type NodeToolOptions<F extends NodeFormFields> = {
  /** The node's name, as in its extension (`Node.create({ name })`). Use `nodeAttributes(fields)` for its attributes. */
  name: string;
  label: string;
  icon: ReactNode;
  group?: EditorTool['group'];
  fields: F;
  /** Dialog title. Default: the label. */
  title?: string;
  /** One line about the node for its card in the editor, e.g. `(a) => a.url`. */
  preview?: (attrs: EntryOf<F>) => string;
};

/** The tool `tools.node()` returns: an `EditorTool` whose `run` can be awaited. */
export type NodeTool = Omit<EditorTool, 'run' | 'nodeForm'> & { run: (editor: Editor, admin: ToolContext) => Promise<void>; nodeForm: NodeFormConfig };

/**
 * A button that asks for the node's values in a form, then inserts it. In the admin the node shows as a card;
 * double-click it (or its Edit button) to change the values.
 */
function node<F extends NodeFormFields>(o: NodeToolOptions<F>): NodeTool {
  const title = o.title ?? o.label;
  return {
    name: `node:${o.name}`,
    label: o.label,
    icon: o.icon,
    group: o.group,
    isActive: (e) => e.isActive(o.name),
    run: async (editor, { form }) => {
      const attrs = await form({ title, fields: o.fields, submitLabel: 'Insert' });
      if (attrs) editor.chain().focus().insertContent({ type: o.name, attrs }).run();
    },
    nodeForm: {
      name: o.name,
      label: o.label,
      icon: o.icon,
      title,
      fields: o.fields,
      preview: o.preview as ((attrs: Record<string, unknown>) => string) | undefined,
    },
  };
}

export type ReferenceToolOptions = {
  /** The node's name, as in its extension (`referenceNode({ name })`). */
  name: string;
  label: string;
  icon: ReactNode;
  /** The collection to pick from (published entries only). */
  collection: string;
  group?: EditorTool['group'];
  /** Dialog title. Default: the label. */
  title?: string;
};

/**
 * A button that picks a published entry of `collection` and inserts `{ type: name, attrs: { collection, slug } }`.
 * Use with a `referenceNode({ name })` extension. In the admin the node shows as a card with the entry's title.
 */
function reference(o: ReferenceToolOptions): NodeTool {
  const tool = node({
    name: o.name,
    label: o.label,
    icon: o.icon,
    group: o.group,
    title: o.title,
    fields: { slug: f.reference(o.label, o.collection, { required: true }) },
  });
  return {
    ...tool,
    run: async (editor, { form }) => {
      const picked = await form({ title: tool.nodeForm.title, fields: tool.nodeForm.fields, submitLabel: 'Insert' });
      if (picked)
        editor
          .chain()
          .focus()
          .insertContent({ type: o.name, attrs: { collection: o.collection, slug: picked.slug } })
          .run();
    },
  };
}

export const tools = { ...builtins, node, reference };

const dataName = (key: string) => `data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

function fromHTML(f: NodeFormField, raw: string | null): unknown {
  if (raw === null) return emptyValue(f);
  if (f.type === 'boolean') return raw === 'true';
  if (f.type === 'number') {
    const n = Number(raw);
    return raw.trim() === '' || Number.isNaN(n) ? null : n;
  }
  if (f.type === 'select') return f.options.includes(raw) ? raw : null;
  return raw;
}

/**
 * Tiptap attributes for a node whose values come from a form: `addAttributes: () => nodeAttributes(fields)`.
 * Each starts at its field's empty value and is kept in HTML as `data-<name>` (camelCase becomes kebab-case).
 */
export function nodeAttributes(fields: NodeFormFields): Record<string, Attribute> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, f]): [string, Attribute] => [
      key,
      {
        default: emptyValue(f),
        parseHTML: (el) => fromHTML(f, el.getAttribute(dataName(key))),
        renderHTML: (attrs) => {
          const v = displayText(attrs[key]);
          return v === '' ? {} : { [dataName(key)]: v };
        },
      },
    ]),
  );
}
