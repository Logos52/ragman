import { useCallback } from 'react';
import { Tooltip, TooltipTitle } from '../primitives/Tooltip';
import { Chip } from '../primitives/Chip';
import { useUi } from '../uiStore';
import { fmtCells, useInv } from '../app/useStore';
import './menus.css';

/** Hover tooltip for an item: name, status chip, footprint, note. Blank fields draw nothing. */
export function ItemTooltip() {
  const tip = useUi((s) => s.tooltip);
  const dragging = useUi((s) => s.dragging);
  const menu = useUi((s) => s.contextMenu);
  const inv = useInv();
  const tipId = tip?.id ?? null;
  const tx = tip?.x ?? 0;
  const ty = tip?.y ?? 0;
  // the hovered tile's own name strip stays readable: the tile under the pointer (else every shown copy of it)
  const avoid = useCallback(() => {
    if (!tipId) return [];
    const tiles = [...document.querySelectorAll(`[data-tile="${CSS.escape(tipId)}"]`)];
    const under = tiles.filter((t) => { const r = t.getBoundingClientRect(); return tx >= r.left && tx <= r.right && ty >= r.top && ty <= r.bottom; });
    return (under.length ? under : tiles).flatMap((t) => [...t.querySelectorAll('.rg-tile__name')]);
  }, [tipId, tx, ty]);
  if (!tip || dragging || menu || !inv) return null;
  const item = inv.items[tip.id];
  if (!item) return null;
  const fp = fmtCells(item.footprint); // the stored footprint only: blank stays blank (the grid still draws 1x1)
  const note = (item.note ?? '').trim();
  return (
    <Tooltip x={tip.x} y={tip.y} avoid={avoid}>
      <TooltipTitle>{item.name}</TooltipTitle>
      <div className="rg-itip__row">
        <Chip status={item.status} size="sm" />
        {fp ? <span className="rg-itip__fp">{fp}</span> : null}
      </div>
      {note ? <div className="rg-itip__note">{note}</div> : null}
    </Tooltip>
  );
}
