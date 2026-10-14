// Brings StarterKit's commands (toggleBold, toggleUnderline…) into `Editor` for the site's tools.
/// <reference types="@tiptap/starter-kit" preserve="true" />
import type { ReactNode } from 'react';
import type { Editor, Extensions } from '@tiptap/core';

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

/** Extra Tiptap extensions and toolbar buttons for every rich-text field. */
export type EditorConfig = {
  /** Added after the defaults (StarterKit + Image), or a function that gets the defaults and returns the full list. */
  extensions?: Extensions | ((defaults: Extensions) => Extensions);
  /** Buttons shown after the built-in ones. */
  tools?: EditorTool[];
};

/** Types the editor config. Import the result in both the client provider and `<RichText editor>`. */
export const defineEditor = (config: EditorConfig) => config;
