// Brings StarterKit's commands (toggleBold, toggleUnderline…) into `Editor` for the site's tools.
/// <reference types="@tiptap/starter-kit" preserve="true" />
import type { ReactNode } from 'react';
import type { Editor, Extensions, JSONContent } from '@tiptap/core';

/** A toolbar button. `run` and the checks get the live Tiptap editor. */
export type EditorTool = {
  /** Unique among the tools; used as the React key. */
  name: string;
  /** Tooltip and accessible name. */
  label: string;
  icon: ReactNode;
  run: (editor: Editor) => void;
  /** Shows the button as pressed, e.g. `(e) => e.isActive('highlight')`. */
  isActive?: (editor: Editor) => boolean;
  disabled?: (editor: Editor) => boolean;
  /** Where it goes in the toolbar: with the text formatting (bold, italic…), the blocks (lists…) or the inserts
   *  (link, image…). Left out, it goes in a group of its own at the end. */
  group?: 'format' | 'block' | 'insert';
};

/** What a custom node renderer gets: the node as Tiptap JSON, its attributes, and its rendered content. */
export type RichTextNodeProps = {
  node: JSONContent;
  attrs: Record<string, unknown>;
  /** The node's rendered content (none for leaf nodes such as images). */
  children?: ReactNode;
};

/** React components for rich-text nodes, keyed by node name (`codeBlock`, `image`, a custom node's `name`…). */
export type RichTextComponents = Record<string, (props: RichTextNodeProps) => ReactNode>;

/** Extra Tiptap extensions and toolbar buttons for every rich-text field. */
export type EditorConfig = {
  /** Added after the defaults (StarterKit + Image), or a function that gets the defaults and returns the full list. */
  extensions?: Extensions | ((defaults: Extensions) => Extensions);
  /** Buttons shown after the built-in ones. */
  tools?: EditorTool[];
  /**
   * How `<RichText>` renders these nodes on the site; other nodes use their extension's `renderHTML`. This config is
   * also loaded by the admin's editor in the browser, so keep these to plain components: put async server
   * components (ones that load data) in `<RichText components>` instead.
   */
  components?: RichTextComponents;
};

/** Types the editor config. Import the result in both the client provider and `<RichText editor>`. */
export const defineEditor = (config: EditorConfig) => config;
