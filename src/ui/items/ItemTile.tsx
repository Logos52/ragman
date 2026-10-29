/**
 * An item id on the design Tile, with every interaction wired:
 * hover tooltip (160 ms, through uiStore), right-click menu, click select, Ctrl-click to stash,
 * Alt-click equip, double-click opens a container (Inspect for a plain item), pointerdown starts a drag
 * (Ctrl and Shift too: Ctrl-drag quick-moves onto a container tile, Shift-drag splits one off a stack).
 * Marks: pin, lock, the unverified "?", stack quantity, a container's nickname; dimmed under Filter by item.
 */
import { memo, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { Tile } from '../primitives/Tile';
import { useHoverTooltip } from '../primitives/Tooltip';
import { getStore, useInventory } from '../hooks/useInv';
import { useUi } from '../uiStore';
import { useDragStore, useQuickHighlight } from '../drag/dragStore';
import { beginPointer, isDragging, justDragged } from '../drag/session';
import './items.css';

export interface ItemTileProps {
  id: string;
  /** Footprint after rotation. Omit (with no `size`) inside a slot box: the tile fills its parent. */
  w?: number;
  h?: number;
  rotated?: boolean;
  locationTag?: string;
  /** Filtered out of the stash view: drawn at 0.25 opacity, still in place. */
  dimmed?: boolean;
  /** The item's real place (grid or slot), as opposed to a quick-use reference. Used for the drop FLIP. */
  primary?: boolean;
  /** Set on quick-use references: dragging re-binds or clears the box instead of moving the item. */
  quickUseIndex?: number;
  /** Px per cell for a standalone tile. */
  size?: number;
}

function ItemTileImpl({ id, w = 1, h = 1, rotated = false, locationTag, dimmed, primary, quickUseIndex, size }: ItemTileProps) {
  const item = useInventory((s) => s.inv?.items[id]);
  useInventory((s) => s.imagesTick); // re-resolve art when a lazily loaded image arrives
  const selected = useUi((s) => s.selectedId === id);
  const isSource = useDragStore((s) => s.sourceId === id);
  const flashN = useDragStore((s) => (s.flash?.id === id ? s.flash.n : 0));
  const quickHl = useQuickHighlight(id);
  // Filter by item: everything that does not do the same job dims (the item itself stays lit)
  const jobDim = useUi((s) => !!s.jobFilter && s.jobFilter.id !== id && !s.jobFilter.ids.has(id));
  const [flashing, setFlashing] = useState(false);
  const el = useRef<HTMLDivElement>(null);
  const tip = useHoverTooltip(160);

  // mirror the hook's local tooltip state into the shared uiStore (the shell renders it).
  // Placed once where the delay ended; it does not chase the pointer (one store write per hover).
  const { open } = tip.state;
  const at = useRef({ x: 0, y: 0 });
  at.current = { x: tip.state.x, y: tip.state.y };
  useEffect(() => {
    const ui = useUi.getState();
    if (open) ui.showTooltip(id, at.current.x, at.current.y);
    else if (ui.tooltip?.id === id) ui.hideTooltip();
  }, [open, id]);
  useEffect(() => () => { const ui = useUi.getState(); if (ui.tooltip?.id === id) ui.hideTooltip(); }, [id]);

  useEffect(() => {
    if (!flashN) return;
    setFlashing(true);
    const t = window.setTimeout(() => setFlashing(false), 140);
    return () => window.clearTimeout(t);
  }, [flashN]);

  if (!item) return null;
  const store = getStore();
  const container = store.isContainer(id);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    tip.handlers.onPointerDown();
    if (e.button !== 0 || e.altKey) return;
    if (!el.current) return;
    beginPointer(e, el.current, { id, rotated, quickUseIndex });
  };
  const onClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (justDragged() || isDragging()) return;
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); store.sendToStash(id); return; }
    if (e.altKey) { e.preventDefault(); store.equip(id); return; }
    useUi.getState().select(id);
  };
  const onDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (container) store.openWindow(id);
    else useUi.getState().inspect(id);
  };
  const onContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    tip.hide();
    useUi.getState().openMenu(id, e.clientX, e.clientY);
  };

  const cls = ['rg-itile', dimmed || jobDim ? 'rg-itile--dim' : '', isSource ? 'rg-itile--source' : ''].filter(Boolean).join(' ');
  return (
    <div
      ref={el}
      className={cls}
      data-tile={id}
      data-primary={primary ? '' : undefined}
      onPointerEnter={tip.handlers.onPointerEnter}
      onPointerMove={tip.handlers.onPointerMove}
      onPointerLeave={tip.handlers.onPointerLeave}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <Tile
        name={item.name}
        art={store.imageUrl(id, 'cell')}
        w={w}
        h={h}
        rotated={rotated}
        container={container}
        specialCare={!!item.specialCare}
        consumable={!!item.consumable}
        selected={selected}
        flash={flashing}
        locationTag={locationTag}
        size={size}
        pinned={!!item.pinned}
        locked={!!item.locked}
        unverified={!item.verified}
        quantity={item.quantity}
        nickname={item.nickname}
        dropHl={quickHl}
      />
    </div>
  );
}

/** Memoised: a tile re-renders only when its own props, item, selection or drag role change. */
export const ItemTile = memo(ItemTileImpl);
