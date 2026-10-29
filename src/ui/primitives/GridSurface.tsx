import { useCallback, useRef } from 'react';
import type { CSSProperties, HTMLAttributes, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import './GridSurface.css';

/** Structurally the same as model Region (kept local: primitives never import the model). */
export interface GridRegion {
  name: string;
  at: [number, number];
  size: [number, number];
  accepts?: string[];
}

export interface GridHighlight {
  cells: [number, number][];
  ok: boolean;
}

export type CellPointerKind = 'down' | 'move' | 'up' | 'leave';

export interface CellPointerInfo {
  kind: CellPointerKind;
  /** Cell under the pointer, or null when outside the grid (always null for 'leave'). */
  cell: [number, number] | null;
  /** Pointer offset inside that cell in px (useful for drag anchors). */
  offset: [number, number];
  event: ReactPointerEvent<HTMLDivElement>;
}

export interface GridSurfaceProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  width: number;
  height: number;
  /** Cell size in px. Omit to follow the responsive --cell token. Use whole numbers only. */
  cell?: number;
  regions?: GridRegion[];
  highlight?: GridHighlight | null;
  children?: ReactNode;
  onCellPointer?: (info: CellPointerInfo) => void;
}

/**
 * One element with a graph-paper background, region outlines under the items and region labels above them, items absolutely positioned
 * (wrap each in <GridPos>), and the drop highlight on top. Size is width * cell + 1 px so every
 * line, including the closing right/bottom one, lands on a whole pixel.
 */
export function GridSurface({
  width, height, cell, regions, highlight, children, onCellPointer, className, style, ...rest
}: GridSurfaceProps) {
  const ref = useRef<HTMLDivElement>(null);

  const report = useCallback(
    (kind: CellPointerKind, e: ReactPointerEvent<HTMLDivElement>) => {
      if (!onCellPointer) return;
      const el = ref.current;
      if (!el || kind === 'leave') { onCellPointer({ kind, cell: null, offset: [0, 0], event: e }); return; }
      const r = el.getBoundingClientRect();
      const px = (r.width - 1) / width;
      const lx = e.clientX - r.left;
      const ly = e.clientY - r.top;
      const cx = Math.floor(lx / px);
      const cy = Math.floor(ly / px);
      const inside = cx >= 0 && cy >= 0 && cx < width && cy < height;
      onCellPointer({ kind, cell: inside ? [cx, cy] : null, offset: [lx - cx * px, ly - cy * px], event: e });
    },
    [onCellPointer, width, height],
  );

  const vars = {
    '--rg-cell': cell != null ? `${Math.round(cell)}px` : 'var(--cell)',
    '--rg-w': width,
    '--rg-h': height,
    ...style,
  } as CSSProperties;

  return (
    <div
      ref={ref}
      className={className ? `rg-grid ${className}` : 'rg-grid'}
      style={vars}
      onPointerDown={onCellPointer ? (e) => report('down', e) : undefined}
      onPointerMove={onCellPointer ? (e) => report('move', e) : undefined}
      onPointerUp={onCellPointer ? (e) => report('up', e) : undefined}
      onPointerLeave={onCellPointer ? (e) => report('leave', e) : undefined}
      {...rest}
    >
      {regions?.map((rg, i) => (
        <div
          key={`${rg.name}-${i}`}
          className="rg-grid__region"
          style={{
            left: `calc(var(--rg-cell) * ${rg.at[0]})`,
            top: `calc(var(--rg-cell) * ${rg.at[1]})`,
            width: `calc(var(--rg-cell) * ${rg.size[0]} + 1px)`,
            height: `calc(var(--rg-cell) * ${rg.size[1]} + 1px)`,
          }}
        />
      ))}
      {children}
      {/* labels above the items (outlines stay under them) so a region stays readable when an item sits on it */}
      {regions?.map((rg, i) => (
        <span
          key={`${rg.name}-${i}-label`}
          className="rg-grid__region-label"
          // placed by GridSurface.css from these: bottom-centre of the region at every cell size, clear of tile marks
          style={{ '--rg-rx': rg.at[0], '--rg-ry': rg.at[1], '--rg-rw': rg.size[0], '--rg-rh': rg.size[1] } as CSSProperties}
        >
          {rg.name}
        </span>
      ))}
      {highlight?.cells.map(([x, y]) => (
        <div
          key={`${x},${y}`}
          className={highlight.ok ? 'rg-grid__hl rg-grid__hl--ok' : 'rg-grid__hl rg-grid__hl--bad'}
          style={{ left: `calc(var(--rg-cell) * ${x})`, top: `calc(var(--rg-cell) * ${y})` }}
        />
      ))}
    </div>
  );
}

export interface GridPosProps extends HTMLAttributes<HTMLDivElement> {
  x: number;
  y: number;
  w: number;
  h: number;
  children?: ReactNode;
}

/** Places a child (a Tile) over cells x..x+w-1, y..y+h-1, inside the grid lines. */
export function GridPos({ x, y, w, h, children, className, style, ...rest }: GridPosProps) {
  return (
    <div
      className={className ? `rg-gridpos ${className}` : 'rg-gridpos'}
      style={{
        left: `calc(var(--rg-cell) * ${x} + 1px)`,
        top: `calc(var(--rg-cell) * ${y} + 1px)`,
        width: `calc(var(--rg-cell) * ${w} - 1px)`,
        height: `calc(var(--rg-cell) * ${h} - 1px)`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
