import type { ReactNode } from 'react';
import './Banner.css';

export interface BannerProps {
  tone: 'bad' | 'info';
  children: ReactNode;
  /** e.g. <Button size="sm">Choose folder</Button>, drawn after the message with a "·". */
  action?: ReactNode;
}

/** Inline banner under the tab bar. The rest of the screen stays drawn and interactive. */
export function Banner({ tone, children, action }: BannerProps) {
  return (
    <div className={`rg-banner rg-banner--${tone}`} role={tone === 'bad' ? 'alert' : 'status'}>
      <span className="rg-banner__msg">{children}</span>
      {action ? <span className="rg-banner__action">{action}</span> : null}
    </div>
  );
}
