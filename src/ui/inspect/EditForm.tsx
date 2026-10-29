import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Select } from '../primitives/Select';
import { TextField } from '../primitives/TextField';
import { useUi } from '../uiStore';
import { getStore, kebab, uniqueSlug, useImagesTick, useInv, useInventory } from '../app/useStore';
import type { Item } from '../../model/types';
import { PasteZone } from './PasteZone';
import { PanelsEditor, panelDrafts, panelsOf, type PanelDraft } from './PanelsEditor';
import './inspect.css';

/** Editable fields only; the patch is built from these explicit fields (never home; panels go through setPanels). */
interface Draft {
  name: string; nameEn: string; maker: string; makerUrl: string;
  category: string; status: string; location: string;
  size: string; color: string;
  fw: string; fh: string; weight: string; weightLimit: string; quantity: string;
  tags: string; panelLayout: string;
  staple: boolean; consumable: boolean; specialCare: boolean;
  note: string; lesson: string;
}

const s2 = (v: unknown) => (v == null ? '' : String(v));

function draftOf(item: Partial<Item>): Draft {
  return {
    name: s2(item.name), nameEn: s2(item.nameEn), maker: s2(item.maker), makerUrl: s2(item.makerUrl),
    category: s2(item.category), status: s2(item.status), location: s2(item.location),
    size: s2(item.size), color: s2(item.color),
    fw: item.footprint ? String(item.footprint[0]) : '', fh: item.footprint ? String(item.footprint[1]) : '',
    weight: s2(item.weight_g), weightLimit: s2(item.weightLimit_g), quantity: s2(item.quantity),
    tags: (item.tags ?? []).join(', '), panelLayout: s2(item.panelLayout),
    staple: !!item.staple, consumable: !!item.consumable, specialCare: !!item.specialCare,
    note: s2(item.note), lesson: s2(item.lesson),
  };
}

