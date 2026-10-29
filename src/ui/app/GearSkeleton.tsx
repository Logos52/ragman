/**
 * The Gear screen with no items: drawn before the inventory loads (one frame) and under the error banner.
 * Same markup classes and column CSS as GearScreen, so nothing moves when the data arrives:
 * person (the loadout picker row: two blank segments and a disabled Slots button; doll slot boxes with labels and glyphs), carried (4x1 Pockets, the empty bag slots),
 * stash (header with a blank two-segment location control, label tab, the filter strip of blank squares, empty grid), Quick Use with its label tab and digits, footer.
 * Nothing from the data is guessed: no loadout names, locations, categories or weights are drawn.
 * Controls that need the inventory are disabled. No spinner.
 */
import { Figure } from '../primitives/Figure';
import { SlotBox } from '../primitives/SlotBox';
import { GridSurface } from '../primitives/GridSurface';
import { LabelTab } from '../primitives/LabelTab';
import { Button } from '../primitives/Button';
import { TextField } from '../primitives/TextField';
import { Select } from '../primitives/Select';
import { Glyph, glyphNameFor } from '../primitives/glyphs';
import { DOLL_SLOTS } from '../gear/PersonColumn';
import { SORTS } from '../gear/StashColumn';
import { useInventory } from './useStore';
import '../gear/gear.css';
import '../primitives/WeightReadout.css';
import '../primitives/SegmentedControl.css';

/** DESIGN's carried order after Pockets. */
const BAG_SLOTS = ['Backpack', 'Carry-on', 'Pouch'];
/** Loadout default pocketsGrid. */
const POCKETS: [number, number] = [4, 1];
/** An empty stash: the default stashWidth, MIN_ROWS tall. */
const STASH: [number, number] = [10, 12];
/** Blank squares the loading filter strip draws (a count, not categories). */
const FILTER_SQUARES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const noop = () => {};

function Slot({ slot }: { slot: string }) {
  return <div className="sz"><SlotBox label={slot} glyph={glyphNameFor(slot)} /></div>;
}

export function GearSkeleton() {
  const sort = useInventory((s) => s.filters.sort);
  return (
    <div className="gear gear--skeleton" aria-hidden>
      <div className="gear__cols">
        <section className="gear-col gear-person">
          <div className="gear-person__picker">
            {/* same box as the loaded SegmentedControl (md, block) so the doll does not move; no loadout names guessed */}
            <div className="rg-seg rg-seg--md rg-seg--block">
              <button type="button" className="rg-seg__opt" disabled tabIndex={-1} />
              <button type="button" className="rg-seg__opt" disabled tabIndex={-1} />
            </div>
            <Button size="sm" disabled tabIndex={-1}>Slots</Button>
          </div>
          <div className="gear-doll">
            <div className="gear-doll__col">{DOLL_SLOTS.left.map((s) => <Slot key={s} slot={s} />)}</div>
            <div className="gear-doll__figure">
              <Figure baseUrl={null} layers={[]} />
              <div className="gear-doll__below">{DOLL_SLOTS.below.map((s) => <Slot key={s} slot={s} />)}</div>
            </div>
            <div className="gear-doll__col">{DOLL_SLOTS.right.map((s) => <Slot key={s} slot={s} />)}</div>
          </div>
        </section>
        <div className="gear__middle">
          <section className="gear-col gear-carried">
            <div className="gear-carry gear-carry--pockets">
              <LabelTab>Pockets</LabelTab>
              <div className="gz"><GridSurface width={POCKETS[0]} height={POCKETS[1]} /></div>
            </div>
            {BAG_SLOTS.map((s) => <div key={s} className="gear-carry"><Slot slot={s} /></div>)}
          </section>
        </div>
        <section className="gear-col gear-stash">
          <div className="gear-stash__head">
            <div className="gear-stash__row">
              {/* the location control's box: two blank disabled segments (no location names guessed) */}
              <div className="rg-seg rg-seg--sm gear-stash__locph">
                <button type="button" className="rg-seg__opt" disabled tabIndex={-1} />
                <button type="button" className="rg-seg__opt" disabled tabIndex={-1} />
              </div>
              <Button size="sm" icon="archive" disabled>Archive</Button>
              <span className="gear-stash__spacer" />
              <Button size="sm" icon="sort" disabled>Sort</Button>
              <Button size="sm" variant="accent" icon="plus" disabled>Add</Button>
            </div>
            <div className="gear-stash__row">
              <TextField size="sm" value="" onChange={noop} disabled className="gear-stash__search" />
              <Select size="sm" prefix="Sort" options={SORTS} value={sort} onChange={noop} disabled />
            </div>
          </div>
          <LabelTab className="gear-stash__tab">Stash</LabelTab>
          <div className="gear-stash__body">
            {/* the filter strip keeps its column: blank disabled squares, no category glyphs guessed */}
            <div className="gear-filter">
              {FILTER_SQUARES.map((k) => <span key={k} className="gear-filter__btn gear-filter__ph" />)}
            </div>
            <div className="gear-stash__scroll">
              <div className="gz"><GridSurface width={STASH[0]} height={STASH[1]} /></div>
            </div>
          </div>
        </section>
      </div>
      <section className="gear-quick">
        <div className="gear-quick__inner">
          <LabelTab>Quick use</LabelTab>
          <div className="gear-quick__boxes">
            {DIGITS.map((d) => <div key={d} className="sz"><SlotBox label="" glyph="none" corner={d} /></div>)}
          </div>
        </div>
      </section>
      <footer className="gear-footer">
        <span className="rg-carried"><Glyph name="tag" size={15} /><span>Carried</span></span>
      </footer>
    </div>
  );
}
