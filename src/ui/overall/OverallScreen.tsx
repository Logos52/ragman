/**
 * Overall tab: a read-only profile of the inventory. Every number comes from the store's overallSummary()
 * (engine/overall.ts). The only control is Export, which downloads the store's exportJson() (private fields stripped).
 */
import type { ReactNode } from 'react';
import { Button } from '../primitives/Button';
import { Chip } from '../primitives/Chip';
import { LabelTab } from '../primitives/LabelTab';
import { Tile } from '../primitives/Tile';
import { AllowanceMeter, WeightReadout } from '../primitives/WeightReadout';
import { getStore, useImagesTick, useInv, useInventory } from '../app/useStore';
import type { EmptyContainer, Inventory, StashFill } from '../../model/types';
import './overall.css';

function download() {
  const text = getStore().exportJson();
  if (!text) return;
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `ragman-inventory-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Section({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <section className={['rg-ov__sec', className ?? ''].filter(Boolean).join(' ')}>
      <LabelTab>{label}</LabelTab>
      <div className="rg-ov__body">{children}</div>
    </section>
  );
}

function CountRows({ rows, chips }: { rows: { name: string; count: number }[]; chips?: boolean }) {
  return (
    <ul className="rg-ov__rows">
      {rows.map((r) => (
        <li key={r.name || '(blank)'} className={r.count ? 'rg-ov__row' : 'rg-ov__row rg-ov__row--zero'}>
          <span className="rg-ov__name">
            {!r.name ? <span className="rg-ov__blank">Blank</span> : chips ? <Chip status={r.name} size="sm" /> : r.name}
          </span>
          <span className="rg-ov__num">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

function stashName(ref: StashFill['ref']): string {
  return ref.kind === 'archive' ? 'Archive' : ref.location;
}

function whereText(inv: Inventory, where: EmptyContainer['where']): string {
  if (!where) return '';
  switch (where.kind) {
    case 'stash': return `Stash · ${where.location}`;
    case 'archive': return 'Archive';
    case 'pockets': return 'Pockets';
    case 'slot': return `Slot · ${where.slot}`;
    case 'panel': {
      const c = inv.items[where.in];
      return c ? `In ${c.nickname || c.name}` : '';
    }
  }
}

export function OverallScreen() {
  const inv = useInv();
  useImagesTick();
  const s = useInventory((st) => st.overallSummary());
  const store = getStore();

  return (
    <div className="rg-overall">
      <section className="rg-ov__head">
        <div className="rg-ov__total">
          <span className="rg-ov__key">Items</span>
          <span className="rg-ov__big">{inv ? s.items : ''}</span>
        </div>
        <Button variant="ink" disabled={!inv} onClick={download}
          title="Download the inventory as JSON, without the private fields">
          Export JSON
        </Button>
      </section>

      {inv ? (
        <div className="rg-ov__grid">
          <div className="rg-ov__col">
            <Section label="Status"><CountRows rows={s.byStatus} chips /></Section>
          </div>
          <div className="rg-ov__col">
            <Section label="Location"><CountRows rows={s.byLocation} /></Section>

            <Section label="Loadouts">
              <ul className="rg-ov__rows">
                {s.loadouts.map((l) => (
                  <li key={l.name} className="rg-ov__row rg-ov__row--lo">
                    <span className="rg-ov__name">
                      {l.name}
                      {l.active ? <Chip tone="accent" size="sm">On screen</Chip> : null}
                    </span>
                    <span className="rg-ov__meta">
                      <span className="rg-ov__num">{l.items}</span> items
                    </span>
                    <WeightReadout grams={l.weight.grams} unweighed={l.weight.unweighed} estimated={l.weight.estimated}
                      overLimit={false} className="rg-ov__weight" />
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          <div className="rg-ov__col">
            <Section label="Stashes">
              <ul className="rg-ov__rows">
                {s.stashes.map((f) => (
                  <li key={stashName(f.ref)} className={f.items ? 'rg-ov__row rg-ov__row--stash' : 'rg-ov__row rg-ov__row--stash rg-ov__row--zero'}>
                    <span className="rg-ov__name">{stashName(f.ref)}</span>
                    {f.fill === null ? (
                      <span className="rg-ov__meta">Empty</span>
                    ) : (
                      <span className="rg-ov__meta">
                        {f.items} items · {f.occupied} / {f.cells} cells · {f.rows} rows
                      </span>
                    )}
                    <span className="rg-ov__num rg-ov__pct">{f.fill === null ? '' : `${Math.round(f.fill * 100)}%`}</span>
                    {f.fill === null ? null : <AllowanceMeter grams={f.occupied} limit={f.cells} overLimit={false} className="rg-ov__meter" />}
                  </li>
                ))}
              </ul>
            </Section>

            <Section label="Empty containers">
              {s.emptyContainers.length ? (
                <ul className="rg-ov__rows">
                  {s.emptyContainers.map((e) => {
                    const item = inv.items[e.id];
                    return (
                      <li key={e.id} className="rg-ov__row rg-ov__row--box">
                        <Tile name={item.name} art={store.imageUrl(e.id, 'cell')} w={1} h={1} rotated={false} container size={48}
                          className="rg-ov__tile" />
                        <span className="rg-ov__boxtext">
                          <span className="rg-ov__boxname">{item.nickname || item.name}</span>
                          <span className="rg-ov__where">{whereText(inv, e.where)}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="rg-ov__none">None</div>
              )}
            </Section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
