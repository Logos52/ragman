/**
 * The drag ghost: a fixed portal moved by transform from session.ts. Mount once (the app Overlays do).
 * A Shift-drag split ghost is the single unit being taken off (no count).
 * It re-renders only when a drag starts, ends or rotates, never on pointermove.
 * Ctrl-Z is bound once globally by the App shell (src/ui/app/App.tsx), so it is not bound here.
 */
import { useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Tile } from '../primitives/Tile';
import { getStore, useInventory } from '../hooks/useInv';
import { useDragStore } from './dragStore';
import { setGhostElement } from './session';
import './drag.css';

export function DragLayer() {
  const ghost = useDragStore((s) => s.ghost);
  const refCb = useCallback((el: HTMLDivElement | null) => setGhostElement(el), []);
  if (!ghost) return null;
  return createPortal(
    <div ref={refCb} className="rg-drag-ghost" style={{ width: ghost.w * ghost.cell, height: ghost.h * ghost.cell }}>
      <GhostTile id={ghost.id} w={ghost.w} h={ghost.h} rotated={ghost.rotated} cell={ghost.cell} split={!!ghost.split} />
    </div>,
    document.body,
  );
}

function GhostTile({ id, w, h, rotated, cell, split }: { id: string; w: number; h: number; rotated: boolean; cell: number; split: boolean }) {
  const item = useInventory((s) => s.inv?.items[id]);
  useInventory((s) => s.imagesTick);
  if (!item) return null;
  const st = getStore();
  return (
    <Tile
      name={item.name}
      art={st.imageUrl(id, 'cell')}
      w={w}
      h={h}
      rotated={rotated}
      container={st.isContainer(id)}
      specialCare={!!item.specialCare}
      consumable={!!item.consumable}
      dragging
      size={cell}
      pinned={!!item.pinned}
      unverified={!item.verified}
      quantity={split ? 1 : item.quantity}
      nickname={item.nickname}
    />
  );
}
