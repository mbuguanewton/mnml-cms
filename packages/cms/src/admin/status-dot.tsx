export type DotState = 'published' | 'draft' | 'changes';

export const dotLabels: Record<DotState, string> = {
  published: 'Published',
  draft: 'Draft',
  changes: 'Published, with unpublished changes',
};

// Green: live. Grey: draft. Orange over green: live, with saved changes that aren't published yet.
// Inline styles on purpose: the dot must show even if the host's CSS hasn't picked up new classes yet.
const GREY = 'var(--cms-text-mute, #78716c)';
const ORANGE = 'var(--cms-pending, #f59e0b)';
const GREEN = 'var(--cms-success, #16a34a)';
const background: Record<DotState, string> = {
  published: GREEN,
  draft: GREY,
  changes: `linear-gradient(to bottom, ${ORANGE} 50%, ${GREEN} 50%)`,
};

export function StatusDot({ state, className = '' }: { state: DotState; className?: string }) {
  return (
    <span
      role="img"
      aria-label={dotLabels[state]}
      title={dotLabels[state]}
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{ width: 11, height: 11, background: background[state] }}
    />
  );
}
