import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './ContextMenu.css';

export interface ContextSubItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

export interface ContextMenuItem {
  label: string;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** A question or notice row (the delete confirm's prompt): drawn in --ink, never selectable. */
  prompt?: boolean;
  submenu?: ContextSubItem[];
  /** A row drawn as-is (an inline text or number input). It is skipped by the arrow keys and never "selected". */
  content?: ReactNode;
}

export interface ContextMenuProps {
  /** Pointer position in viewport px. */
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  /** Render in place (absolute inside the parent, no viewport clamp). Gallery use. */
  inline?: boolean;
}

/** Menus keep the same 16 px gutter from the viewport edges as the windows (DESIGN, Window gutter). */
const MARGIN = 16;

function nextEnabled<T extends { disabled?: boolean; content?: ReactNode; prompt?: boolean }>(list: T[], from: number, dir: 1 | -1): number {
  const n = list.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + dir * k + n * 2) % n;
    if (!list[i].disabled && !list[i].prompt && list[i].content == null) return i;
  }
  return from;
}

/**
 * White menu, 1 px ink border, condensed caps rows; hover/active row --accent.
 * Esc closes, arrows move (Right opens a submenu, Left closes it), Enter selects.
 * Closes on any pointerdown outside. Clamped to the viewport.
 */
