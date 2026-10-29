/**
 * Window positions remembered per item id, in this viewer's browser only (a per-viewer convenience:
 * it can come back empty, and every read and write is wrapped so a blocked storage never breaks a window).
 */
export interface WinPos { x: number; y: number }
export type WinKind = 'container' | 'inspect';

const key = (kind: WinKind, id: string) => `ragman:win:${kind}:${id}`;

export function recallPos(kind: WinKind, id: string): WinPos | null {
  try {
    const raw = window.localStorage.getItem(key(kind, id));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<WinPos>;
    return typeof p.x === 'number' && typeof p.y === 'number' && Number.isFinite(p.x) && Number.isFinite(p.y)
      ? { x: p.x, y: p.y } : null;
  } catch { return null; }
}

export function rememberPos(kind: WinKind, id: string, p: WinPos): void {
  try { window.localStorage.setItem(key(kind, id), JSON.stringify({ x: Math.round(p.x), y: Math.round(p.y) })); }
  catch { /* storage blocked: the window simply opens at its cascade next time */ }
}

/** The tab bar (40 px) stays visible: no window goes above it. Windows are capped at the viewport below it (CSS). */
export const TAB_BAR = 40;

