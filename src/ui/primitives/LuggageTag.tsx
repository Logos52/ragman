import type { CSSProperties } from 'react';
import './LuggageTag.css';

export interface LuggageTagProps {
  children: string;
  className?: string;
}

/** Small ink baggage tag with a punched hole at the left; white condensed caps. */
export function LuggageTag({ children, className }: LuggageTagProps) {
  return (
    // --ltag-n (label length) lets a narrow tile shrink the text to fit in full (Tile.css)
    <span className={className ? `rg-ltag ${className}` : 'rg-ltag'} title={children} style={{ '--ltag-n': children.length } as CSSProperties}>
      <span className="rg-ltag__text">{children}</span>
    </span>
  );
}
