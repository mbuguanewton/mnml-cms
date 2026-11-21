'use client';

import type { Extensions } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { PencilIcon } from 'lucide-react';
import { useRef } from 'react';
import { Tooltip } from './ui/tooltip.js';
import type { EditorTool, NodeFormConfig } from '../editor.js';
import { useAdmin } from './context.js';
import { useForm } from './form-context.js';
import { useRefLabel } from './ref-options.js';

/** The editor's card for a node from `tools.node()`: its icon, label and preview; double-click or Edit to change it. */
function NodeFormView({ node, updateAttributes, selected, config }: NodeViewProps & { config: NodeFormConfig }) {
  const form = useForm();
  const { post } = useAdmin();
  const attrs = node.attrs as Record<string, unknown>;
  // A reference node (`tools.reference()`) previews the linked entry's title.
  const ref = Object.entries(config.fields).find(([, f]) => f.type === 'reference');
  const refLabel = useRefLabel(post, ref?.[1].type === 'reference' ? ref[1].collection : undefined, ref ? attrs[ref[0]] : undefined);
  const preview = config.preview?.(attrs) ?? (ref ? refLabel : undefined);
  // One form at a time: a double-click on the Edit button also clicks it twice.
  const open = useRef(false);
  const edit = async () => {
    if (open.current) return;
    open.current = true;
    try {
      const next = await form({ title: config.title, fields: config.fields, values: attrs, submitLabel: 'Save' });
      if (next) updateAttributes(next);
    } finally {
      open.current = false;
    }
  };
  return (
    <NodeViewWrapper
      as={node.isInline ? 'span' : 'div'}
      contentEditable={false}
      data-node-form={config.name}
      onDoubleClick={() => void edit()}
      className={`my-2 inline-flex max-w-full items-center gap-2 rounded-[8px] border bg-mnml-panel px-3 py-2 align-middle text-sm [font-family:ui-sans-serif,system-ui,sans-serif] [&_svg]:size-4 ${selected ? 'border-mnml-primary ring-2 ring-mnml-primary/30' : 'border-mnml-line'}`}
    >
      <span aria-hidden className="shrink-0 text-mnml-text-soft">
        {config.icon}
      </span>
      <span className="shrink-0 font-medium">{config.label}</span>
      {preview && <span className="min-w-0 truncate text-mnml-text-mute">{preview}</span>}
      <Tooltip content="Edit">
        <button
          type="button"
          aria-label={`Edit ${config.label}`}
          onClick={() => void edit()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="mnml-state ml-1 flex size-6 shrink-0 items-center justify-center rounded-[6px] text-mnml-text-soft"
        >
          <PencilIcon />
        </button>
      </Tooltip>
    </NodeViewWrapper>
  );
}

/** Gives each node that a `tools.node()` button inserts its card view, in the admin editor only. */
export function withNodeForms(extensions: Extensions, tools: EditorTool[]): Extensions {
  const forms = new Map(tools.flatMap((t) => (t.nodeForm ? [[t.nodeForm.name, t.nodeForm] as const] : [])));
  if (forms.size === 0) return extensions;
  for (const name of forms.keys()) {
    if (!extensions.some((e) => e.type === 'node' && e.name === name)) {
      console.warn(`[mnml-cms] tools.node({ name: '${name}' }): no node extension named '${name}'. Add it to the editor's extensions.`);
    }
  }
  return extensions.map((ext) => {
    const config = ext.type === 'node' ? forms.get(ext.name) : undefined;
    if (!config) return ext;
    return ext.extend({
      addNodeView() {
        return ReactNodeViewRenderer((props: NodeViewProps) => <NodeFormView {...props} config={config} />);
      },
    });
  });
}
