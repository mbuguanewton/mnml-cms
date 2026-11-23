// The collection list's bulk actions: which ones a selection can use, and what to ask or say. Pure, so it is tested.

/** What a row's status cell shows. */
export type RowStatus = 'draft' | 'changes' | 'published';
export type RowAction = { name: string; label: string; danger?: boolean; confirm?: string };

/** The built-in actions, in the order the bar shows them. A site's own come after. */
export const BUILT_IN: RowAction[] = [
  { name: 'publish', label: 'Publish' },
  { name: 'unpublish', label: 'Unpublish', confirm: 'They leave the site and become drafts.' },
  { name: 'delete', label: 'Delete', danger: true },
];

/** Whether an action does anything to an entry in this state. A site's own actions apply to every entry. */
export const applies = (action: string, status: RowStatus) =>
  action === 'publish' ? status !== 'published' : action === 'unpublish' ? status !== 'draft' : true;

/** The confirmation for an action on `n` entries (`published` of them live), or null when it runs without asking. */
export function confirmation(action: RowAction, n: number, published: number): { title: string; description: string } | null {
  const things = `${n} ${n === 1 ? 'entry' : 'entries'}`;
  if (action.name === 'publish') return null;
  if (action.name === 'delete') {
    return {
      title: `Delete ${things}?`,
      description:
        published > 0
          ? `${published} of them ${published === 1 ? 'is' : 'are'} published and will disappear from the site. This cannot be undone.`
          : 'This cannot be undone.',
    };
  }
  return action.confirm ? { title: `${action.label} ${things}?`, description: action.confirm } : null;
}

const PAST: Record<string, string> = { publish: 'Published', unpublish: 'Unpublished', delete: 'Deleted' };

/** The toast after a bulk action, e.g. "Published 3 entries · 1 skipped". */
export function summary(action: RowAction, r: { done: number; skipped: number; failed: number }): string {
  const verb = PAST[action.name] ?? action.label;
  const parts = [
    r.done > 0 ? `${verb} ${r.done} ${r.done === 1 ? 'entry' : 'entries'}` : 'Nothing changed',
    r.skipped > 0 ? `${r.skipped} skipped` : '',
    r.failed > 0 ? `${r.failed} failed` : '',
  ];
  return parts.filter(Boolean).join(' · ');
}
