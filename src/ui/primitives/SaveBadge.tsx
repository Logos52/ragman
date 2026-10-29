import './SaveBadge.css';

export interface SaveBadgeProps {
  state: 'saved' | 'saving' | 'dirty' | 'error';
  onRetry?: () => void;
}

/** Footer save state: nothing when saved, SAVING (also while dirty), NOT SAVED · RETRY on error. */
export function SaveBadge({ state, onRetry }: SaveBadgeProps) {
  if (state === 'saved') return null;
  if (state === 'error') {
    return (
      <span className="rg-save rg-save--error" role="status">
        Not saved ·{' '}
        <button type="button" className="rg-save__retry" onClick={onRetry}>Retry</button>
      </span>
    );
  }
  return <span className="rg-save rg-save--saving" role="status">Saving</span>;
}
