/** Right column: header (location, Archive, search, sort select, Sort, Add), filter strip, stash/archive grid. */
import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import type { GridRef, SortMode } from '../../model/types';
import { SegmentedControl } from '../primitives/SegmentedControl';
import { Button, IconButton } from '../primitives/Button';
import { TextField } from '../primitives/TextField';
import { Select } from '../primitives/Select';
import { LabelTab } from '../primitives/LabelTab';
import { Glyph, glyphNameFor } from '../primitives/glyphs';
import { getStore, useInventory } from '../hooks/useInv';
import { useUi } from '../uiStore';
import { GridZone } from './GridZone';
import { useRetainedGrids } from '../hooks/useRetainedGrids';

export const SORTS:{ value: SortMode; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'category', label: 'Category' },
  { value: 'status', label: 'Status' },
  { value: 'size-desc', label: 'Size' },
];

function FilterStrip() {
  const categories = useInventory((s) => s.inv?.settings.categories);
  const active = useInventory((s) => s.filters.categories);
  const toggle = (c: string) => {
    const next = new Set(active);
    if (next.has(c)) next.delete(c); else next.add(c);
    getStore().setFilters({ categories: next });
  };
  return (
    <div className="gear-filter" role="toolbar" aria-label="Category filter">
      {(categories ?? []).map((c) => (
        <IconButton
          key={c}
          icon={glyphNameFor(c)}
          label={c}
          variant={active.has(c) ? 'accent' : 'ghost'}
          pressed={active.has(c)}
          className="gear-filter__btn"
          onClick={() => toggle(c)}
        />
      ))}
    </div>
  );
}

/** Filter by item is on: "SHOWING: <category>  ×" in the header; the × (or Esc, or a click on empty space) ends it. */
function ShowingChip() {
  const f = useUi((s) => s.jobFilter);
  if (!f) return null;
  return (
    <span className="gear-showing" role="status">
      <span className="gear-showing__k">Showing:</span>
      <span className="gear-showing__v">{f.label}</span>
      <button type="button" className="gear-showing__x" aria-label="Stop filtering by item" onClick={() => useUi.getState().setJobFilter(null)}>
        <Glyph name="close" size={12} strokeWidth={2.25} />
      </button>
    </span>
  );
}

/**
 * One stash grid (a location or the Archive), kept mounted while another is shown: the inactive ones are
 * `display: none`, so a switch reuses their tiles and decoded images instead of remounting them. The active one is
 * `display: contents`, so the wrapper adds no box and the layout is the same as a bare GridZone.
 */
const NONE: string[] = [];
const StashGrid = memo(function StashGrid({ grid, active, behind }: { grid: GridRef; active: boolean; behind: ReactNode }) {
  // only the grid on screen follows the filter strip and search (a hidden one catches up when it is shown)
  const filtering = useInventory((s) => active && (s.filters.categories.size > 0 || s.filters.search.trim() !== ''));
  const filtered = useInventory((s) => (filtering ? s.filteredIds(grid) : NONE));
  const visible = useMemo(() => (filtering ? new Set(filtered) : null), [filtering, filtered]);
  return (
    <div className="gear-stash__grid" style={{ display: active ? 'contents' : 'none' }}>
      <GridZone grid={grid} scope="stash" visible={visible} behind={behind} />
    </div>
  );
});

export function StashColumn() {
  const locations = useInventory((s) => s.inv?.settings.locations);
  const location = useInventory((s) => s.stashLocation);
  const showArchive = useInventory((s) => s.showArchive);
  const filters = useInventory((s) => s.filters);
  const store = getStore();
  // every location's grid and the Archive stay mounted once warm; the first entry is the one on screen
  const grids = useRetainedGrids(locations, showArchive ? { kind: 'archive' } : { kind: 'stash', location });
  const grid: GridRef = grids[0].ref;
  // zero items in the whole inventory (not a filter or search hiding them): the grid carries one big Add button
  const none = useInventory((s) => (s.inv ? Object.keys(s.inv.items).length === 0 : false));
  const behind = useMemo(() => (none ? (
    <div className="gear-stash__first">
      <Button variant="accent" icon="plus" className="gear-stash__firstbtn" onClick={() => useUi.getState().setAddOpen(true)}>
        Add your first item
      </Button>
    </div>
  ) : null), [none]);
  // Stash and Archive (and each location) are different grids: each opens at its top, never at the last one's offset.
  const scroll = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (scroll.current) scroll.current.scrollTop = 0; }, [showArchive, location]);

  return (
    <section className="gear-col gear-stash" aria-label="Stash">
      <div className="gear-stash__head">
        <div className="gear-stash__row">
          {locations?.length ? (
            <SegmentedControl
              options={locations}
              // the Archive spans every location, so no location reads as chosen while it is shown
              value={showArchive ? '' : location}
              onChange={(l) => { store.setStashLocation(l); if (showArchive) store.setShowArchive(false); }}
              size="sm"
              aria-label="Stash location"
            />
          ) : null}
          <Button size="sm" icon="archive" pressed={showArchive} onClick={() => store.setShowArchive(!showArchive)}>
            Archive
          </Button>
          <span className="gear-stash__spacer" />
          <Button size="sm" icon="sort" onClick={() => store.sortGrid(grid, filters.sort)}>Sort</Button>
          <Button size="sm" variant="accent" icon="plus" onClick={() => useUi.getState().setAddOpen(true)}>Add</Button>
        </div>
        <div className="gear-stash__row">
          <TextField
            size="sm"
            value={filters.search}
            onChange={(search) => store.setFilters({ search })}
            className="gear-stash__search"
          />
          <ShowingChip />
          <Select
            size="sm"
            prefix="Sort"
            options={SORTS}
            value={filters.sort}
            onChange={(v) => store.setFilters({ sort: v as SortMode })}
          />
        </div>
      </div>
      <LabelTab className="gear-stash__tab">{showArchive ? 'Archive' : `Stash · ${location}`}</LabelTab>
      <div className="gear-stash__body">
        <FilterStrip />
        <div ref={scroll} className="gear-stash__scroll">
          {grids.map((g) => <StashGrid key={g.key} grid={g.ref} active={g.active} behind={behind} />)}
        </div>
      </div>
    </section>
  );
}
