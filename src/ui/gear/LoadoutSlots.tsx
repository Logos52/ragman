/**
 * Per-loadout structure controls: the slot list editor under the loadout picker (add or remove slots for the
 * active loadout, custom slots included) and the Pockets grid size (pocketsGrid, w x h).
 * Both write through the store (setLoadoutSlots, setPocketsGrid): items in a removed slot, or pockets items that
 * no longer fit, go back home; an edit that would move a locked item is refused and the control shows why.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../primitives/Button';
import { getStore, useInventory } from '../hooks/useInv';

/** Put a default slot back at its place in settings.defaultSlots order; custom slots keep theirs. */
function withSlot(slots: string[], slot: string, defaults: string[]): string[] {
  if (slots.includes(slot)) return slots;
  const di = defaults.indexOf(slot);
  if (di < 0) return [...slots, slot];
  const at = slots.findIndex((s) => { const i = defaults.indexOf(s); return i > di; });
  return at < 0 ? [...slots, slot] : [...slots.slice(0, at), slot, ...slots.slice(at)];
}

export function SlotsEditor({ onClose }: { onClose: () => void }) {
  const inv = useInventory((s) => s.inv);
  const [name, setName] = useState('');
  const [refused, setRefused] = useState<string | null>(null);
  if (!inv) return null;
  const store = getStore();
  const lo = store.activeLoadout();
  const defaults = inv.settings.defaultSlots;
  const custom = lo.slots.filter((s) => !defaults.includes(s));
  const apply = (next: string[], what: string) => {
    setRefused(store.setLoadoutSlots(next) || JSON.stringify(next) === JSON.stringify(lo.slots) ? null : `${what}: a locked item would have to move`);
  };
  const toggle = (slot: string) => (lo.slots.includes(slot)
    ? apply(lo.slots.filter((s) => s !== slot), slot)
    : apply(withSlot(lo.slots, slot, defaults), slot));
  const add = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || lo.slots.includes(n)) return;
    apply(withSlot(lo.slots, n, defaults), n);
    setName('');
  };
  return (
    <div className="gear-slots" role="group" aria-label={`Slots of ${inv.activeLoadout}`}>
      <div className="gear-slots__head">
        <span className="gear-slots__h">Slots · {inv.activeLoadout}</span>
        <button type="button" className="gear-slots__x" aria-label="Close slots" onClick={onClose}>×</button>
      </div>
      <div className="gear-slots__list">
        {[...defaults, ...custom].map((s) => {
          const on = lo.slots.includes(s);
          return (
            <button key={s} type="button" aria-pressed={on}
              className={on ? 'gear-slots__opt gear-slots__opt--on' : 'gear-slots__opt'}
              onClick={() => toggle(s)}
              title={on ? `Remove ${s} from ${inv.activeLoadout}` : `Add ${s} to ${inv.activeLoadout}`}>
              {s}
            </button>
          );
        })}
      </div>
      <form className="gear-slots__add" onSubmit={add}>
        <input className="gear-slots__in" value={name} onChange={(e) => setName(e.target.value)} placeholder="New slot"
          aria-label="New slot name" />
        <Button type="submit" size="sm" icon="plus" disabled={!name.trim() || lo.slots.includes(name.trim())}>Add slot</Button>
      </form>
      {refused ? <p className="gear-slots__err">{refused}</p> : null}
    </div>
  );
}

/** The Pockets size, w x h cells, for the active loadout. */
export function PocketsSize() {
  const key = useInventory((s) => (s.activeLoadout().pocketsGrid ?? [4, 1]).join('x'));
  const grid = key.split('x').map(Number) as [number, number];
  const [refused, setRefused] = useState(false);
  const set = (i: 0 | 1, v: string) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 40) return;
    const next: [number, number] = i === 0 ? [n, grid[1]] : [grid[0], n];
    setRefused(!getStore().setPocketsGrid(next) && (next[0] !== grid[0] || next[1] !== grid[1]));
  };
  return (
    <span className="gear-pockets__size" title={refused ? 'Refused: a locked item would have to move' : 'Pockets size in cells'}>
      <input type="number" min={1} max={40} value={grid[0]} aria-label="Pockets width" onChange={(e) => set(0, e.target.value)} />
      <span>×</span>
      <input type="number" min={1} max={40} value={grid[1]} aria-label="Pockets height" onChange={(e) => set(1, e.target.value)} />
      {refused ? <span className="gear-pockets__err">locked item</span> : null}
    </span>
  );
}
