import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ContextMenu } from '../primitives/ContextMenu';
import type { ContextMenuItem, ContextSubItem } from '../primitives/ContextMenu';
import { useUi } from '../uiStore';
import { getStore, useInv } from '../app/useStore';

type Mode = 'menu' | 'confirm' | 'rename' | 'split';

/**
 * An inline field inside a menu row: focused on mount, Enter submits, Esc goes back to the menu.
 * Its keys never reach the menu's own arrow/Enter handling.
 */
function InlineField({ label, initial, numeric, max, onSubmit, onCancel }: {
  label: string; initial: string; numeric?: boolean; max?: number;
  onSubmit: (v: string) => void; onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  // after the menu focuses itself on mount
  useEffect(() => { const t = window.setTimeout(() => { ref.current?.focus(); ref.current?.select(); }, 0); return () => window.clearTimeout(t); }, []);
  const n = Math.floor(Number(v));
  const valid = !numeric || (v.trim() !== '' && Number.isFinite(n) && n >= 1 && (max == null || n <= max));
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); if (valid) onSubmit(v); }
    else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };
  return (
    <>
      <span className="rg-cmenu__label">{label}</span>
      <input
        ref={ref}
        className={numeric ? 'rg-cmenu__in rg-cmenu__in--num' : 'rg-cmenu__in'}
        type={numeric ? 'number' : 'text'}
        inputMode={numeric ? 'numeric' : undefined}
        min={numeric ? 1 : undefined}
        max={numeric ? max : undefined}
        value={v}
        aria-label={label}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={onKey}
      />
      {numeric && max != null ? <span className="rg-cmenu__of">of {max + 1}</span> : null}
      <button type="button" className="rg-cmenu__ok" disabled={!valid} onClick={() => onSubmit(v)}>OK</button>
    </>
  );
}

/**
 * Right-click menu for an item, in DESIGN.md order:
 * Open (containers), Inspect, Filter by item, Equip to slot ›, Attach to › (when a slot takes it) or Detach (when
 * attached), Move to Stash, Archive/Unarchive,
 * Add to Quick Use ›, Pin/Unpin, Lock/Unlock, Mark verified/unverified, Rename (containers, inline input),
 * Split stack (stacks of 2 or more, inline count), Edit, Delete (two-step inline confirm, always last).
 * A locked item keeps the rows that do not move it; the moving rows and Delete are disabled.
 */
