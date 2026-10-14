'use client';

import { createContext, use } from 'react';
import type { EditorConfig } from '../editor.js';

const EditorConfigContext = createContext<EditorConfig | undefined>(undefined);

/** The site's editor config, or undefined when it passes no `editor` option. */
export const useEditorConfig = () => use(EditorConfigContext);

/**
 * Hands the editor config to the admin. Call it in a 'use client' file and pass the result as `editor` to `createCms`:
 *
 *   export const Editor = editorProvider(editor);
 */
export function editorProvider(config: EditorConfig) {
  return function EditorProvider({ children }: { children: React.ReactNode }) {
    return <EditorConfigContext value={config}>{children}</EditorConfigContext>;
  };
}
