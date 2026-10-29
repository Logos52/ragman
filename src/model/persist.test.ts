import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Saver } from './persist';
import { fixture } from './test/fixture';
import type { SaveState } from './types';

describe('Saver', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('debounces 500 ms, coalesces, never has two writes in flight', async () => {
    const inv = fixture();
    const writes: string[] = [];
    let inFlight = 0, maxInFlight = 0;
    const release: (() => void)[] = [];
    const write = (t: string) => new Promise<void>((res) => {
      writes.push(t); inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      release.push(() => { inFlight--; res(); });
    });
    const states: SaveState[] = [];
    const s = new Saver(write, () => inv, (st) => states.push(st));

    s.schedule(); s.schedule(); s.schedule();
    await vi.advanceTimersByTimeAsync(499);
    expect(writes).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(writes).toHaveLength(1);
    expect(writes[0].endsWith('}\n')).toBe(true);

    s.schedule(); // during the write
    await vi.advanceTimersByTimeAsync(600);
    expect(writes).toHaveLength(1); // still waiting on the first
    release.shift()!();
    await vi.advanceTimersByTimeAsync(0);
    expect(writes).toHaveLength(2);
    release.shift()!();
    await vi.advanceTimersByTimeAsync(0);
    expect(maxInFlight).toBe(1);
    expect(states[0]).toBe('dirty');
    expect(states).toContain('saving');
    expect(states[states.length - 1]).toBe('saved');
  });

  it('error state, then retry with flush(true)', async () => {
    let fail = true;
    const states: SaveState[] = [];
    const s = new Saver(async () => { if (fail) throw new Error('boom'); }, () => fixture(), (st) => states.push(st));
    s.schedule();
    await vi.advanceTimersByTimeAsync(500);
    expect(states[states.length - 1]).toBe('error');
    fail = false;
    await s.flush(true);
    expect(states[states.length - 1]).toBe('saved');
  });
});
