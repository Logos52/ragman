import type { ReactNode } from 'react';
import './LabelTab.css';

export interface LabelTabProps {
  children: ReactNode;
  /** 'slot' (default): 11 px --ink-2 tab; 'strong': ink tab with white text (panel headers). */
  tone?: 'slot' | 'strong';
  className?: string;
}

/** The EFT-style small-caps tab that sits on the top-left edge of a box. */
export function LabelTab({ children, tone = 'slot', className }: LabelTabProps) {
  const cls = ['rg-labeltab', tone === 'strong' ? 'rg-labeltab--strong' : '', className ?? ''].filter(Boolean).join(' ');
  return <div className={cls}>{children}</div>;
}
