/**
 * Stash tabs Wedge manages: one tab per settings.locations entry, in order, and a `+` that opens an inline name field
 * (Enter adds, Esc cancels). The pencil after the Archive toggle opens the manager for the open tab: rename, move
 * left or right, delete (refused while any item names the tab, and for the last tab) and the stash Rows box.
 */
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { SegmentedControl } from '../primitives/SegmentedControl';
import { Button, IconButton } from '../primitives/Button';
import { getStore, useInventory } from '../hooks/useInv';
import { useUi } from '../uiStore';

const NO_LOCATIONS: string[] = [];

/** The scrolling row: the tabs and the `+` (or the new tab's name field). */
export function StashTabs() {
  const locations = useInventory((s) => s.inv?.settings.locations ?? NO_LOCATIONS);
  const location = useInventory((s) => s.stashLocation);
  const showArchive = useInventory((s) => s.showArchive);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [bad, setBad] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!adding) return;
    field.current?.focus();
    // keep the field in view at the end of a long row
    if (row.current) row.current.scrollLeft = row.current.scrollWidth;
  }, [adding]);

  const store = getStore();
  const open = (l: string) => { store.setStashLocation(l); if (store.showArchive) store.setShowArchive(false); };
  const cancel = () => { setAdding(false); setName(''); setBad(false); };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!getStore().addLocation(n)) { setBad(true); return; }
    cancel();
    open(n);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  };

  return (
    <div className="gear-tabs" ref={row}>
      {locations.length ? (
        <SegmentedControl
          options={locations}
          // the Archive spans every location, so no tab reads as chosen while it is shown
          value={showArchive ? '' : location}
          onChange={open}
          size="sm"
          aria-label="Stash tabs"
        />
      ) : null}
      {adding ? (
        <form className="gear-tabs__new" onSubmit={submit}>
          <input
            ref={field}
            className={bad ? 'gear-tabs__in gear-tabs__in--bad' : 'gear-tabs__in'}
            value={name}
            onChange={(e) => { setName(e.target.value); setBad(false); }}
            onKeyDown={onKey}
            onBlur={() => { if (!name.trim()) cancel(); }}
            placeholder="New tab"
            aria-label="New stash tab name"
            aria-invalid={bad}
            title={bad ? (name.trim() ? 'That tab already exists' : 'Type a name') : 'Enter adds the tab, Esc cancels'}
          />
        </form>
      ) : (
        <IconButton size="sm" icon="plus" label="Add a stash tab" className="gear-tabs__add" onClick={() => setAdding(true)} />
      )}
    </div>
  );
}

/** The pencil after the Archive toggle: opens and closes the manager for the open tab. */
export function StashTabsToggle() {
  const open = useUi((s) => s.tabsOpen);
  return (
    <IconButton size="sm" icon="edit" label="Edit this stash tab" pressed={open} aria-expanded={open}
      onClick={() => useUi.getState().setTabsOpen(!open)} />
  );
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** The manager box for the open tab, drawn over the grid under the header. */
export function StashTabsManager() {
  const open = useUi((s) => s.tabsOpen);
  const locations = useInventory((s) => s.inv?.settings.locations ?? NO_LOCATIONS);
  const location = useInventory((s) => s.stashLocation);
  const rows = useInventory((s) => s.inv?.settings.stashRows ?? 0);
  const minRows = useInventory((s) => s.minStashRows());
  const using = useInventory((s) => s.itemsAtLocation(location).length);
  const [name, setName] = useState(location);
  const [nameBad, setNameBad] = useState(false);
  const [rowsDraft, setRowsDraft] = useState(String(rows));
  const [rowsBad, setRowsBad] = useState(false);
  useEffect(() => { setName(location); setNameBad(false); }, [location]);
  useEffect(() => { setRowsDraft(String(rows)); setRowsBad(false); }, [rows]);
  if (!open || !locations.includes(location)) return null;

  const store = getStore();
  const i = locations.indexOf(location);
  const close = () => useUi.getState().setTabsOpen(false);
  const rename = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() === location) return;
    if (!store.renameLocation(location, name)) setNameBad(true);
  };
  const commitRows = () => {
    const n = Number(rowsDraft);
    if (n === rows) { setRowsBad(false); return; }
    setRowsBad(!store.setStashRows(n));
  };
  const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
  const deleteTitle = locations.length <= 1
    ? 'The last tab cannot be deleted'
    : using
      ? `Cannot delete: ${plural(using, 'item')} still ${using === 1 ? 'has' : 'have'} this location`
      : `Delete the ${location} tab`;
  const nameRefusal = nameBad ? (store.locationNameRefusal(name, location) === 'blank' ? 'Type a name' : 'That tab already exists') : null;

  return (
    <div className="gear-slots gear-tabsman" role="group" aria-label={`Stash tab ${location}`} onKeyDown={onEsc}>
      <div className="gear-slots__head">
        <span className="gear-slots__h">Tab · {location}</span>
        <button type="button" className="gear-slots__x" aria-label="Close the tab editor" onClick={close}>×</button>
      </div>
      <form className="gear-slots__add" onSubmit={rename}>
        <input
          className={nameBad ? 'gear-slots__in gear-tabs__in--bad' : 'gear-slots__in'}
          value={name}
          onChange={(e) => { setName(e.target.value); setNameBad(false); }}
          aria-label="Tab name"
          aria-invalid={nameBad}
          title={nameRefusal ?? 'Enter renames the tab'}
        />
        <Button type="submit" size="sm" disabled={name.trim() === location}>Rename</Button>
      </form>
      {nameRefusal ? <p className="gear-slots__err">{nameRefusal}</p> : null}
      <div className="gear-tabsman__row">
        <Button size="sm" disabled={i <= 0} onClick={() => store.moveLocation(location, -1)}>Move left</Button>
        <Button size="sm" disabled={i >= locations.length - 1} onClick={() => store.moveLocation(location, 1)}>Move right</Button>
        <span className="gear-stash__spacer" />
        <Button size="sm" className="gear-tabsman__del" disabled={locations.length <= 1 || using > 0} title={deleteTitle}
          onClick={() => { if (store.removeLocation(location)) close(); }}>
          Delete
        </Button>
      </div>
      <div className="gear-tabsman__row">
        <span className="gear-pockets__size" title={`Rows in every stash, ${minRows} to 200 (${minRows} is the lowest row in use)`}>
          <span className="gear-tabsman__k">Rows</span>
          <input
            type="number"
            min={minRows}
            max={200}
            value={rowsDraft}
            aria-label="Rows in every stash"
            aria-invalid={rowsBad}
            className={rowsBad ? 'gear-tabs__in--bad' : undefined}
            onChange={(e) => { setRowsDraft(e.target.value); setRowsBad(false); }}
            onBlur={commitRows}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitRows(); } }}
          />
          <span>{minRows} to 200 · every stash</span>
        </span>
      </div>
    </div>
  );
}
