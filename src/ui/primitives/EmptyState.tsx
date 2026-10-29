import type { ReactNode } from 'react';
import './EmptyState.css';

export interface EmptyStateProps {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
}

/** Centered message for an empty view; the action (e.g. the Add button) is the prominent thing. */
export function EmptyState({ title, hint, action }: EmptyStateProps) {
  return (
    <div className="rg-empty">
      <div className="rg-empty__title">{title}</div>
      {hint || action ? (
        <div className="rg-empty__more">
          {hint ? <div className="rg-empty__hint">{hint}</div> : null}
          {action ? <div className="rg-empty__action">{action}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

/** v1 placeholder tab: the tab's name and "Coming later", centered in --ink-3, nothing else. */
export function ComingLater({ name }: { name: string }) {
  return (
    <div className="rg-later">
      <div className="rg-later__name">{name}</div>
      <div className="rg-later__text">Coming later</div>
    </div>
  );
}
