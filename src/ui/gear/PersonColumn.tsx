/** Left column: loadout picker, the paper doll figure, body slot boxes either side, Feet below. */
import { useMemo, useState } from 'react';
import { SegmentedControl } from '../primitives/SegmentedControl';
import { Figure } from '../primitives/Figure';
import { getStore, useInventory } from '../hooks/useInv';
import { ItemTile } from '../items/ItemTile';
import { SlotZone } from './SlotZone';
import { SlotsEditor } from './LoadoutSlots';
import { Button } from '../primitives/Button';

const LEFT = ['Head', 'Eyes', 'Ears', 'Neck', 'Wrist'];
const RIGHT = ['Torso Outer', 'Torso Mid', 'Torso Base', 'Hands', 'Legs', 'Underwear', 'Socks'];
const BELOW = ['Feet'];
/** The doll's slot layout from DESIGN (also drawn, empty, by the loading/error skeleton). */
export const DOLL_SLOTS = { left: LEFT, right: RIGHT, below: BELOW };
const CARRY = new Set(['Pockets', 'Backpack', 'Carry-on', 'Pouch']);

function BodySlot({ slot }: { slot: string }) {
  const id = useInventory((s) => (s.inv ? s.slotItem(slot) : null));
  return (
    <SlotZone slot={slot} label={slot}>
      {id ? <ItemTile id={id} primary /> : null}
    </SlotZone>
  );
}

export function PersonColumn() {
  const inv = useInventory((s) => s.inv);
  useInventory((s) => s.imagesTick);
  const store = getStore();
  const loadoutNames = inv ? Object.keys(inv.loadouts) : [];
  const active = inv?.activeLoadout ?? '';
  const slots = inv ? store.activeLoadout().slots : [];
  const [editing, setEditing] = useState(false);

  const { left, right, below } = useMemo(() => {
    const body = slots.filter((s) => !CARRY.has(s));
    const l = LEFT.filter((s) => body.includes(s));
    const r = RIGHT.filter((s) => body.includes(s));
    const b = BELOW.filter((s) => body.includes(s));
    // slots added per loadout that the layout does not name: alternate them onto the two columns
    body.filter((s) => !LEFT.includes(s) && !RIGHT.includes(s) && !BELOW.includes(s))
      .forEach((s, i) => (i % 2 ? r : l).push(s));
    return { left: l, right: r, below: b };
  }, [slots]);

  // worn layers of equipped items, in slot order (bottom first)
  const layers = useMemo(() => {
    if (!inv) return [];
    const out: string[] = [];
    for (const s of slots) {
      const id = store.slotItem(s);
      const url = id ? store.imageUrl(id, 'worn') : null;
      if (url && inv.items[id!]?.images?.worn) out.push(url);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv, slots]);

  return (
    <section className="gear-col gear-person" aria-label="Person">
      <div className="gear-person__picker">
        {loadoutNames.length ? (
          <SegmentedControl
            options={loadoutNames}
            value={active}
            onChange={(name) => store.switchLoadout(name)}
            block
            aria-label="Loadout"
          />
        ) : null}
        {inv ? (
          <Button size="sm" pressed={editing} onClick={() => setEditing((v) => !v)} aria-expanded={editing}
            title="Add or remove slots for this loadout">
            Slots
          </Button>
        ) : null}
        {/* drawn over the doll, anchored under this row (gear.css), so the doll does not move */}
        {editing && inv ? <SlotsEditor onClose={() => setEditing(false)} /> : null}
      </div>
      <div className="gear-doll">
        <div className="gear-doll__col">
          {left.map((s) => <BodySlot key={s} slot={s} />)}
        </div>
        <div className="gear-doll__figure">
          <Figure baseUrl={inv ? store.avatarBaseUrl() : null} layers={layers} />
          <div className="gear-doll__below">
            {below.map((s) => <BodySlot key={s} slot={s} />)}
          </div>
        </div>
        <div className="gear-doll__col">
          {right.map((s) => <BodySlot key={s} slot={s} />)}
        </div>
      </div>
    </section>
  );
}
