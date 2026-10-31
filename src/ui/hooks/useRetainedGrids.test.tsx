import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GridRef } from '../../model/types';
import { useRetainedGrids } from './useRetainedGrids';

const stash = (location: string): GridRef => ({ kind: 'stash', location });

describe('useRetainedGrids follows the stash tabs', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('adds a grid for a new tab, swaps the key on a rename, and unmounts a removed tab', () => {
    const { result, rerender } = renderHook(({ locations, active }) => useRetainedGrids(locations, active), {
      initialProps: { locations: ['USA', 'Vietnam'], active: stash('USA') },
    });
    expect(result.current.map((g) => g.key)).toEqual(['stash:USA']);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.map((g) => g.key)).toEqual(['stash:USA', 'stash:Vietnam', 'archive']);

    rerender({ locations: ['USA', 'Vietnam', 'Storage'], active: stash('USA') });
    expect(result.current.map((g) => g.key)).toEqual(['stash:USA', 'stash:Vietnam', 'stash:Storage', 'archive']);

    rerender({ locations: ['Home', 'Vietnam', 'Storage'], active: stash('Home') });
    expect(result.current.map((g) => g.key)).toEqual(['stash:Home', 'stash:Vietnam', 'stash:Storage', 'archive']);
    expect(result.current[0]).toMatchObject({ active: true, ref: { kind: 'stash', location: 'Home' } });

    rerender({ locations: ['Home', 'Vietnam'], active: stash('Home') });
    expect(result.current.map((g) => g.key)).toEqual(['stash:Home', 'stash:Vietnam', 'archive']);

    // one render where the store still names a removed tab: it is shown, never retained
    rerender({ locations: ['Home'], active: stash('Vietnam') });
    expect(result.current.map((g) => g.key)).toEqual(['stash:Vietnam', 'stash:Home', 'archive']);
    rerender({ locations: ['Home'], active: stash('Home') });
    expect(result.current.map((g) => g.key)).toEqual(['stash:Home', 'archive']);
  });
});
