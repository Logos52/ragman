import type { ReactNode } from 'react';
import './Chip.css';

/** Status sticker colors from DESIGN.md. Keys are lower-cased status names. */
const STATUS: Record<string, { bg: string; fg: string }> = {
  'daily': { bg: 'var(--status-daily)', fg: 'var(--accent-ink)' },
  'rotation': { bg: 'var(--status-rotation)', fg: 'var(--accent-ink)' },
  'seasonal': { bg: 'var(--status-seasonal)', fg: 'var(--accent-ink)' },
  'travel only': { bg: 'var(--status-travel-only)', fg: 'var(--accent-ink)' },
  'not worn': { bg: 'var(--status-not-worn)', fg: 'var(--accent-ink)' },
  'retired': { bg: 'var(--status-retired)', fg: 'var(--ink)' },
};

/** Generic tones (task chips, flags, the AUTO tag). */
export type ChipTone = 'accent' | 'ink' | 'ok' | 'bad' | 'muted' | 'region' | 'outline';

const TONE: Record<ChipTone, { bg: string; fg: string }> = {
  accent: { bg: 'var(--accent)', fg: 'var(--accent-ink)' },
  ink: { bg: 'var(--ink)', fg: 'var(--accent-ink)' },
  ok: { bg: 'var(--ok)', fg: 'var(--accent-ink)' },
  bad: { bg: 'var(--bad)', fg: 'var(--accent-ink)' },
  muted: { bg: 'var(--ink-3)', fg: 'var(--accent-ink)' },
  region: { bg: 'var(--region)', fg: 'var(--accent-ink)' },
  outline: { bg: 'transparent', fg: 'var(--ink-2)' },
};

export const statusNames = ['Daily', 'Rotation', 'Seasonal', 'Travel Only', 'Not Worn', 'Retired'];

export type ChipProps =
  | { status: string | null | undefined; tone?: never; children?: never; size?: 'sm' | 'md'; className?: string }
  | { status?: never; tone: ChipTone; children: ReactNode; size?: 'sm' | 'md'; className?: string };

/**
 * `<Chip status="Daily" />` draws the status sticker (nothing for a blank status).
 * `<Chip tone="ok">Completed</Chip>` is the generic variant.
 * An unknown status still draws, in --ink-2, so nothing in the data is silently hidden.
 */
export function Chip(props: ChipProps) {
  const size = props.size ?? 'md';
  let colors: { bg: string; fg: string };
  let text: ReactNode;
  let extra = '';
  if (props.tone) {
    colors = TONE[props.tone];
    text = props.children;
    if (props.tone === 'outline') extra = ' rg-chip--outline';
  } else {
    const s = (props.status ?? '').trim();
    if (!s) return null;
    colors = STATUS[s.toLowerCase()] ?? { bg: 'var(--ink-2)', fg: 'var(--accent-ink)' };
    text = s;
  }
  // an --ink sticker vanishes on an --ink ground (the tooltip); data-ink lets that ground give it an edge
  const ink = colors.bg === 'var(--ink)' || colors.bg === 'var(--status-rotation)';
  return (
    <span
      className={`rg-chip rg-chip--${size}${extra}${props.className ? ' ' + props.className : ''}`}
      style={{ background: colors.bg, color: colors.fg }}
      data-ink={ink ? '' : undefined}
    >
      {text}
    </span>
  );
}
