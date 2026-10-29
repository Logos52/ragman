import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Glyph } from './glyphs';
import './Window.css';

export interface WindowProps {
  title: string;
  /** Position in px inside the positioned parent (the window layer). */
  x: number;
  y: number;
  z: number;
  /** Called continuously while dragging the title bar, with the new top-left. */
  onMove: (x: number, y: number) => void;
  /** Called once when a title-bar drag ends (remember the position). */
  onMoveEnd?: () => void;
  /** Called on any pointerdown inside the window (bring to front). */
  onRaise: () => void;
  onClose: () => void;
  /** Title bar right side, before the close button (the weight readout). */
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** A movable panel: 1 px ink border, 28 px ink title bar, close ×. Pointer events only. */
export function Window({ title, x, y, z, onMove, onMoveEnd, onRaise, onClose, right, children, className }: WindowProps) {
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null);

  const onBarDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, input, select')) return;
    e.preventDefault();
    drag.current = { id: e.pointerId, dx: e.clientX - x, dy: e.clientY - y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onBarMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    onMove(Math.round(e.clientX - d.dx), Math.round(Math.max(0, e.clientY - d.dy)));
  };
  const onBarUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) {
      drag.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      onMoveEnd?.();
    }
  };

  return (
    <section
      className={className ? `rg-window ${className}` : 'rg-window'}
      style={{ left: x, top: y, zIndex: z }}
      onPointerDownCapture={onRaise}
      aria-label={title}
    >
      <div
        className="rg-window__bar"
        onPointerDown={onBarDown}
        onPointerMove={onBarMove}
        onPointerUp={onBarUp}
        onPointerCancel={onBarUp}
      >
        <span className="rg-window__title">{title}</span>
        <span className="rg-window__right">{right}</span>
        <button type="button" className="rg-window__close" aria-label={`Close ${title}`} onClick={onClose}>
          <Glyph name="close" size={14} strokeWidth={2} />
        </button>
      </div>
      <div className="rg-window__body">{children}</div>
    </section>
  );
}
