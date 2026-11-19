import type { ComponentProps } from 'react';

/** A table in the same frame as code blocks: the header row on the frame, the rows on a rounded panel. */
export function Table(props: ComponentProps<'table'>) {
  return (
    <div className="docs-table">
      <table {...props} />
    </div>
  );
}
