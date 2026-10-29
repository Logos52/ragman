/**
 * A grid of the model drawn on the design GridSurface, registered as a drop zone,
 * with memoised ItemTiles absolutely placed at x*cell, y*cell (w*cell by h*cell).
 * Only the drag highlight of THIS zone is subscribed, so a drag over another grid never re-renders it.
 */
import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { GridRef } from '../../model/types';
import { GridSurface, GridPos } from '../primitives/GridSurface';
import { ItemTile } from '../items/ItemTile';
import { useInventory } from '../hooks/useInv';
import { useCellSize } from '../hooks/useCellSize';
import { useZoneHighlight } from '../drag/dragStore';
import { useDropZone } from '../drag/useDropZone';
import { gridKey } from '../drag/registry';

export interface GridZoneProps {
  grid: GridRef;
  /** Distinguishes two views of the same grid (the middle column and an open window). */
  scope: string;
  /** When set, ids not in it draw dimmed (filters), positions unchanged. */
  visible?: Set<string> | null;
  /** Drawn behind the items (e.g. "Spare" on an empty main panel). */
  behind?: ReactNode;
  className?: string;
}

function GridZoneImpl({ grid, scope, visible, behind, className }: GridZoneProps) {
  const view = useInventory((s) => s.gridView(grid));
  const cell = useCellSize();
  const key = `${scope}|${gridKey(grid)}`;
  const hl = useZoneHighlight(key);
  const wrap = useDropZone<HTMLDivElement>(
    key,
    { kind: 'grid', grid, width: view.width, height: view.height, cellSize: cell },
    '.rg-grid',
  );
  const highlight = useMemo(() => (hl ? { cells: hl.cells, ok: hl.ok } : null), [hl]);
  return (
    <div ref={wrap} className={className ? `gz ${className}` : 'gz'}>
      <GridSurface width={view.width} height={view.height} regions={view.regions} highlight={highlight}>
        {behind}
        {view.items.map((it) => (
          <GridPos key={it.id} x={it.x} y={it.y} w={it.w} h={it.h}>
            <ItemTile
              id={it.id}
              w={it.w}
              h={it.h}
              rotated={it.rotated}
              locationTag={it.locationTag}
              dimmed={visible ? !visible.has(it.id) : false}
              primary
            />
          </GridPos>
        ))}
      </GridSurface>
    </div>
  );
}

export const GridZone = memo(GridZoneImpl);

/** A stable GridRef object per value, so memo and selectors are not defeated by inline literals. */
export function useGridRef(ref: GridRef): GridRef {
  const k = gridKey(ref);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ref, [k]);
}
