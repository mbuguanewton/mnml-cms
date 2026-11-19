import { useMDXComponents as getThemeComponents } from 'nextra-theme-docs';
import type { MDXComponents } from 'nextra/mdx-components';
import { CodeBlock } from './components/code-block';
import { Table } from './components/table';

const themeComponents = getThemeComponents({
  pre: CodeBlock,
  table: Table,
  // Plain cells: the look comes from .docs-table in app/docs.css.
  tr: (props) => <tr {...props} />,
  th: (props) => <th {...props} />,
  td: (props) => <td {...props} />,
});

export function useMDXComponents(components?: MDXComponents) {
  return { ...themeComponents, ...components };
}
