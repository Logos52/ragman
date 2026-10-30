import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { adoptInventory, getStore } from './store';
import { fixture } from './test/fixture';
import { fetchSync } from './persist';
import { SyncBadge } from '../ui/primitives/SyncBadge';
import type { SyncState } from './types';

type Reply = { state: SyncState; lastAt?: string | null; message?: string | null };

/** A fake /data server: GET/POST /data/sync answer from `next`, PUT inventory.json answers `put`. */
function fakeServer(next: () => Reply, put: () => Reply | null = () => null) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${url}`);
    if (url === '/data/sync') return new Response(JSON.stringify({ lastAt: null, message: null, ...next() }), { status: 200 });
    if (method === 'PUT') { const p = put(); return p ? new Response(JSON.stringify(p), { status: 200 }) : new Response(null, { status: 204 }); }
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}
const syncCalls = (calls: string[]) => calls.filter((c) => c.endsWith('/data/sync'));

describe('sync state in the store', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); adoptInventory(fixture()); });

  it('reads the state once on load and polls every 5 s only while pending or syncing', async () => {
    const replies: Reply[] = [{ state: 'pending' }, { state: 'syncing' }, { state: 'synced', lastAt: '2026-10-30T05:04:00.000Z' }];
    const calls = fakeServer(() => replies.shift() ?? { state: 'synced', lastAt: '2026-10-30T05:04:00.000Z' });
    adoptInventory(fixture(), { kind: 'server', base: '/data' });
    await vi.advanceTimersByTimeAsync(0);
    expect(getStore().syncState).toBe('pending');
    await vi.advanceTimersByTimeAsync(5000);
    expect(getStore().syncState).toBe('syncing');
    await vi.advanceTimersByTimeAsync(5000);
    expect(getStore().syncState).toBe('synced');
    expect(getStore().syncAt).toBe('2026-10-30T05:04:00.000Z');
    await vi.advanceTimersByTimeAsync(30000);
    expect(syncCalls(calls)).toHaveLength(3); // no polling once synced
  });

  it('takes the state from the save reply and reads once more 25 s after the save', async () => {
    const calls = fakeServer(() => ({ state: 'synced', lastAt: '2026-10-30T05:05:00.000Z' }), () => ({ state: 'synced', lastAt: '2026-10-30T05:00:00.000Z' }));
    adoptInventory(fixture(), { kind: 'server', base: '/data' });
    await vi.advanceTimersByTimeAsync(0);
    expect(syncCalls(calls)).toHaveLength(1);
    getStore().setPinned('tee', true);
    await vi.advanceTimersByTimeAsync(600); // the 500 ms save debounce
    expect(calls.some((c) => c.startsWith('PUT'))).toBe(true);
    expect(getStore().syncAt).toBe('2026-10-30T05:00:00.000Z');
    await vi.advanceTimersByTimeAsync(24000);
    expect(syncCalls(calls)).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(syncCalls(calls)).toHaveLength(2);
    expect(getStore().syncAt).toBe('2026-10-30T05:05:00.000Z');
  });

  it('sync off: no read after a save', async () => {
    const calls = fakeServer(() => ({ state: 'off', message: 'no upstream branch' }));
    adoptInventory(fixture(), { kind: 'server', base: '/data' });
    await vi.advanceTimersByTimeAsync(0);
    getStore().setPinned('tee', true);
    await vi.advanceTimersByTimeAsync(60000);
    expect(syncCalls(calls)).toHaveLength(1);
    expect(getStore().syncState).toBe('off');
  });

  it('retrySync POSTs /data/sync and takes its answer', async () => {
    let state: Reply = { state: 'error', message: 'fatal: unable to access' };
    const calls = fakeServer(() => state);
    adoptInventory(fixture(), { kind: 'server', base: '/data' });
    await vi.advanceTimersByTimeAsync(0);
    expect(getStore().syncState).toBe('error');
    state = { state: 'synced', lastAt: '2026-10-30T05:06:00.000Z' };
    await getStore().retrySync();
    expect(calls).toContain('POST /data/sync');
    expect(getStore().syncState).toBe('synced');
  });

  it('the bundled source never asks the server', async () => {
    const calls = fakeServer(() => ({ state: 'synced' }));
    adoptInventory(fixture());
    await vi.advanceTimersByTimeAsync(30000);
    expect(calls).toHaveLength(0);
    expect(getStore().syncState).toBe('off');
  });

  it('fetchSync is null when the server has no sync route', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
    expect(await fetchSync('/data')).toBeNull();
  });
});

describe('SyncBadge', () => {
  const text = (state: SyncState, at: string | null = null, message: string | null = null) =>
    render(createElement(SyncBadge, { state, at, message })).container.textContent;
  const at = new Date(2026, 9, 30, 12, 4).toISOString();

  it('draws nothing when off or idle, and nothing pending before the first sync', () => {
    expect(text('off')).toBe('');
    expect(text('idle')).toBe('');
    expect(text('pending')).toBe('');
  });
  it('SYNCED with the local time, PUSHING, PUSH FAILED · RETRY, CONFLICT · PULL BY HAND', () => {
    expect(text('synced', at)).toBe('Synced 12:04');
    expect(text('pending', at)).toBe('Synced 12:04');
    expect(text('syncing', at)).toBe('Pushing');
    expect(text('error', at, 'fatal: could not read from remote')).toBe('Push failed · Retry');
    expect(text('error', at, 'conflict: pull by hand')).toBe('Conflict · pull by hand');
  });
});
