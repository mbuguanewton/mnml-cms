export type DotState = 'published' | 'draft' | 'changes';

export const dotLabels: Record<DotState, string> = {
  published: 'Published',
  draft: 'Draft',
  changes: 'Published, with unpublished changes',
};

// Green: live. Grey: draft. Orange over green: live, with saved changes that aren't published yet.
// Inline styles on purpose: the dot must show even if the host's CSS hasn't picked up new classes yet.
const GREY = 'var(--mnml-text-mute, #78716c)';
const ORANGE = 'var(--mnml-pending, #f59e0b)';
const GREEN = 'var(--mnml-success, #16a34a)';
const background: Record<DotState, string> = {
  published: GREEN,
  draft: GREY,
  changes: `linear-gradient(to bottom, ${ORANGE} 50%, ${GREEN} 50%)`,
};

/** `focusable`: reachable with Tab, for a Tooltip around a dot that has no text next to it. */
export function StatusDot({ state, focusable, className = '' }: { state: DotState; focusable?: boolean; className?: string }) {
  return (
    <span
      role="img"
      aria-label={dotLabels[state]}
      tabIndex={focusable ? 0 : undefined}
      className={`inline-block shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-mnml-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-mnml-bg ${className}`}
      style={{ width: 11, height: 11, background: background[state] }}
    />
  );
}
