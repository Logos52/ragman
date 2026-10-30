import './SaveBadge.css';
import type { SyncState } from '../../model/types';

export interface SyncBadgeProps {
  state: SyncState;
  at: string | null;      // ISO time of the last successful sync
  message: string | null; // the error text, or "conflict: pull by hand"
  onRetry?: () => void;
}

/** Local HH:MM of an ISO time; '' when there is none. */
function hhmm(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Footer sync state, right of the save badge: nothing when off or idle, SYNCED 12:04, PUSHING,
 * PUSH FAILED · RETRY, CONFLICT · PULL BY HAND. While a sync waits for its quiet period the last
 * SYNCED time stays (nothing before the first sync).
 */
export function SyncBadge({ state, at, message, onRetry }: SyncBadgeProps) {
  if (state === 'syncing') return <span className="rg-save rg-save--saving" role="status">Pushing</span>;
  if (state === 'error' && message?.startsWith('conflict')) {
    return <span className="rg-save rg-save--error" role="status" title={message}>Conflict · pull by hand</span>;
  }
  if (state === 'error') {
    return (
      <span className="rg-save rg-save--error" role="status" title={message ?? undefined}>
        Push failed ·{' '}
        <button type="button" className="rg-save__retry" onClick={onRetry}>Retry</button>
      </span>
    );
  }
  const t = state === 'synced' || state === 'pending' ? hhmm(at) : '';
  return t ? <span className="rg-save rg-save--saving" role="status">Synced {t}</span> : null;
}
