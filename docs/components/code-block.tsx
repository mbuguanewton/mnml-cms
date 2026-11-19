import type { ComponentProps, FC, ReactNode } from 'react';
import { withIcons } from 'nextra/components';
import { CopyButton } from './copy-button';

const LANGUAGES: Record<string, string> = {
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  js: 'JavaScript',
  jsx: 'JSX',
  sh: 'Shell',
  bash: 'Shell',
  sql: 'SQL',
  prisma: 'Prisma',
  css: 'CSS',
  json: 'JSON',
  plaintext: 'Text',
};

type Props = ComponentProps<'pre'> & {
  'data-language'?: string;
  'data-filename'?: string;
  /** The language's icon, from Nextra's withIcons. */
  icon?: ReactNode;
};

/** A code block: a frame with the language (or file name) and a copy button, around a panel that wraps long lines. */
function CodeBlockBase({ children, className, 'data-language': language = 'plaintext', 'data-filename': filename, icon, ...props }: Props) {
  // Nextra's own data-* props (copy, word wrap) are handled here, so they aren't passed on.
  const rest = Object.fromEntries(Object.entries(props).filter(([k]) => !k.startsWith('data-') || k === 'data-pagefind-ignore'));
  const label: ReactNode = filename ?? LANGUAGES[language] ?? language;
  return (
    <div className="docs-code not-prose">
      <div className="docs-code-header">
        {icon}
        <span className="docs-code-label">{label}</span>
        <CopyButton />
      </div>
      <pre className={['docs-code-panel', className].filter(Boolean).join(' ')} {...rest}>
        {children}
      </pre>
    </div>
  );
}

export const CodeBlock = withIcons(CodeBlockBase as FC<ComponentProps<'pre'>>);
