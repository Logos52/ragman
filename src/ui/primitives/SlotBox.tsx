import type { HTMLAttributes, ReactNode } from 'react';
import { Glyph } from './glyphs';
import { LabelTab } from './LabelTab';
import './SlotBox.css';

export interface SlotBoxProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  label: string;
  /** Glyph name drawn faintly when the box is empty (see glyphs.tsx). */
  glyph: string;
  /** An item tile; fills the box. */
  children?: ReactNode;
  highlight?: 'ok' | 'bad' | null;
  selected?: boolean;
  /** Box size in cells (default 1 x 1). */
  cells?: [number, number];
  /** Small text in the top-left corner (Quick Use digits). */
  corner?: string;
}

/** A 1-cell square slot box with its label tab above the top-left edge. */
export function SlotBox({ label, glyph, children, highlight = null, selected, cells = [1, 1], corner, className, style, ...rest }: SlotBoxProps) {
  const filled = children != null && children !== false;
  const cls = [
    'rg-slot',
    filled ? 'rg-slot--filled' : 'rg-slot--empty',
    highlight ? `rg-slot--${highlight}` : '',
    selected ? 'rg-slot--selected' : '',
    corner ? 'rg-slot--corner' : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  return (
    <div className={cls} style={style} {...rest}>
      {label ? <LabelTab>{label}</LabelTab> : null}
      <div
        className="rg-slot__box"
        style={{ width: `calc(var(--cell) * ${cells[0]})`, height: `calc(var(--cell) * ${cells[1]})` }}
      >
        {filled ? children : glyph ? <Glyph name={glyph} className="rg-slot__glyph" /> : null}
        {corner ? <span className="rg-slot__corner">{corner}</span> : null}
        {highlight ? <span className="rg-slot__hl" aria-hidden /> : null}
      </div>
    </div>
  );
}
