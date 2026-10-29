/** A SlotBox registered as a drop zone (a body/carry slot, or a quick-use box). */
import { memo } from 'react';
import type { ReactNode } from 'react';
import { SlotBox } from '../primitives/SlotBox';
import { glyphNameFor } from '../primitives/glyphs';
import { useCellSize } from '../hooks/useCellSize';
import { useZoneHighlight } from '../drag/dragStore';
import { useDropZone } from '../drag/useDropZone';

export interface SlotZoneProps {
  /** Slot name (kind slot) or undefined for quick use. */
  slot?: string;
  quickUseIndex?: number;
  label: string;
  glyph?: string;
  cells?: [number, number];
  corner?: string;
  children?: ReactNode;
  className?: string;
}

function SlotZoneImpl({ slot, quickUseIndex, label, glyph, cells, corner, children, className }: SlotZoneProps) {
  const cell = useCellSize();
  const isQu = quickUseIndex != null;
  const key = isQu ? `qu|${quickUseIndex}` : `slot|${slot}`;
  const hl = useZoneHighlight(key);
  const wrap = useDropZone<HTMLDivElement>(
    key,
    isQu ? { kind: 'quickUse', index: quickUseIndex, cellSize: cell } : { kind: 'slot', slot, cellSize: cell },
    '.rg-slot__box',
  );
  return (
    <div ref={wrap} className={className ? `sz ${className}` : 'sz'}>
      <SlotBox
        label={label}
        glyph={glyph ?? glyphNameFor(slot ?? '')}
        cells={cells}
        corner={corner}
        highlight={hl ? (hl.ok ? 'ok' : 'bad') : null}
      >
        {children ?? null}
      </SlotBox>
    </div>
  );
}

export const SlotZone = memo(SlotZoneImpl);