export function ContextMenu({ x, y, items, onClose, inline }: ContextMenuProps) {
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const sub = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1);
  const [openSub, setOpenSub] = useState<number | null>(null);
  const [subActive, setSubActive] = useState(-1);
  const [pos, setPos] = useState({ left: x, top: y });
  const [subPos, setSubPos] = useState<{ left: number; top: number } | null>(null);
  const [subStacked, setSubStacked] = useState(false);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // focus for keyboard, close on outside pointerdown
  useEffect(() => {
    const onClose = () => closeRef.current();
    menu.current?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) onClose();
    };
    const onBlur = () => onClose();
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // clamp to the viewport
  useLayoutEffect(() => {
    if (inline) { setPos((p) => (p.left === x && p.top === y ? p : { left: x, top: y })); return; }
    const el = menu.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.round(Math.max(MARGIN, Math.min(x, window.innerWidth - r.width - MARGIN)));
    const top = Math.round(Math.max(MARGIN, Math.min(y, window.innerHeight - r.height - MARGIN)));
    setPos((p) => (p.left === left && p.top === top ? p : { left, top }));
  }, [x, y, inline, items.length, subStacked, openSub]);

  // Place the submenu beside its row: to the right when it fits inside the 16 px gutter, else to the left when that
  // fits; when neither side has room (a phone), it stacks in the menu's flow under its row, the menu's width, pushing
  // the rows below down. Long rows truncate with an ellipsis.
  useLayoutEffect(() => {
    if (openSub == null) { setSubPos(null); setSubStacked(false); return; }
    const m = menu.current;
    const row = m?.querySelectorAll<HTMLElement>('[data-row]')[openSub];
    const s = sub.current;
    if (!m || !row || !s) return;
    const mw = m.offsetWidth;
    const sw = s.offsetWidth;
    const sh = s.offsetHeight;
    let left = mw - 1;
    let top = row.offsetTop - 1;
    let stacked = false;
    if (!inline) {
      const mr = m.getBoundingClientRect();
      const vw = window.innerWidth;
      const fitsRight = mr.left + mw - 1 + sw <= vw - MARGIN;
      const fitsLeft = mr.left - sw + 1 >= MARGIN;
      if (!fitsRight && fitsLeft) left = -sw + 1;
      // neither side: stack in the menu's flow under the row (the menu's own clamp keeps it inside the viewport)
      else if (!fitsRight) stacked = true;
      if (!stacked) {
        const absTop = mr.top + top;
        if (absTop + sh > window.innerHeight - MARGIN) top -= absTop + sh - (window.innerHeight - MARGIN);
        if (mr.top + top < MARGIN) top = MARGIN - mr.top;
      }
    }
    setSubStacked(stacked);
    setSubPos({ left, top });
  }, [openSub, inline]);

  const choose = (i: number) => {
    const it = items[i];
    if (!it || it.disabled || it.prompt || it.content != null) return;
    if (it.submenu?.length) { setOpenSub(i); setSubActive(nextEnabled(it.submenu, -1, 1)); return; }
    onClose();
    it.onSelect?.();
  };
  const chooseSub = (i: number) => {
    const s = openSub != null ? items[openSub].submenu?.[i] : undefined;
    if (!s || s.disabled) return;
    onClose();
    s.onSelect();
  };

  const onKey = (e: KeyboardEvent) => {
    const subList = openSub != null ? items[openSub].submenu ?? [] : null;
    switch (e.key) {
      case 'Escape':
        e.preventDefault(); e.stopPropagation();
        if (subList) { setOpenSub(null); setSubActive(-1); } else onClose();
        break;
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        if (subList) setSubActive((a) => nextEnabled(subList, a < 0 && dir === -1 ? 0 : a, dir));
        else setActive((a) => nextEnabled(items, a < 0 && dir === -1 ? 0 : a, dir));
        break;
      }
      case 'ArrowRight':
        e.preventDefault();
        if (!subList && active >= 0 && items[active].submenu?.length && !items[active].disabled) choose(active);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (subList) { setOpenSub(null); setSubActive(-1); }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (subList) chooseSub(subActive);
        else if (active >= 0) choose(active);
        break;
      case 'Tab':
        e.preventDefault();
        break;
    }
  };

  const subItems = openSub != null ? items[openSub].submenu ?? [] : [];
  // Stacked (a phone): the submenu sits in the menu's own flow under its row, the menu's width, and pushes the rows
  // below it down instead of covering them. Beside its row it floats as usual.
  const subEl = openSub != null ? (
      <div
        ref={sub}
        className={subStacked ? 'rg-cmenu rg-cmenu--sub rg-cmenu--stacked' : 'rg-cmenu rg-cmenu--sub'}
        role="menu"
        style={subStacked ? undefined : subPos ? { left: subPos.left, top: subPos.top } : { visibility: 'hidden' }}
      >
        {subItems.length === 0 ? <div className="rg-cmenu__row rg-cmenu__row--disabled">None fits</div> : null}
        {subItems.map((s, i) => (
          <div
            key={`${s.label}-${i}`}
            role="menuitem"
            aria-disabled={s.disabled || undefined}
            className={[
              'rg-cmenu__row',
              i === subActive ? 'rg-cmenu__row--active' : '',
              s.disabled ? 'rg-cmenu__row--disabled' : '',
            ].filter(Boolean).join(' ')}
            onPointerEnter={() => setSubActive(s.disabled ? -1 : i)}
            onClick={() => chooseSub(i)}
          >
            <span className="rg-cmenu__label">{s.label}</span>
          </div>
        ))}
      </div>
  ) : null;

  const body = (
    <div
      ref={root}
      className={inline ? 'rg-cmenu-root rg-cmenu-root--inline' : 'rg-cmenu-root'}
      style={{ left: pos.left, top: pos.top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={menu} className="rg-cmenu" role="menu" tabIndex={-1} onKeyDown={onKey}>
        {items.map((it, i) => {
          if (it.content != null) {
            return (
              <div
                key={`${it.label}-${i}`}
                data-row
                className="rg-cmenu__row rg-cmenu__row--content"
                onPointerEnter={() => { setActive(-1); setOpenSub(null); }}
              >
                {it.content}
              </div>
            );
          }
          const cls = [
            'rg-cmenu__row',
            i === active || i === openSub ? 'rg-cmenu__row--active' : '',
            it.danger ? 'rg-cmenu__row--danger' : '',
            it.disabled ? 'rg-cmenu__row--disabled' : '',
            it.prompt ? 'rg-cmenu__row--prompt' : '',
          ].filter(Boolean).join(' ');
          const row = (
            <div
              key={`${it.label}-${i}`}
              data-row
              role="menuitem"
              aria-disabled={it.disabled || it.prompt || undefined}
              aria-haspopup={it.submenu ? 'menu' : undefined}
              aria-expanded={it.submenu ? openSub === i : undefined}
              className={cls}
              onPointerEnter={() => {
                setActive(it.disabled || it.prompt ? -1 : i);
                if (it.submenu?.length && !it.disabled) { setOpenSub(i); setSubActive(-1); }
                else { setOpenSub(null); }
              }}
              onClick={() => choose(i)}
            >
              <span className="rg-cmenu__label">{it.label}</span>
              {it.submenu ? <span className="rg-cmenu__more" aria-hidden>›</span> : null}
            </div>
          );
          if (subStacked && openSub === i) return <Fragment key={`${it.label}-${i}`}>{row}{subEl}</Fragment>;
          return row;
        })}
        {openSub != null && !subStacked ? subEl : null}
      </div>
    </div>
  );
  return inline ? body : createPortal(body, document.body);
}
