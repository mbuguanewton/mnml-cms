/**
 * A fixed-window limiter, in memory (per server instance, so a best-effort guard, not a hard quota).
 * Call it with a client key; it returns 0 when the call may go ahead, or the seconds to wait.
 */
export function createLimiter({ max, windowMs }: { max: number; windowMs: number }) {
  const hits = new Map<string, { start: number; count: number }>();
  return (key: string, now = Date.now()): number => {
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
    const h = hits.get(key);
    if (!h || now - h.start >= windowMs) {
      hits.set(key, { start: now, count: 1 });
      return 0;
    }
    if (h.count >= max) return Math.max(1, Math.ceil((h.start + windowMs - now) / 1000));
    h.count += 1;
    return 0;
  };
}
