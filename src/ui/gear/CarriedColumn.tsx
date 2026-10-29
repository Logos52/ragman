/** Middle column: Pockets, then one block per carried bag slot (2x2 slot box with the bag art, its Main panel grid to the right). */
import { LabelTab } from '../primitives/LabelTab';
import { AllowanceMeter, WeightReadout } from '../primitives/WeightReadout';
import { useInventory } from '../hooks/useInv';
import { ItemTile } from '../items/ItemTile';
import { GridZone, useGridRef } from './GridZone';
import { SlotZone } from './SlotZone';
import { PocketsSize } from './LoadoutSlots';

const POCKETS: { kind: 'pockets' } = { kind: 'pockets' };

function Pockets() {
  return (
    <div className="gear-carry gear-carry--pockets">
      <div className="gear-pockets__head">
        <LabelTab>Pockets</LabelTab>
        <PocketsSize />
      </div>
      <GridZone grid={POCKETS} scope="carry" />
    </div>
  );
}

function mainPanelOf(panels: { name: string }[] | undefined): string | null {
  if (!panels?.length) return null;
  return (panels.find((p) => p.name.toLowerCase() === 'main') ?? panels[0]).name;
}

function BagBlock({ slot }: { slot: string }) {
  const id = useInventory((s) => (s.inv ? s.slotItem(slot) : null));
  if (!id) {
    return (
      <div className="gear-carry">
        <SlotZone slot={slot} label={slot} />
      </div>
    );
  }
  return <EquippedBag slot={slot} id={id} />;
}

function EquippedBag({ slot, id }: { slot: string; id: string }) {
  const item = useInventory((s) => s.inv?.items[id]);
  const weight = useInventory((s) => s.weightOf(id));
  const main = mainPanelOf(item?.panels);
  const grid = useGridRef({ kind: 'panel', in: id, panel: main ?? '' });
  if (!item) return null;
  return (
    <div className="gear-carry gear-bag">
      <LabelTab>{slot}</LabelTab>
      <div className="gear-bag__head">
        <span className="gear-bag__name">{item.name}</span>
        <WeightReadout grams={weight.grams} unweighed={weight.unweighed} limit={weight.limit} overLimit={weight.overLimit} meter={false} />
        {weight.limit != null && weight.limit > 0
          ? <AllowanceMeter grams={weight.grams} limit={weight.limit} overLimit={weight.overLimit} className="gear-bag__meter" />
          : null}
      </div>
      <div className="gear-bag__body">
        <SlotZone slot={slot} label="" cells={[2, 2]} className="gear-bag__art">
          <ItemTile id={id} primary />
        </SlotZone>
        {main ? <GridZone grid={grid} scope="carry" /> : null}
      </div>
    </div>
  );
}

export function CarriedColumn() {
  useInventory((s) => s.inv);
  const slots = useInventory((s) => s.carrySlots());
  return (
    <section className="gear-col gear-carried" aria-label="Carried">
      {slots.map((s) => (s === 'Pockets' ? <Pockets key={s} /> : <BagBlock key={s} slot={s} />))}
    </section>
  );
}
