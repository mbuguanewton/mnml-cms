'use client';

// Kept apart from form-dialog.tsx: that renders fields, and fields.tsx imports the rich-text editor, which needs this.
import { createContext, use } from 'react';
import type { ToolContext } from '../editor.js';

export const FormContext = createContext<ToolContext['form']>(async () => null);

/** Opens a form in the admin's dialog; resolves to the validated values, or `null` on cancel. */
export const useForm = () => use(FormContext);
