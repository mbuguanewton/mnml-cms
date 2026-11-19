// `@n3wtou/mnml-cms/table`: tables for rich text. Its own entry so sites without tables don't load the table code.
// No 'use client': the same preset works in the admin's editor and in `<RichText>` on the server.
import { TableKit } from '@tiptap/extension-table';
import {
  BetweenHorizontalEndIcon,
  BetweenVerticalEndIcon,
  PanelTopIcon,
  Table2Icon,
  TableColumnsSplitIcon,
  TableRowsSplitIcon,
  Trash2Icon,
} from 'lucide-react';
import type { Extensions } from '@tiptap/core';
import type { EditorTool } from './editor.js';

/** Insert a 3×3 table with a header row. */
const insert: EditorTool = {
  name: 'table',
  label: 'Insert table',
  group: 'insert',
  icon: <Table2Icon />,
  disabled: (e) => e.isActive('table'),
  run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
};

// Shown in a small toolbar above the table while the cursor is in it.
const rowsAndColumns: EditorTool[] = [
  { name: 'tableAddRow', label: 'Add row below', icon: <BetweenHorizontalEndIcon />, run: (e) => e.chain().focus().addRowAfter().run() },
  { name: 'tableDeleteRow', label: 'Delete row', icon: <TableRowsSplitIcon />, run: (e) => e.chain().focus().deleteRow().run() },
  { name: 'tableAddColumn', label: 'Add column after', icon: <BetweenVerticalEndIcon />, run: (e) => e.chain().focus().addColumnAfter().run() },
  { name: 'tableDeleteColumn', label: 'Delete column', icon: <TableColumnsSplitIcon />, run: (e) => e.chain().focus().deleteColumn().run() },
  {
    name: 'tableHeaderRow',
    label: 'Header row',
    icon: <PanelTopIcon />,
    isActive: (e) => e.isActive('tableHeader'),
    run: (e) => e.chain().focus().toggleHeaderRow().run(),
  },
  { name: 'tableDelete', label: 'Delete table', icon: <Trash2Icon />, run: (e) => e.chain().focus().deleteTable().run() },
];
const controls = rowsAndColumns.map((t): EditorTool => ({ ...t, context: 'table' }));

/**
 * Tables for rich text: the Tiptap table extensions (no column resizing, so the editor and `<RichText>` agree) and
 * toolbar buttons to insert a table and edit its rows and columns.
 *
 *   defineEditor({ extensions: [...tables.extensions], tools: [...tables.tools] })
 */
export const tables: { extensions: Extensions; tools: EditorTool[] } = {
  extensions: [TableKit.configure({ table: { resizable: false } })],
  tools: [insert, ...controls].map((t) => ({ ...t, builtIn: true })),
};
