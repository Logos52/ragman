import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Glyph } from './glyphs';
import './Modal.css';

export interface ModalProps {
  onClose: () => void;
  children?: ReactNode;
  /** Card width in px (Inspect card is 720). Shrinks to the viewport on small screens. */
  width?: number;
  /** Accessible name. */
  label?: string;
  /** Show a close × in the top-right corner (default true). */
  closeButton?: boolean;
  /** Render in place instead of into document.body (gallery). */
  inline?: boolean;
}

const FOCUSABLE = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** The card's keyboard-reachable elements in DOM order (visible ones only). */
function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0);
}

/** Open (portalled) modal cards, innermost last: only the top one traps focus. */
const openCards: HTMLElement[] = [];

/**
 * Centered white card with a 6 px --accent top bar. Esc and backdrop click close it.
 * Focus is trapped inside the card while it is open: Tab and Shift-Tab wrap between its first and last
 * focusable elements, and focus that lands behind the modal is pulled back into the card.
 */
export function Modal({ onClose, children, width = 720, label, closeButton = true, inline }: ModalProps) {
  const card = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (inline) return;
    const el = card.current;
    if (!el) return;
    const prev = document.activeElement as HTMLElement | null;
    openCards.push(el);
    el.focus({ preventScroll: true });
    const isTop = () => openCards[openCards.length - 1] === el;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== 'Tab' || !isTop()) return;
      const list = focusables(el);
      const active = document.activeElement as HTMLElement | null;
      if (!list.length) { e.preventDefault(); el.focus({ preventScroll: true }); return; }
      const first = list[0];
      const last = list[list.length - 1];
      const inside = !!active && active !== el && el.contains(active);
      if (e.shiftKey ? (!inside || active === first) : (!inside || active === last)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!isTop()) return;
      const t = e.target as Node | null;
      if (t && !el.contains(t)) (focusables(el)[0] ?? el).focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
      const i = openCards.indexOf(el);
      if (i >= 0) openCards.splice(i, 1);
      prev?.focus?.({ preventScroll: true });
    };
  }, [inline]);

  const body = (
    <div
      className={inline ? 'rg-modal rg-modal--inline' : 'rg-modal'}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={card}
        className="rg-modal__card"
        role="dialog"
        aria-modal={inline ? undefined : true}
        aria-label={label}
        tabIndex={-1}
        style={{ width }}
      >
        {closeButton ? (
          <button type="button" className="rg-modal__close" aria-label="Close" onClick={onClose}>
            <Glyph name="close" size={16} strokeWidth={2} />
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
  return inline ? body : createPortal(body, document.body);
}