const posInt = (v: string): number | null => {
  const n = Math.floor(Number(v));
  return v.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

const grams = (v: string): number | null => {
  const n = v.trim() === '' ? null : Number(v);
  return n != null && Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Draft -> item fields. Blank numbers become null; blank strings stay blank. The weight limit is a container's
 * (airline allowance); quantity is a consumable's stack size (1 or blank = absent, which counts as 1).
 */
function fieldsOf(d: Draft, container: boolean): Partial<Item> {
  const fw = posInt(d.fw), fh = posInt(d.fh);
  const q = posInt(d.quantity);
  return {
    name: d.name.trim(), nameEn: d.nameEn.trim(), maker: d.maker.trim(), makerUrl: d.makerUrl.trim(),
    category: d.category, status: d.status, location: d.location,
    size: d.size.trim() === '' ? null : d.size.trim(), color: d.color.trim(),
    footprint: fw && fh ? [fw, fh] : null,
    weight_g: grams(d.weight),
    weightLimit_g: container ? grams(d.weightLimit) : undefined,
    quantity: d.consumable && q && q > 1 ? q : undefined,
    panelLayout: container && d.panelLayout === 'column' ? 'column' : undefined,
    tags: d.tags.split(',').map((t) => t.trim()).filter(Boolean),
    staple: d.staple, consumable: d.consumable, specialCare: d.specialCare,
    note: d.note.trim(), lesson: d.lesson.trim(),
  };
}

/** Only the fields that changed (so an unchanged status or location never triggers a re-home). */
function diff(before: Item, after: Partial<Item>): Partial<Item> {
  const out: Record<string, unknown> = {};
  const norm = (v: unknown) => JSON.stringify(v === undefined || v === '' || v === false ? null : v);
  for (const k of Object.keys(after) as (keyof Item)[]) {
    if (norm(before[k]) !== norm(after[k])) out[k] = after[k];
  }
  return out as Partial<Item>;
}

function F({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? 'rg-form__f rg-form__f--wide' : 'rg-form__f'}>
      <span className="rg-form__k">{label}</span>
      {children}
    </label>
  );
}

interface ItemFormProps {
  mode: 'edit' | 'add';
  id?: string;
  item?: Item;
  onClose: () => void;
}

function ItemForm({ mode, id, item, onClose }: ItemFormProps) {
  const inv = useInv()!;
  const stashLocation = useInventory((s) => s.stashLocation);
  useImagesTick();
  const [d, setD] = useState<Draft>(() => draftOf(item ?? { location: stashLocation }));
  const [panels, setPanels] = useState<PanelDraft[]>(() => panelDrafts(item?.panels));
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  // The Modal focuses its card on mount (after child effects), so focus the name field a tick later.
  useEffect(() => {
    if (mode !== 'add') return;
    const t = window.setTimeout(() => nameRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [mode]);
  const set = <K extends keyof Draft>(k: K) => (v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const s = getStore();
  const { categories, statuses, locations } = inv.settings;
  const isContainer = panels.length > 0;
  const hadPanels = !!item?.panels?.length;
  const slug = mode === 'edit' ? id! : uniqueSlug(kebab(d.name) || kebab(d.nameEn), (k) => !!inv.items[k]);
  // Add item is paste, name, save (brief section 7): only the name is required; a blank category stays blank.
  const missing = mode === 'add' && !d.name.trim();
  const parsed = panelsOf(panels);
  const panelError = 'error' in parsed ? parsed.error : hadPanels && !panels.length ? 'a container keeps at least one panel' : null;
  const before = panelsOf(panelDrafts(item?.panels));
  const panelsChanged = 'panels' in parsed && JSON.stringify(parsed) !== JSON.stringify(before);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (missing || busy || panelError) return;
    setBusy(true);
    setError(null);
    try {
      let photo: string | undefined;
      if (blob) photo = await s.saveImage(`photos/${slug}.png`, blob);
      const fields = fieldsOf(d, isContainer);
      const cur = getStore().getItem(slug);
      if (mode === 'edit' && cur) {
        // Panels first, so a weight limit or layout written next lands on an item that is a container.
        if (panelsChanged && 'panels' in parsed && !getStore().setPanels(slug, parsed.panels, parsed.from)) {
          throw new Error('panels refused: a locked item would have to move');
        }
        const patch = diff(cur, fields) as Record<string, unknown>;
        if (photo) patch.images = { ...(cur.images ?? {}), photo };
        if (Object.keys(patch).length) getStore().updateItem(slug, patch as Partial<Item>);
      } else if (mode === 'add') {
        const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
        const newItem = { ...clean, images: photo ? { photo } : {} } as Item;
        getStore().addItem(slug, newItem);
        if ('panels' in parsed && parsed.panels.length) getStore().setPanels(slug, parsed.panels, parsed.panels.map(() => null));
        useUi.getState().select(slug);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const opt = (list: string[], blank: boolean) => [...(blank ? [{ value: '', label: '' }] : []), ...list];
  const catOpts = d.category && !categories.includes(d.category) ? [...categories, d.category] : categories;

  return (
    <Modal onClose={onClose} label={mode === 'add' ? 'Add item' : `Edit ${item?.name ?? ''}`} width={720}>
      <form className="rg-insp rg-form" onSubmit={submit}>
        <div className="rg-form__side">
          <PasteZone
            currentUrl={mode === 'edit' && id ? s.imageUrl(id, 'photo') : null}
            name={d.name}
            blob={blob}
            onBlob={setBlob}
          />
        </div>
        <div className="rg-insp__body">
          <h2 className="rg-insp__name">{mode === 'add' ? 'Add item' : 'Edit item'}</h2>
          <div className="rg-form__grid">
            <F label={mode === 'add' ? 'Name *' : 'Name'} wide>
              <TextField variant="plain" value={d.name} onChange={set('name')} ref={nameRef} />
            </F>
            <F label="Name (English)" wide><TextField variant="plain" value={d.nameEn} onChange={set('nameEn')} /></F>
            <F label="Maker"><TextField variant="plain" value={d.maker} onChange={set('maker')} /></F>
            <F label="Maker link"><TextField variant="plain" value={d.makerUrl} onChange={set('makerUrl')} /></F>
            <F label="Category">
              <Select value={d.category} onChange={set('category')} options={opt(catOpts, !d.category)} />
            </F>
            <F label="Status"><Select value={d.status} onChange={set('status')} options={opt(statuses, true)} /></F>
            <F label="Location"><Select value={d.location} onChange={set('location')} options={opt(locations, true)} /></F>
            <F label="Size"><TextField variant="plain" value={d.size} onChange={set('size')} /></F>
            <F label="Color"><TextField variant="plain" value={d.color} onChange={set('color')} /></F>
            <F label="Footprint (w × h)">
              <span className="rg-form__pair">
                <input className="rg-form__num" type="number" min={1} max={20} value={d.fw}
                  onChange={(e) => set('fw')(e.target.value)} aria-label="Footprint width" />
                <span className="rg-form__x">×</span>
                <input className="rg-form__num" type="number" min={1} max={20} value={d.fh}
                  onChange={(e) => set('fh')(e.target.value)} aria-label="Footprint height" />
              </span>
            </F>
            <F label="Weight (g)">
              <input className="rg-form__num rg-form__num--wide" type="number" min={0} step="any" value={d.weight}
                onChange={(e) => set('weight')(e.target.value)} />
            </F>
            {isContainer ? (
              <F label="Weight limit (g)">
                <input className="rg-form__num rg-form__num--wide" type="number" min={0} step="any" value={d.weightLimit}
                  onChange={(e) => set('weightLimit')(e.target.value)} aria-label="Weight limit (g)" />
              </F>
            ) : null}
            {d.consumable ? (
              <F label="Quantity">
                <input className="rg-form__num rg-form__num--wide" type="number" min={1} step={1} value={d.quantity}
                  onChange={(e) => set('quantity')(e.target.value)} aria-label="Quantity" />
              </F>
            ) : null}
            <F label="Tags (comma separated)" wide><TextField variant="plain" value={d.tags} onChange={set('tags')} /></F>
            <div className="rg-form__checks rg-form__f--wide">
              <label><input type="checkbox" checked={d.staple} onChange={(e) => set('staple')(e.target.checked)} /> Staple</label>
              <label><input type="checkbox" checked={d.consumable} onChange={(e) => set('consumable')(e.target.checked)} /> Consumable</label>
              <label><input type="checkbox" checked={d.specialCare} onChange={(e) => set('specialCare')(e.target.checked)} /> Special care</label>
            </div>
            <F label="Note" wide><TextField variant="plain" value={d.note} onChange={set('note')} /></F>
            <F label="Lesson" wide>
              <textarea className="rg-form__area" rows={2} value={d.lesson} onChange={(e) => set('lesson')(e.target.value)} />
            </F>
          </div>
          <div className="rg-form__sect">
            <span className="rg-form__k">{isContainer ? 'Panels' : 'Panels · add one to make this a container'}</span>
            {isContainer ? (
              <Select size="sm" value={d.panelLayout === 'column' ? 'column' : 'row'} onChange={set('panelLayout')} prefix="Layout"
                options={[{ value: 'row', label: 'Row' }, { value: 'column', label: 'Column' }]} aria-label="Panel layout" />
            ) : null}
          </div>
          <PanelsEditor drafts={panels} onChange={setPanels} />
          {panelError ? <p className="rg-form__err">Panels · {panelError}</p> : null}
          {mode === 'add' ? <p className="rg-form__aside">Lands 1 × 1 in the stash until sized{d.name.trim() ? ` · id ${slug}` : ''}</p> : null}
          {error ? <p className="rg-form__err">Not saved · {error}</p> : null}
          <div className="rg-insp__actions">
            <Button type="submit" variant="accent" disabled={missing || busy || !!panelError}>
              {busy ? 'Saving' : mode === 'add' ? 'Add' : 'Save'}
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </form>
      {mode === 'edit' ? <div className="rg-insp__slug">{id}</div> : null}
    </Modal>
  );
}

/** Edit form (uiStore.editId). */
export function EditForm() {
  const id = useUi((s) => s.editId);
  const inv = useInv();
  if (!id || !inv || !inv.items[id]) return null;
  return <ItemForm key={id} mode="edit" id={id} item={inv.items[id]} onClose={() => useUi.getState().edit(null)} />;
}

/** Add item form (uiStore.addOpen). Only the name is required; slug from the name. */
export function AddForm() {
  const open = useUi((s) => s.addOpen);
  const inv = useInv();
  if (!open || !inv) return null;
  return <ItemForm mode="add" onClose={() => useUi.getState().setAddOpen(false)} />;
}
