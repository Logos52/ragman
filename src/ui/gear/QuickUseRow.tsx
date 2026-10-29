/** Bottom row: ten numbered boxes holding quick-use references (1x1 tiles; the item stays where it is). */
import { LabelTab } from '../primitives/LabelTab';
import { useInventory } from '../hooks/useInv';
import { ItemTile } from '../items/ItemTile';
import { SlotZone } from './SlotZone';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

function QuickBox({ index }: { index: number }) {
  const id = useInventory((s) => s.inv?.quickUse[index] ?? null);
  const exists = useInventory((s) => (id ? !!s.inv?.items[id] : false));
  return (
    <SlotZone quickUseIndex={index} label="" glyph="none" corner={DIGITS[index]}>
      {id && exists ? <ItemTile id={id} quickUseIndex={index} /> : null}
    </SlotZone>
  );
}

export function QuickUseRow() {
  return (
    <section className="gear-quick" aria-label="Quick use">
      <div className="gear-quick__inner">
        <LabelTab>Quick use</LabelTab>
        <div className="gear-quick__boxes">
          {DIGITS.map((_, i) => <QuickBox key={i} index={i} />)}
        </div>
      </div>
    </section>
  );
}
