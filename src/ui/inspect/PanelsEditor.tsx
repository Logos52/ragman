/**
 * Panels editor inside the Edit (and Add) form: each panel's name, grid (w x h), accepts and reserved regions
 * (name, at x,y, size w x h, accepts). The form saves it through store.setPanels, which checks it and re-places
 * contents that no longer fit. A blank accepts means anything. Panel sizes are starting guesses, adjusted here.
 */
import type { Panel } from '../../model/types';
import { Button } from '../primitives/Button';

export interface RegionDraft { name: string; x: string; y: string; w: string; h: string; accepts: string }
export interface PanelDraft { from: string | null; name: string; w: string; h: string; accepts: string; regions: RegionDraft[] }

const list = (s: string) => s.split(',').map((t) => t.trim()).filter(Boolean);
const int = (v: string, min: number): number | null => {
  const n = Number(v);
  return v.trim() !== '' && Number.isInteger(n) && n >= min ? n : null;
};

export function panelDrafts(panels: Panel[] | undefined): PanelDraft[] {
  return (panels ?? []).map((p) => ({
    from: p.name, name: p.name, w: String(p.grid[0]), h: String(p.grid[1]), accepts: (p.accepts ?? []).join(', '),
    regions: (p.regions ?? []).map((r) => ({
      name: r.name, x: String(r.at[0]), y: String(r.at[1]), w: String(r.size[0]), h: String(r.size[1]), accepts: r.accepts.join(', '),
    })),
  }));
}

/** Drafts -> panels, or a message naming the first problem. */
export function panelsOf(drafts: PanelDraft[]): { panels: Panel[]; from: (string | null)[] } | { error: string } {
  const names = new Set<string>();
  const panels: Panel[] = [];
  for (const d of drafts) {
    const name = d.name.trim();
    const w = int(d.w, 1), h = int(d.h, 1);
    if (!name) return { error: 'every panel needs a name' };
    if (names.has(name)) return { error: `two panels are named ${name}` };
    names.add(name);
    if (!w || !h) return { error: `${name}: the grid needs whole cells, 1 or more` };
    const accepts = list(d.accepts);
    const regions = [];
    for (const r of d.regions) {
      const rn = r.name.trim();
      const x = int(r.x, 0), y = int(r.y, 0), rw = int(r.w, 1), rh = int(r.h, 1);
      if (!rn) return { error: `${name}: every region needs a name` };
      if (x == null || y == null || !rw || !rh) return { error: `${name} · ${rn}: whole cells only` };
      if (x + rw > w || y + rh > h) return { error: `${name} · ${rn}: the region runs outside the ${w} × ${h} grid` };
      regions.push({ name: rn, at: [x, y] as [number, number], size: [rw, rh] as [number, number], accepts: list(r.accepts) });
    }
    panels.push({ name, grid: [w, h], accepts: accepts.length ? accepts : null, regions });
  }
  return { panels, from: drafts.map((d) => d.from) };
}

function Num({ value, onChange, label, min }: { value: string; onChange: (v: string) => void; label: string; min: number }) {
  return (
    <input className="rg-form__num rg-pe__num" type="number" min={min} max={40} value={value}
      onChange={(e) => onChange(e.target.value)} aria-label={label} />
  );
}

export function PanelsEditor({ drafts, onChange }: { drafts: PanelDraft[]; onChange: (d: PanelDraft[]) => void }) {
  const setP = (i: number, patch: Partial<PanelDraft>) => onChange(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const setR = (i: number, k: number, patch: Partial<RegionDraft>) =>
    setP(i, { regions: drafts[i].regions.map((r, j) => (j === k ? { ...r, ...patch } : r)) });
  return (
    <div className="rg-pe">
      {drafts.map((p, i) => {
        const label = p.name.trim() || `Panel ${i + 1}`;
        return (
          <div className="rg-pe__panel" key={i}>
            <div className="rg-pe__row">
              <span className="rg-pe__fields">
              <input className="rg-pe__text" value={p.name} placeholder="Name" aria-label={`Panel ${i + 1} name`}
                onChange={(e) => setP(i, { name: e.target.value })} />
              <span className="rg-form__pair">
                <Num value={p.w} min={1} label={`${label} grid width`} onChange={(w) => setP(i, { w })} />
                <span className="rg-form__x">×</span>
                <Num value={p.h} min={1} label={`${label} grid height`} onChange={(h) => setP(i, { h })} />
              </span>
              <input className="rg-pe__text rg-pe__acc" value={p.accepts} placeholder="accepts anything"
                aria-label={`${label} accepts`} onChange={(e) => setP(i, { accepts: e.target.value })} />
              </span>
              <button type="button" className="rg-pe__rm" aria-label={`Remove panel ${label}`}
                onClick={() => onChange(drafts.filter((_, j) => j !== i))}>×</button>
            </div>
            {p.regions.map((r, k) => (
              <div className="rg-pe__row rg-pe__row--region" key={k}>
                <span className="rg-pe__fields">
                <input className="rg-pe__text" value={r.name} placeholder="Region name" aria-label={`${label} region ${k + 1} name`}
                  onChange={(e) => setR(i, k, { name: e.target.value })} />
                <span className="rg-form__pair" title="Top-left cell, 0-based">
                  <span className="rg-pe__k">at</span>
                  <Num value={r.x} min={0} label={`${label} region ${k + 1} x`} onChange={(x) => setR(i, k, { x })} />
                  <Num value={r.y} min={0} label={`${label} region ${k + 1} y`} onChange={(y) => setR(i, k, { y })} />
                </span>
                <span className="rg-form__pair">
                  <Num value={r.w} min={1} label={`${label} region ${k + 1} width`} onChange={(w) => setR(i, k, { w })} />
                  <span className="rg-form__x">×</span>
                  <Num value={r.h} min={1} label={`${label} region ${k + 1} height`} onChange={(h) => setR(i, k, { h })} />
                </span>
                <input className="rg-pe__text rg-pe__acc" value={r.accepts} placeholder="accepts (laptop, flat)"
                  aria-label={`${label} region ${k + 1} accepts`} onChange={(e) => setR(i, k, { accepts: e.target.value })} />
                </span>
                <button type="button" className="rg-pe__rm" aria-label={`Remove region ${r.name || k + 1}`}
                  onClick={() => setP(i, { regions: p.regions.filter((_, j) => j !== k) })}>×</button>
              </div>
            ))}
            <Button size="sm" icon="plus" className="rg-pe__add"
              onClick={() => setP(i, { regions: [...p.regions, { name: '', x: '0', y: '0', w: '1', h: '1', accepts: '' }] })}>
              Region
            </Button>
          </div>
        );
      })}
      <Button size="sm" icon="plus" onClick={() => onChange([...drafts, { from: null, name: '', w: '2', h: '2', accepts: '', regions: [] }])}>
        Panel
      </Button>
    </div>
  );
}
