import { useEffect, useState } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';
import { LuggageTag } from './LuggageTag';
import { Glyph } from './glyphs';
import './Tile.css';

export interface TileProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  name: string;
  /** Image URL; null (or a URL that fails to load) draws the grey placeholder with the name. */
  art: string | null;
  /** Footprint in cells AFTER rotation (the box drawn on the grid). */
  w: number;
  h: number;
  rotated: boolean;
  container?: boolean;
  specialCare?: boolean;
  consumable?: boolean;
  selected?: boolean;
  /** Drag ghost look: 0.6 opacity, scale 1.03, no shadow. */
  dragging?: boolean;
  /** One 80 ms --bad flash (failed drop snapping back). Toggle the key to replay. */
  flash?: boolean;
  /** Archive: the item's location drawn as a luggage tag bottom-left. */
  locationTag?: string;
  /** Px per cell for a standalone tile. Omit to fill the parent (GridPos, SlotBox). */
  size?: number;
  /** Sort leaves it in place: a pin glyph top-left, --ink on a white chip. */
  pinned?: boolean;
  /** Cannot be moved: a lock glyph top-left. */
  locked?: boolean;
  /** EFT's unexamined mark: a small "?" badge in --accent bottom-left. */
  unverified?: boolean;
  /** Stack size; drawn bottom-right only when above 1. */
  quantity?: number;
  /** Containers: shown on the label strip instead of the name (a placeholder still centers the real name). */
  nickname?: string;
  /** Ctrl-drag quick-move target: the whole tile outlined --ok or --bad while hovered. */
  dropHl?: 'ok' | 'bad' | null;
}

/** An item on a grid: art letterboxed in its footprint, name strip top-right, markers. */
export function Tile({
  name, art, w, h, rotated, container, specialCare, consumable, selected, dragging, flash, locationTag, size,
  pinned, locked, unverified, quantity, nickname, dropHl,
  className, style, ...rest
}: TileProps) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [art]);
  const showArt = !!art && !broken;

  const cls = [
    'rg-tile',
    container ? 'rg-tile--container' : '',
    showArt ? '' : 'rg-tile--placeholder',
    rotated ? 'rg-tile--rotated' : '',
    selected ? 'rg-tile--selected' : '',
    dragging ? 'rg-tile--dragging' : '',
    flash ? 'rg-tile--flash' : '',
    locked ? 'rg-tile--locked' : '',
    dropHl ? `rg-tile--drop-${dropHl}` : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  // every chip of the top-left mark row: pin, lock and the consumable dot
  const marks = (pinned ? 1 : 0) + (locked ? 1 : 0) + (consumable ? 1 : 0);
  const nick = container ? (nickname ?? '').trim() : '';
  const strip = nick || (showArt ? name : '');
  const box: CSSProperties = {
    ...(size != null ? { width: Math.round(w * size) - 1, height: Math.round(h * size) - 1 } : {}),
    // the name strip stops short of the mark row: one chip per mark (--rg-mk + 2 px padding + 1 px gap), the row's
    // 2 px inset, and 4 px clear
    ...(marks ? { ['--rg-marks' as string]: `calc(${marks} * (var(--rg-mk) + 3px) + 6px)` } : {}),
    ...style,
  };
  const qty = quantity != null && quantity > 1 ? quantity : 0;

  return (
    <div className={cls} style={box} data-w={w} data-h={h} data-marks={marks || undefined} {...rest}>
      {showArt ? (
        <div className="rg-tile__art">
          <img src={art!} alt="" draggable={false} onError={() => setBroken(true)} />
        </div>
      ) : (
        <div className="rg-tile__ph">
          <span>{name}</span>
        </div>
      )}
      {strip ? <span className={nick ? 'rg-tile__name rg-tile__name--nick' : 'rg-tile__name'}>{strip}</span> : null}
      {pinned || locked || consumable ? (
        <span className="rg-tile__marks">
          {pinned ? <Glyph name="pin" size={14} strokeWidth={2.5} className="rg-tile__mark rg-tile__mark--pin" title="Pinned" /> : null}
          {locked ? <Glyph name="lock" size={14} strokeWidth={2.75} className="rg-tile__mark" title="Locked" /> : null}
          {consumable ? <span className="rg-tile__mark rg-tile__dot" aria-label="consumable" /> : null}
        </span>
      ) : null}
      {specialCare ? <span className="rg-tile__care" aria-label="special care" /> : null}
      {qty ? <span className="rg-tile__qty" aria-label={`quantity ${qty}`}>{qty}</span> : null}
      {unverified ? <span className="rg-tile__unv" aria-label="unverified" title="Not verified">?</span> : null}
      {locationTag ? <LuggageTag className="rg-tile__ltag">{locationTag}</LuggageTag> : null}
    </div>
  );
}
