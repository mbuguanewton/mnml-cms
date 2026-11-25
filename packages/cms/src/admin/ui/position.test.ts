import { describe, expect, it } from 'vite-plus/test';
import { placeVertically } from './position.js';

// Gap 4 and edge 8: the room below an anchor ending at 300 in a 600 window is 600 - 300 - 4 - 8 = 288.
const anchor = { top: 280, bottom: 300 };

describe('placeVertically', () => {
  it('goes below the anchor when it fits', () => {
    expect(placeVertically({ anchor, height: 200, viewport: 600 })).toEqual({ top: 304 });
  });

  it('flips above when it does not fit below but fits above', () => {
    expect(placeVertically({ anchor, height: 250, viewport: 400 })).toEqual({ top: 280 - 4 - 250 });
  });

  it('prefers the side with more room when it fits on neither', () => {
    expect(placeVertically({ anchor: { top: 400, bottom: 420 }, height: 900, viewport: 600 }).top).toBeLessThan(400);
    expect(placeVertically({ anchor: { top: 40, bottom: 60 }, height: 900, viewport: 600 }).top).toBe(64);
  });

  it('honours side: top, and flips below when there is no room above', () => {
    expect(placeVertically({ anchor, height: 100, viewport: 600, side: 'top' })).toEqual({ top: 280 - 4 - 100 });
    expect(placeVertically({ anchor: { top: 50, bottom: 70 }, height: 100, viewport: 600, side: 'top' })).toEqual({ top: 74 });
  });

  it('with fit, caps the height to the room on the roomier side', () => {
    expect(placeVertically({ anchor: { top: 40, bottom: 60 }, height: 900, viewport: 600, fit: true })).toEqual({ top: 64, maxHeight: 528 });
    // Above the anchor: the capped box ends 4px over it.
    expect(placeVertically({ anchor: { top: 500, bottom: 520 }, height: 900, viewport: 600, fit: true })).toEqual({ top: 8, maxHeight: 488 });
  });

  it('without fit, never caps, and never goes above the window edge', () => {
    expect(placeVertically({ anchor: { top: 100, bottom: 120 }, height: 900, viewport: 600 })).toEqual({ top: 124 });
    expect(placeVertically({ anchor: { top: 300, bottom: 320 }, height: 400, viewport: 400 })).toEqual({ top: 8 });
  });

  it('with fit, leaves a box that fits alone', () => {
    expect(placeVertically({ anchor, height: 200, viewport: 600, fit: true })).toEqual({ top: 304 });
  });
});
