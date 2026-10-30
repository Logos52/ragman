import { memo, useCallback, useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Window } from '../primitives/Window';
import { Chip } from '../primitives/Chip';
import { Button } from '../primitives/Button';
import { useUi } from '../uiStore';
import { fmtCells, fmtGrams, getStore, useImagesTick, useInv } from '../app/useStore';
import { ContainerPanels, containerTitle, useWindowPos, useWindowZ } from '../gear/ContainerWindows';
import './inspect.css';

/** The photo on --grid-bg, or the grey placeholder with the name. Never a stand-in image. */
export function Photo({ url, name }: { url: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  return (
    <div className="rg-insp__photo">
      {url && !broken
        ? <img src={url} alt="" onError={() => setBroken(true)} />
        : <div className="rg-insp__ph"><span>{name}</span></div>}
    </div>
  );
}

function Row({ k, children }: { k: string; children?: ReactNode }) {
  return (
    <>
      <dt className="rg-insp__k">{k}</dt>
      <dd className="rg-insp__v">{children}</dd>
    </>
  );
}

/** The card body for one item: every shown field, blank values as blank cells; a container's live panels below. */
export function InspectBody({ id }: { id: string }) {
  const inv = useInv();
  useImagesTick();
  if (!inv) return null;
  const item = inv.items[id];
  if (!item) return null;
  const s = getStore();
  const ui = useUi.getState();
  const attachments = s.attachmentsOf(id);
  const isContainer = s.isContainer(id);
  const maker = (item.maker ?? '').trim();
  const makerUrl = (item.makerUrl ?? '').trim();

  return (
    <div className="rg-insp-wrap">
      <div className="rg-insp">
        <Photo url={s.imageUrl(id, 'photo')} name={item.name} />
        <div className="rg-insp__body">
          <h2 className="rg-insp__name">{item.name}</h2>
          {item.nameEn ? <div className="rg-insp__en">{item.nameEn}</div> : null}
          <div className="rg-insp__chips">
            <Chip status={item.status} />
            {item.specialCare ? <Chip tone="accent" size="sm">Special care</Chip> : null}
            {item.consumable ? <Chip tone="outline" size="sm">Consumable</Chip> : null}
            {item.pinned ? <Chip tone="outline" size="sm">Pinned</Chip> : null}
            {item.locked ? <Chip tone="ink" size="sm">Locked</Chip> : null}
          </div>
          <label className={item.verified ? 'rg-insp__verify rg-insp__verify--on' : 'rg-insp__verify'}>
            <input
              type="checkbox"
              checked={!!item.verified}
              onChange={(e) => s.setVerified(id, e.target.checked)}
            />
            <span>Verified</span>
            {!item.verified ? <span className="rg-insp__unv" aria-hidden>?</span> : null}
          </label>
          <dl className="rg-insp__fields">
            <Row k="Maker">
              {makerUrl
                ? <a href={makerUrl} target="_blank" rel="noopener noreferrer">{maker || makerUrl}</a>
                : maker}
            </Row>
            {isContainer ? <Row k="Nickname">{item.nickname}</Row> : null}
            <Row k="Category">{item.category}</Row>
            <Row k="Location">{item.location}</Row>
            <Row k="Size">{item.size}</Row>
            <Row k="Color">{item.color}</Row>
            <Row k="Footprint">{fmtCells(item.footprint)}</Row>
            <Row k="Weight">{item.weightEstimated && item.weight_g != null ? `~${fmtGrams(item.weight_g)} · estimate` : fmtGrams(item.weight_g)}</Row>
            {item.consumable ? <Row k="Quantity">{s.quantityOf(id)}</Row> : null}
            <Row k="Tags">{(item.tags ?? []).join(', ')}</Row>
            <Row k="Note">{item.note}</Row>
            <Row k="Lesson">{item.lesson}</Row>
            <Row k="Attachments">
              {attachments.length ? (
                <ul className="rg-insp__list">
                  {attachments.map((a) => (
                    <li key={a.slot + a.item}>
                      <span className="rg-insp__sub">{a.slot}</span>{' '}
                      <button type="button" className="rg-insp__link" onClick={() => ui.inspect(a.item)}>
                        {inv.items[a.item]?.name ?? a.item}
                      </button>{' '}
                      <button type="button" className="rg-insp__detach" disabled={!!inv.items[a.item]?.locked}
                        onClick={() => s.detach(a.item)} aria-label={`Detach ${inv.items[a.item]?.name ?? a.item}`}>
                        Detach
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Row>
            {isContainer ? (
              <Row k="Panels">
                <ul className="rg-insp__list">
                  {(item.panels ?? []).map((p) => (
                    <li key={p.name}>
                      <span className="rg-insp__pname">{p.name}</span> {fmtCells(p.grid)}
                      {p.accepts?.length ? <span className="rg-insp__sub"> · accepts {p.accepts.join(', ')}</span> : null}
                      {(p.regions ?? []).map((r) => (
                        <div key={r.name} className="rg-insp__region">
                          {r.name} {fmtCells(r.size)}
                          {r.accepts.length ? ` · ${r.accepts.join(', ')}` : ''}
                        </div>
                      ))}
                    </li>
                  ))}
                </ul>
              </Row>
            ) : null}
          </dl>
          <div className="rg-insp__actions">
            <Button variant="accent" onClick={() => ui.edit(id)}>Edit</Button>
            {isContainer ? <Button onClick={() => s.openWindow(id)}>Open</Button> : null}
            <Button onClick={() => ui.closeInspect(id)}>Close</Button>
          </div>
        </div>
      </div>
      {isContainer ? (
        <div className="rg-insp__grids">
          <div className="rg-insp__k">Contents</div>
          <ContainerPanels id={id} scope={`insp:${id}`} />
        </div>
      ) : null}
      <div className="rg-insp__slug">{id}</div>
    </div>
  );
}

const InspectWindow = memo(function InspectWindow({ id, index }: { id: string; index: number }) {
  const item = useInv()?.items[id];
  const { pos, box, onMove, onMoveEnd } = useWindowPos('inspect', id, { x: 140 + 28 * index, y: 70 + 28 * index });
  const z = useWindowZ(`i:${id}`, index);
  const onRaise = useCallback(() => useUi.getState().raise(`i:${id}`), [id]);
  const onClose = useCallback(() => useUi.getState().closeInspect(id), [id]);
  if (!item) return null;
  const title = getStore().isContainer(id) ? containerTitle(item) : item.name;
  return (
    // --rg-cascade shortens the window by its cascade offset, so a tall card never gets clamped back over the one
    // under it (on a phone every card is capped at the screen height): the cascade always shows
    <div ref={box} className="gear-win-host" style={{ '--rg-cascade': `${28 * index}px` } as CSSProperties}>
      <Window
        title={`Inspect · ${title}`}
        x={pos.x}
        y={pos.y}
        z={z}
        onMove={onMove}
        onMoveEnd={onMoveEnd}
        onRaise={onRaise}
        onClose={onClose}
        className="rg-insp-win"
      >
        <InspectBody id={id} />
      </Window>
    </div>
  );
});

/** Every open Inspect window (uiStore.inspectIds), cascaded, movable, several at once. Not modal. */
export function InspectWindows() {
  const ids = useUi((s) => s.inspectIds);
  const inv = useInv();
  // an item deleted while its card is open: close the card
  useEffect(() => {
    if (!inv) return;
    for (const id of ids) if (!inv.items[id]) useUi.getState().closeInspect(id);
  }, [inv, ids]);
  return <>{ids.map((id, i) => <InspectWindow key={id} id={id} index={i} />)}</>;
}
