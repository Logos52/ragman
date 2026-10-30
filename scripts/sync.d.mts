// Types for scripts/sync.mjs (imported by vite.config.ts).
import type { IncomingMessage, ServerResponse } from 'node:http';

export type SyncStateName = 'off' | 'idle' | 'pending' | 'syncing' | 'synced' | 'error';
export interface SyncState {
  state: SyncStateName;
  lastAt: string | null;
  message: string | null;
  ahead: number;
  conflict: boolean;
}
export interface Sync {
  ready: Promise<void>;
  readonly dir: string;
  readonly delayMs: number;
  state(): SyncState;
  start(): Promise<void>;
  schedule(): void;
  syncNow(): Promise<SyncState>;
  stop(): void;
}
export const DEFAULT_DELAY_MS: number;
export const CONFLICT_MESSAGE: string;
export function createSync(opts: {
  dir: string; enabled?: boolean; offReason?: string; delayMs?: number;
  log?: (line: string) => void; now?: () => Date; host?: string;
}): Sync;
export function syncFromEnv(dir: string, env?: Record<string, string | undefined>, log?: (line: string) => void): Sync;
export function sendSyncState(res: ServerResponse, state: SyncState, status?: number): void;
export function handleSyncRoute(sync: Sync, req: IncomingMessage, res: ServerResponse): void;
export function afterPut(sync: Sync, res: ServerResponse, rel: string): void;
