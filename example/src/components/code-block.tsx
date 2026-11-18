import type { RichTextNodeProps } from '@n3wtou/mnml-cms/editor';

/** Rich-text code blocks with a language caption (wired up in mnml-editor.ts, rendered by <RichText>). */
export function CodeBlock({ attrs, children }: RichTextNodeProps) {
  const language = typeof attrs.language === 'string' ? attrs.language : null;
  return (
    <figure className="code-block">
      {language && <figcaption>{language}</figcaption>}
      <pre>
        <code>{children}</code>
      </pre>
    </figure>
  );
}
