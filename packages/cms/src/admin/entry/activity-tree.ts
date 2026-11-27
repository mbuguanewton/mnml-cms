import type { ActivityAction, ActivityEvent } from '../../api.js';

/** What each action reads as in the tree. */
export const actionLabels: Record<ActivityAction, string> = {
  create: 'Created',
  update: 'Saved',
  autosave: 'Autosaved',
  draft: 'Saved a draft',
  publish: 'Published',
  unpublish: 'Unpublished',
  discard: 'Discarded changes',
  delete: 'Deleted',
  request: 'Asked for approval',
  reject: 'Rejected a request',
  assistant: 'Used the assistant',
};

/** `2026-11-27` in the viewer's time zone: the key of a day node. */
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** A day node's title: Today, Yesterday, or the date. */
export function dayLabel(d: Date, now = new Date()): string {
  if (dayKey(d) === dayKey(now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

export type ActivityDay = { label: string; events: ActivityEvent[] };

/** Puts events (newest first) under a node for each day, keeping their order. */
export function groupByDay(events: ActivityEvent[], now = new Date()): ActivityDay[] {
  const days: (ActivityDay & { key: string })[] = [];
  for (const e of events) {
    const d = new Date(e.at);
    if (Number.isNaN(d.getTime())) continue;
    const key = dayKey(d);
    const day = days.find((x) => x.key === key);
    if (day) day.events.push(e);
    else days.push({ key, label: dayLabel(d, now), events: [e] });
  }
  return days;
}

/** A value shortened for one line of the tree. */
export function brief(v: unknown, max = 160): string {
  const text = typeof v === 'string' ? v : (JSON.stringify(v) ?? '');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
