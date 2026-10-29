import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  Banner, Button, CarriedReadout, CategoryGlyph, Chip, ComingLater, ContextMenu, EmptyState, Figure, Glyph, GridPos,
  GridSurface, IconButton, LabelTab, LuggageTag, Modal, SaveBadge, SegmentedControl, Select, SlotBox, TabBar,
  TextField, Tile, Tooltip, TooltipTitle, Window, WeightReadout, categoryGlyphNames, slotGlyphNames, statusNames,
  uiGlyphNames, useHoverTooltip,
} from '../primitives';
import './Gallery.css';

/* ---- sample art: simple drawn SVGs (gallery only; never shipped as item art) ---- */
const svg = (w: number, h: number, body: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`;

const ART = {
  tee: svg(100, 100, '<path d="M34 12 12 24 4 44l14 6 4-6v46h56V44l4 6 14-6-8-20-22-12c-2 8-8 12-16 12s-14-4-16-12Z" fill="#2B3A55"/>'),
  phone: svg(50, 100, '<rect x="6" y="3" width="38" height="94" rx="7" fill="#3A3F47"/><rect x="10" y="10" width="30" height="76" fill="#8FB3D9"/>'),
  backpack: svg(100, 100, '<rect x="18" y="20" width="64" height="74" rx="14" fill="#353B33"/><rect x="30" y="56" width="40" height="28" rx="4" fill="#4A5246"/><path d="M38 20v-8h24v8" stroke="#353B33" stroke-width="6" fill="none"/>'),
  jacket: svg(100, 100, '<path d="M32 8 10 18 4 92h30V52l16-36 16 36v40h30l-6-74L68 8 50 20Z" fill="#B44A2C"/><path d="M50 20v72" stroke="#7A2E18" stroke-width="2"/>'),
  trousers: svg(60, 100, '<path d="M10 4h40l4 92H36L30 34l-6 62H6Z" fill="#6E6A5E"/>'),
  watch: svg(100, 100, '<rect x="38" y="4" width="24" height="92" fill="#222"/><circle cx="50" cy="50" r="22" fill="#D9DEE5" stroke="#222" stroke-width="6"/>'),
  cable: svg(100, 50, '<path d="M8 25c20-20 30 20 50 0s24 0 34 0" stroke="#EDEDED" stroke-width="8" fill="none"/><path d="M8 25c20-20 30 20 50 0s24 0 34 0" stroke="#AEB7C2" stroke-width="1.5" fill="none"/>'),
};

const SECTION_IDS = ['tokens', 'type', 'tiles', 'grid', 'slots', 'doll', 'chips', 'controls', 'tabbar', 'readouts', 'overlays', 'glyphs', 'states'];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="gx-section" id={id}>
      <h2 className="gx-h2 label">{title}</h2>
      <div className="gx-body">{children}</div>
    </section>
  );
}

function Spec({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="gx-spec">
      <div className="gx-spec__demo">{children}</div>
      <div className="gx-spec__label">{label}</div>
    </div>
  );
}

const cellBox = (w: number, h: number): CSSProperties => ({
  width: `calc(var(--cell) * ${w} - 1px)`,
  height: `calc(var(--cell) * ${h} - 1px)`,
});

export function Gallery() {
  const [tab, setTab] = useState('gear');
  const [loadout, setLoadout] = useState('Travel');
  const [loc, setLoc] = useState('USA');
  const [archive, setArchive] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('name');
  const [menuOpen, setMenuOpen] = useState(true);
  const [win, setWin] = useState({ x: 16, y: 16, z: 2 });
  const [win2, setWin2] = useState(() => (window.innerWidth < 640 ? { x: 40, y: 210, z: 1 } : { x: 300, y: 70, z: 1 }));
  const [winOpen, setWinOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty' | 'error'>('error');
  const [flashKey, setFlashKey] = useState(0);
  const hover = useHoverTooltip();
  const raise = (which: 1 | 2) => {
    const top = Math.max(win.z, win2.z) + 1;
    if (which === 1) setWin((w) => ({ ...w, z: top })); else setWin2((w) => ({ ...w, z: top }));
  };

  return (
    <div className="gx">
      <TabBar
        tabs={[{ id: 'overall', label: 'Overall' }, { id: 'gear', label: 'Gear' }, { id: 'tasks', label: 'Tasks' }, { id: 'skills', label: 'Skills' }]}
        active={tab}
        onChange={setTab}
      />
      <header className="gx-head">
        <h1 className="gx-h1 label">Ragman primitives</h1>
        <p className="gx-lede">Every primitive in every state, on the page background. <code>?gallery</code></p>
        <nav className="gx-toc">
          {SECTION_IDS.map((s) => <a key={s} href={`#${s}`} className="label">{s}</a>)}
        </nav>
      </header>

      <Section id="tokens" title="Tokens">
        <div className="gx-swatches">
          {['page', 'panel', 'line', 'grid-bg', 'grid-line', 'tile', 'tile-line', 'ink', 'ink-2', 'ink-3', 'accent', 'accent-ink', 'ok', 'bad', 'region'].map((t) => (
            <div key={t} className="gx-swatch">
              <span className="gx-swatch__chip" style={{ background: `var(--${t})` }} />
              <span className="gx-swatch__name">--{t}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="type" title="Type">
        <div className="gx-type">
          <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 28 }} className="label">Barlow Condensed 700 · Departures 14:05</div>
          <div style={{ fontFamily: 'var(--font-label)', fontWeight: 600, fontSize: 20 }} className="label">Barlow Condensed 600 · Gate B12 · Boarding</div>
          <div style={{ fontFamily: 'var(--font-label)', fontWeight: 500, fontSize: 16 }} className="label">Barlow Condensed 500 · Carry-on 7.0 kg</div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Barlow 600 · The quick brown fox jumps over the lazy dog.</div>
          <div style={{ fontWeight: 500, fontSize: 14 }}>Barlow 500 · Merino tee, washed cold, line dry.</div>
          <div style={{ fontWeight: 400, fontSize: 13 }}>Barlow 400 · 13 px body for the Inspect card field list. 0123456789</div>
        </div>
      </Section>

      <Section id="tiles" title="Tiles">
        <div className="gx-row">
          <Spec label="1x1 art"><div style={cellBox(1, 1)}><Tile name="Watch" art={ART.watch} w={1} h={1} rotated={false} /></div></Spec>
          <Spec label="2x2 art"><div style={cellBox(2, 2)}><Tile name="Uniqlo Merino Crew Tee" art={ART.tee} w={2} h={2} rotated={false} /></div></Spec>
          <Spec label="1x2 upright"><div style={cellBox(1, 2)}><Tile name="Phone" art={ART.phone} w={1} h={2} rotated={false} /></div></Spec>
          <Spec label="rotated 2x1"><div style={cellBox(2, 1)}><Tile name="Phone" art={ART.phone} w={2} h={1} rotated /></div></Spec>
          <Spec label="rotated 3x2"><div style={cellBox(3, 2)}><Tile name="Chinos" art={ART.trousers} w={3} h={2} rotated /></div></Spec>
          <Spec label="container"><div style={cellBox(2, 2)}><Tile name="Osprey Daylite" art={ART.backpack} w={2} h={2} rotated={false} container /></div></Spec>
          <Spec label="container 1x1"><div style={cellBox(1, 1)}><Tile name="Packing cube" art={null} w={1} h={1} rotated={false} container /></div></Spec>
          <Spec label="placeholder"><div style={cellBox(1, 1)}><Tile name="Darn Tough Hiker Socks" art={null} w={1} h={1} rotated={false} /></div></Spec>
          <Spec label="placeholder 2x2"><div style={cellBox(2, 2)}><Tile name="Arc'teryx Atom Hoody" art={null} w={2} h={2} rotated={false} /></div></Spec>
          <Spec label="broken image"><div style={cellBox(1, 1)}><Tile name="Missing photo" art="/data/images/does-not-exist.png" w={1} h={1} rotated={false} /></div></Spec>
          <Spec label="special care"><div style={cellBox(2, 2)}><Tile name="Wool coat" art={ART.jacket} w={2} h={2} rotated={false} specialCare /></div></Spec>
          <Spec label="consumable"><div style={cellBox(1, 1)}><Tile name="Toothpaste" art={null} w={1} h={1} rotated={false} consumable /></div></Spec>
          <Spec label="selected"><div style={cellBox(2, 2)}><Tile name="Jacket" art={ART.jacket} w={2} h={2} rotated={false} selected /></div></Spec>
          <Spec label="dragging"><div style={cellBox(2, 2)}><Tile name="Jacket" art={ART.jacket} w={2} h={2} rotated={false} dragging /></div></Spec>
          <Spec label="luggage tag"><div style={cellBox(2, 2)}><Tile name="Tee" art={ART.tee} w={2} h={2} rotated={false} locationTag="Vietnam" /></div></Spec>
          <Spec label="tag on 1x1"><div style={cellBox(1, 1)}><Tile name="Cable" art={ART.cable} w={1} h={1} rotated={false} locationTag="USA" consumable specialCare /></div></Spec>
          <Spec label="fixed size=40"><Tile name="Cable" art={ART.cable} w={2} h={1} rotated={false} size={40} /></Spec>
          <Spec label="failed drop flash">
            <div style={cellBox(1, 1)} onClick={() => setFlashKey((k) => k + 1)}>
              <Tile key={flashKey} name="Click me" art={null} w={1} h={1} rotated={false} flash={flashKey > 0} />
            </div>
          </Spec>
          <Spec label="luggage tag alone"><LuggageTag>Vietnam</LuggageTag></Spec>
        </div>
      </Section>

      <Section id="grid" title="Grid surface">
        <div className="gx-row gx-row--top">
          <Spec label="stash 10 wide, region, items, ok highlight">
            <GridSurface
              width={10}
              height={6}
              regions={[{ name: 'Toiletries', at: [6, 3], size: [4, 3], accepts: ['toiletries'] }]}
              highlight={{ cells: [[4, 0], [5, 0], [4, 1], [5, 1]], ok: true }}
            >
              <GridPos x={0} y={0} w={2} h={2}><Tile name="Merino Tee" art={ART.tee} w={2} h={2} rotated={false} /></GridPos>
              <GridPos x={2} y={0} w={1} h={2}><Tile name="Phone" art={ART.phone} w={1} h={2} rotated={false} /></GridPos>
              <GridPos x={0} y={2} w={3} h={2}><Tile name="Chinos" art={ART.trousers} w={3} h={2} rotated /></GridPos>
              <GridPos x={3} y={2} w={2} h={2}><Tile name="Osprey Daylite" art={ART.backpack} w={2} h={2} rotated={false} container selected /></GridPos>
              <GridPos x={6} y={0} w={1} h={1}><Tile name="Watch" art={ART.watch} w={1} h={1} rotated={false} /></GridPos>
              <GridPos x={7} y={0} w={1} h={1}><Tile name="Hiking socks" art={null} w={1} h={1} rotated={false} /></GridPos>
              <GridPos x={7} y={4} w={1} h={1}><Tile name="Toothpaste" art={null} w={1} h={1} rotated={false} consumable /></GridPos>
              <GridPos x={8} y={1} w={2} h={2}><Tile name="Wool coat" art={ART.jacket} w={2} h={2} rotated={false} specialCare /></GridPos>
            </GridSurface>
          </Spec>
          <Spec label="bad highlight over an item">
            <GridSurface width={4} height={3} highlight={{ cells: [[1, 0], [2, 0], [1, 1], [2, 1]], ok: false }}>
              <GridPos x={0} y={0} w={2} h={2}><Tile name="Tee" art={ART.tee} w={2} h={2} rotated={false} /></GridPos>
            </GridSurface>
          </Spec>
          <Spec label="fixed cell=24, empty">
            <GridSurface width={6} height={3} cell={24} />
          </Spec>
          <Spec label="pockets 4x1">
            <div>
              <LabelTab>Pockets</LabelTab>
              <GridSurface width={4} height={1}>
                <GridPos x={0} y={0} w={1} h={1}><Tile name="Phone" art={ART.phone} w={1} h={1} rotated={false} /></GridPos>
              </GridSurface>
            </div>
          </Spec>
        </div>
      </Section>

      <Section id="slots" title="Slot boxes">
        <div className="gx-row">
          <Spec label="empty"><SlotBox label="Head" glyph="head" /></Spec>
          <Spec label="filled"><SlotBox label="Torso Base" glyph="torso-base"><Tile name="Merino Tee" art={ART.tee} w={1} h={1} rotated={false} /></SlotBox></Spec>
          <Spec label="selected"><SlotBox label="Wrist" glyph="wrist" selected><Tile name="Watch" art={ART.watch} w={1} h={1} rotated={false} selected /></SlotBox></Spec>
          <Spec label="highlight ok"><SlotBox label="Legs" glyph="legs" highlight="ok" /></Spec>
          <Spec label="highlight bad"><SlotBox label="Feet" glyph="feet" highlight="bad"><Tile name="Boots" art={null} w={1} h={1} rotated={false} /></SlotBox></Spec>
          <Spec label="carry slot"><SlotBox label="Backpack" glyph="backpack" /></Spec>
          <Spec label="quick use">
            <div>
              <LabelTab>Quick use</LabelTab>
              <div className="gx-quick">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d, i) => (
                  <SlotBox key={d} label="" glyph="" corner={d}>
                    {i === 1 ? <Tile name="Phone" art={ART.phone} w={1} h={1} rotated={false} /> : null}
                  </SlotBox>
                ))}
              </div>
            </div>
          </Spec>
        </div>
      </Section>

      <Section id="doll" title="Figure and paper doll">
        <div className="gx-row gx-row--top">
          <Spec label="placeholder figure (baseUrl null)">
            <div className="gx-fig"><Figure baseUrl={null} layers={[]} /></div>
          </Spec>
          <Spec label="broken base falls back">
            <div className="gx-fig"><Figure baseUrl="/data/images/avatar/missing.png" layers={[]} /></div>
          </Spec>
          <Spec label="paper doll composition">
            <div className="gx-doll">
              <div className="gx-doll__col">
                {['Head', 'Eyes', 'Ears', 'Neck', 'Wrist'].map((s) => (
                  <SlotBox key={s} label={s} glyph={s.toLowerCase()}>
                    {s === 'Wrist' ? <Tile name="Watch" art={ART.watch} w={1} h={1} rotated={false} /> : null}
                  </SlotBox>
                ))}
              </div>
              <div className="gx-doll__mid">
                <Figure baseUrl={null} layers={[]} />
                <SlotBox label="Feet" glyph="feet" />
              </div>
              <div className="gx-doll__col">
                {['Torso Outer', 'Torso Mid', 'Torso Base', 'Hands', 'Legs', 'Underwear', 'Socks'].map((s) => (
                  <SlotBox key={s} label={s} glyph={s.toLowerCase().replace(' ', '-')}>
                    {s === 'Torso Base' ? <Tile name="Merino Tee" art={ART.tee} w={1} h={1} rotated={false} /> : null}
                  </SlotBox>
                ))}
              </div>
            </div>
          </Spec>
        </div>
      </Section>

      <Section id="chips" title="Chips">
        <div className="gx-row">
          {statusNames.map((s) => <Spec key={s} label={s}><Chip status={s} /></Spec>)}
          <Spec label="unknown status"><Chip status="Loaned" /></Spec>
          <Spec label="blank (renders nothing)"><span className="gx-nothing"><Chip status="" /></span></Spec>
          <Spec label="small"><Chip status="Travel Only" size="sm" /></Spec>
          <Spec label="task: active"><Chip tone="accent">Active</Chip></Spec>
          <Spec label="task: completed"><Chip tone="ok">Completed</Chip></Spec>
          <Spec label="task: locked"><Chip tone="muted">Locked</Chip></Spec>
          <Spec label="auto tag"><Chip tone="outline" size="sm">Auto</Chip></Spec>
          <Spec label="ink"><Chip tone="ink">Special care</Chip></Spec>
        </div>
      </Section>

      <Section id="controls" title="Controls">
        <div className="gx-row gx-row--top">
          <Spec label="accent md"><Button variant="accent" icon="plus">Add</Button></Spec>
          <Spec label="ink md"><Button variant="ink" icon="sort">Sort</Button></Spec>
          <Spec label="ghost md"><Button>Export checklist</Button></Spec>
          <Spec label="toggle off / on">
            <div className="gx-inline">
              <Button icon="archive" pressed={archive} onClick={() => setArchive(!archive)}>Archive</Button>
              <Button icon="archive" pressed>Archive</Button>
            </div>
          </Spec>
          <Spec label="sm"><div className="gx-inline"><Button variant="accent" size="sm" icon="plus">Add</Button><Button variant="ink" size="sm">Ink</Button><Button size="sm">Ghost</Button></div></Spec>
          <Spec label="disabled"><Button variant="accent" disabled>Disabled</Button></Spec>
          <Spec label="icon buttons">
            <div className="gx-inline">
              <IconButton icon="plus" label="Add" variant="accent" />
              <IconButton icon="sort" label="Sort" variant="ink" />
              <IconButton icon="undo" label="Undo" />
              <IconButton icon="archive" label="Archive" pressed />
              <IconButton icon="close" label="Close" size="sm" />
              <IconButton icon="grip" label="Grip" variant="bare" />
            </div>
          </Spec>
          <Spec label="segmented (loadout)">
            <SegmentedControl options={['Home', 'Travel', 'Gym']} value={loadout} onChange={setLoadout} aria-label="Loadout" />
          </Spec>
          <Spec label="segmented sm (location)">
            <SegmentedControl options={['USA', 'Vietnam']} value={loc} onChange={setLoc} size="sm" />
          </Spec>
          <Spec label="search field">
            <TextField value={q} onChange={setQ} placeholder="Search stash" style={{ width: 200 }} />
          </Spec>
          <Spec label="search filled"><TextField value="merino" onChange={() => {}} style={{ width: 200 }} /></Spec>
          <Spec label="plain field"><TextField variant="plain" value="Uniqlo" onChange={() => {}} /></Spec>
          <Spec label="select">
            <Select
              prefix="Sort"
              value={sort}
              onChange={setSort}
              options={[{ value: 'name', label: 'Name' }, { value: 'category', label: 'Category' }, { value: 'status', label: 'Status' }, { value: 'size-desc', label: 'Size' }]}
            />
          </Spec>
          <Spec label="select sm"><Select size="sm" value="a" onChange={() => {}} options={[{ value: 'a', label: 'Backpack' }, { value: 'b', label: 'Carry-on' }]} /></Spec>
          <Spec label="category filter strip">
            <div className="gx-filter">
              {['tops', 'bottoms', 'outerwear', 'underwear', 'footwear', 'accessories', 'electronics', 'bags and cubes', 'consumables', 'furniture'].map((c, i) => (
                <button key={c} type="button" title={c} className={i === 0 || i === 6 ? 'gx-filter__btn gx-filter__btn--on' : 'gx-filter__btn'}>
                  <CategoryGlyph category={c} size={20} />
                </button>
              ))}
            </div>
          </Spec>
        </div>
      </Section>

      <Section id="tabbar" title="Tab bar">
        <div className="gx-stack">
          <TabBar
            tabs={[{ id: 'overall', label: 'Overall' }, { id: 'gear', label: 'Gear' }, { id: 'tasks', label: 'Tasks' }, { id: 'skills', label: 'Skills' }]}
            active="tasks"
            onChange={() => {}}
          />
          <TabBar tabs={[{ id: 'gear', label: 'Gear' }, { id: 'tasks', label: 'Tasks' }]} active="gear" onChange={() => {}} right={<IconButton icon="undo" label="Undo" variant="bare" size="sm" />} />
        </div>
      </Section>

      <Section id="readouts" title="Readouts, badges, banners">
        <div className="gx-row gx-row--top">
          <Spec label="weight"><WeightReadout grams={1240} unweighed={3} overLimit={false} /></Spec>
          <Spec label="no unweighed"><WeightReadout grams={860} unweighed={0} overLimit={false} /></Spec>
          <Spec label="blank grams"><WeightReadout grams={0} unweighed={4} overLimit={false} /></Spec>
          <Spec label="with limit"><div style={{ width: 200 }}><WeightReadout grams={4300} unweighed={2} limit={7000} overLimit={false} /></div></Spec>
          <Spec label="over limit"><div style={{ width: 200 }}><WeightReadout grams={7850} unweighed={1} limit={7000} overLimit /></div></Spec>
          <Spec label="on ink (title bar)"><div className="gx-inkbar"><WeightReadout tone="light" grams={2100} unweighed={1} limit={7000} overLimit={false} /></div></Spec>
          <Spec label="footer carried"><CarriedReadout grams={3420} unweighed={12} /></Spec>
          <Spec label="save: saved (nothing)"><span className="gx-nothing"><SaveBadge state="saved" /></span></Spec>
          <Spec label="save: saving"><SaveBadge state="saving" /></Spec>
          <Spec label="save: error"><SaveBadge state={saveState} onRetry={() => setSaveState('saving')} /></Spec>
        </div>
        <div className="gx-stack">
          <Banner tone="bad" action={<Button size="sm" variant="ink">Choose folder</Button>}>Inventory file not found</Banner>
          <Banner tone="info">Public demo: edits reset on reload.</Banner>
        </div>
      </Section>

      <Section id="overlays" title="Overlays">
        <div className="gx-row gx-row--top">
          <Spec label="tooltip">
            <Tooltip x={0} y={0} inline>
              <TooltipTitle>Uniqlo Merino Crew Tee</TooltipTitle>
              <Chip status="Daily" size="sm" />
              <span>2 × 2</span>
              <span>Wash cold, dry flat. Pairs with everything.</span>
            </Tooltip>
          </Spec>
          <Spec label="hover me (160 ms)">
            <div className="gx-hoverme" {...hover.handlers}>
              <Tile name="Hover tile" art={ART.tee} w={1} h={1} rotated={false} />
            </div>
            {hover.state.open ? (
              <Tooltip x={hover.state.x} y={hover.state.y}>
                <TooltipTitle>Hover tile</TooltipTitle>
                <span>1 × 1</span>
              </Tooltip>
            ) : null}
          </Spec>
          <Spec label="context menu (open)">
            <div className="gx-menuhost">
              {menuOpen ? (
                <ContextMenu
                  inline
                  x={0}
                  y={0}
                  onClose={() => setMenuOpen(false)}
                  items={[
                    { label: 'Open', onSelect: () => {} },
                    { label: 'Inspect', onSelect: () => {} },
                    { label: 'Equip to slot', submenu: [{ label: 'Torso Base', onSelect: () => {} }, { label: 'Torso Mid', onSelect: () => {} }] },
                    { label: 'Move to Stash', onSelect: () => {} },
                    { label: 'Archive', onSelect: () => {} },
                    { label: 'Add to Quick Use', onSelect: () => {}, disabled: true },
                    { label: 'Edit', onSelect: () => {} },
                    { label: 'Delete', onSelect: () => {}, danger: true },
                  ]}
                />
              ) : (
                <Button size="sm" onClick={() => setMenuOpen(true)}>Reopen menu</Button>
              )}
            </div>
          </Spec>
          <Spec label="windows (drag title bars)">
            <div className="gx-winlayer">
              {winOpen ? (
                <Window
                  title="Osprey Daylite"
                  x={win.x}
                  y={win.y}
                  z={win.z}
                  onMove={(x, y) => setWin((w) => ({ ...w, x, y }))}
                  onRaise={() => raise(1)}
                  onClose={() => setWinOpen(false)}
                  right={<WeightReadout tone="light" grams={2100} unweighed={1} limit={7000} overLimit={false} />}
                >
                  <div className="gx-panels">
                    <div>
                      <LabelTab>Main</LabelTab>
                      <GridSurface width={4} height={3}>
                        <GridPos x={0} y={0} w={2} h={2}><Tile name="Tee" art={ART.tee} w={2} h={2} rotated={false} /></GridPos>
                        <GridPos x={2} y={0} w={2} h={1}><Tile name="Phone" art={ART.phone} w={2} h={1} rotated /></GridPos>
                      </GridSurface>
                    </div>
                    <div>
                      <LabelTab>Lid</LabelTab>
                      <GridSurface width={2} height={1} />
                    </div>
                  </div>
                </Window>
              ) : (
                <Button size="sm" onClick={() => setWinOpen(true)}>Reopen window</Button>
              )}
              <Window
                title="Packing cube"
                x={win2.x}
                y={win2.y}
                z={win2.z}
                onMove={(x, y) => setWin2((w) => ({ ...w, x, y }))}
                onRaise={() => raise(2)}
                onClose={() => {}}
                right={<WeightReadout tone="light" grams={0} unweighed={0} overLimit={false} />}
              >
                <div>
                  <LabelTab>Main</LabelTab>
                  <div className="gx-spare">
                    <GridSurface width={3} height={2} />
                    <span className="gx-spare__text label">Spare</span>
                  </div>
                </div>
              </Window>
            </div>
          </Spec>
        </div>
        <div className="gx-row gx-row--top">
          <Spec label="modal (inline preview)">
            <Modal inline onClose={() => {}} width={520} label="Inspect">
              <div className="gx-card">
                <div className="gx-card__art"><Tile name="Merino Tee" art={ART.tee} w={2} h={2} rotated={false} /></div>
                <div>
                  <div className="gx-card__name label">Uniqlo Merino Crew Tee</div>
                  <div className="gx-card__sub">Merino crew neck</div>
                  <Chip status="Daily" />
                  <dl className="gx-card__fields">
                    <dt>Maker</dt><dd>Uniqlo</dd>
                    <dt>Category</dt><dd>tops</dd>
                    <dt>Size</dt><dd>M</dd>
                    <dt>Weight</dt><dd />
                  </dl>
                </div>
              </div>
            </Modal>
          </Spec>
          <Spec label="modal (real, Esc / backdrop closes)">
            <Button variant="accent" onClick={() => setModalOpen(true)}>Open modal</Button>
            {modalOpen ? (
              <Modal onClose={() => setModalOpen(false)} label="Demo" width={420}>
                <div className="gx-card__name label">Modal</div>
                <p className="gx-lede">Press Esc or click the backdrop.</p>
              </Modal>
            ) : null}
          </Spec>
        </div>
      </Section>

      <Section id="glyphs" title="Glyphs">
        {[['Categories', categoryGlyphNames], ['Slots', slotGlyphNames], ['UI', uiGlyphNames]].map(([title, names]) => (
          <div key={title as string} className="gx-glyphset">
            <h3 className="gx-h3 label">{title as string}</h3>
            <div className="gx-glyphs">
              {(names as string[]).map((n) => (
                <div key={n} className="gx-glyph">
                  <Glyph name={n} size={24} />
                  <span>{n}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="gx-glyphset">
          <h3 className="gx-h3 label">Sizes (16 / 24 / 32) and CategoryGlyph from data strings</h3>
          <div className="gx-inline" style={{ color: 'var(--ink-2)' }}>
            <Glyph name="backpack" size={16} /><Glyph name="backpack" size={24} /><Glyph name="backpack" size={32} />
            <CategoryGlyph category="bags and cubes" size={32} />
            <CategoryGlyph category="Consumables" size={32} />
            <Glyph name="unknown-name" size={32} />
          </div>
        </div>
      </Section>

      <Section id="states" title="Empty and later">
        <div className="gx-row gx-row--top">
          <div className="gx-panel"><EmptyState title="Stash is empty" hint="Add your first item. It lands as 1 × 1 in this stash." action={<Button variant="accent" icon="plus">Add</Button>} /></div>
          <div className="gx-panel"><ComingLater name="Skills" /></div>
          <div className="gx-panel"><ComingLater name="Overall" /></div>
        </div>
      </Section>
    </div>
  );
}

export default Gallery;