export function ItemContextMenu() {
  const menu = useUi((s) => s.contextMenu);
  const dragging = useUi((s) => s.dragging);
  const inv = useInv();
  const [mode, setMode] = useState<Mode>('menu');
  /** Set by a row that switches mode, so the close the primitive fires before onSelect is skipped. */
  const keepOpen = useRef(false);

  useEffect(() => { setMode(menu?.mode ?? 'menu'); keepOpen.current = false; }, [menu?.id, menu?.x, menu?.y, menu?.mode]);

  if (!menu || dragging || !inv) return null;
  const id = menu.id;
  const item = inv.items[id];
  if (!item) return null;
  const s = getStore();
  const ui = useUi.getState();
  const locked = !!item.locked;
  const container = s.isContainer(id);
  const qty = s.quantityOf(id);
  const stack = !!item.consumable && qty > 1;

  const close = () => {
    // The primitive calls onClose, then the row's onSelect; defer so a row can keep the menu open.
    queueMicrotask(() => {
      if (keepOpen.current) { keepOpen.current = false; return; }
      setMode('menu');
      useUi.getState().closeMenu();
    });
  };
  const switchTo = (m: Mode) => () => { keepOpen.current = true; setMode(m); };
  const done = () => { setMode('menu'); useUi.getState().closeMenu(); };

  let items: ContextMenuItem[];
  if (mode === 'confirm') {
    items = locked
      ? [
        { label: `${item.name} is locked`, prompt: true },
        { label: 'Unlock to delete', prompt: true },
        { label: 'OK', onSelect: () => {} },
      ]
      : [
        { label: `Delete ${item.name}?`, prompt: true },
        { label: 'Yes, delete', danger: true, onSelect: () => { s.deleteItem(id); if (ui.selectedId === id) ui.select(null); } },
        { label: 'No', onSelect: () => {} },
      ];
  } else {
    const slots: ContextSubItem[] = s.activeLoadout().slots
      .filter((slot) => s.canFit(id, { kind: 'slot', slot }).ok)
      .map((slot) => ({ label: slot, onSelect: () => { s.equip(id, slot); } }));

    const qu = inv.quickUse;
    const firstEmpty = qu.findIndex((q) => !q);
    const quick: ContextSubItem[] = [
      ...(firstEmpty >= 0 && !qu.includes(id)
        ? [{ label: 'First empty box', onSelect: () => s.setQuickUse(firstEmpty, id) }]
        : []),
      ...qu.map((occ, i) => {
        const digit = (i + 1) % 10;
        const what = occ ? (occ === id ? 'here' : inv.items[occ]?.name ?? '') : 'empty';
        return { label: `${digit} · ${what}`, disabled: occ === id, onSelect: () => s.setQuickUse(i, id) };
      }),
    ];

    // Attach to: every attachment slot that takes this item (a band on the watch); a taken slot swaps.
    const attachRows: ContextSubItem[] = item.attachedTo ? [] : s.attachTargets(id).map(({ parent, slot }) => {
      const occ = s.attachmentsOf(parent).find((a) => a.slot === slot);
      const pname = inv.items[parent]?.name ?? parent;
      return { label: occ ? `${pname} · ${slot} (swap)` : `${pname} · ${slot}`, onSelect: () => { s.attach(id, parent, slot); } };
    });
    const archived = item.status === 'Not Worn';
    const inStash = s.effectivePlace(id)?.kind === 'stash';

    const renameRow: ContextMenuItem = mode === 'rename'
      ? {
        label: 'Rename',
        content: (
          <InlineField
            label="Name"
            initial={item.nickname ?? ''}
            onSubmit={(v) => { s.setNickname(id, v.trim() || null); done(); }}
            onCancel={() => setMode('menu')}
          />
        ),
      }
      : { label: 'Rename', onSelect: switchTo('rename') };

    const splitRow: ContextMenuItem = mode === 'split'
      ? {
        label: 'Split stack',
        content: (
          <InlineField
            label="Split"
            initial="1"
            numeric
            max={qty - 1}
            onSubmit={(v) => { s.splitStack(id, Math.floor(Number(v))); done(); }}
            onCancel={() => setMode('menu')}
          />
        ),
      }
      : { label: 'Split stack', disabled: locked, onSelect: switchTo('split') };

    const filterBy = () => {
      ui.setJobFilter({ id, ids: new Set(s.sameJob(id)), label: item.category });
    };

    items = [
      ...(container ? [{ label: 'Open', onSelect: () => s.openWindow(id) }] : []),
      { label: 'Inspect', onSelect: () => ui.inspect(id) },
      { label: 'Filter by item', onSelect: filterBy },
      { label: 'Equip to slot', disabled: locked, submenu: locked ? undefined : slots },
      ...(item.attachedTo
        ? [{ label: 'Detach', disabled: locked, onSelect: () => { s.detach(id); } }]
        : attachRows.length ? [{ label: 'Attach to', disabled: locked, submenu: locked ? undefined : attachRows }] : []),
      { label: 'Move to Stash', disabled: inStash || locked, onSelect: () => s.sendToStash(id) },
      archived
        ? { label: 'Unarchive', disabled: locked, onSelect: () => s.unarchive(id) }
        : { label: 'Archive', disabled: locked, onSelect: () => s.archive(id) },
      { label: 'Add to Quick Use', submenu: quick },
      item.pinned
        ? { label: 'Unpin', onSelect: () => s.setPinned(id, false) }
        : { label: 'Pin', onSelect: () => s.setPinned(id, true) },
      locked
        ? { label: 'Unlock', onSelect: () => s.setLocked(id, false) }
        : { label: 'Lock', onSelect: () => s.setLocked(id, true) },
      item.verified
        ? { label: 'Mark unverified', onSelect: () => s.setVerified(id, false) }
        : { label: 'Mark verified', onSelect: () => s.setVerified(id, true) },
      ...(container ? [renameRow] : []),
      ...(stack ? [splitRow] : []),
      { label: 'Edit', onSelect: () => ui.edit(id) },
      { label: 'Delete', danger: !locked, disabled: locked, onSelect: switchTo('confirm') },
    ];
  }

  return <ContextMenu key={mode === 'confirm' ? 'confirm' : 'menu'} x={menu.x} y={menu.y} items={items} onClose={close} />;
}
