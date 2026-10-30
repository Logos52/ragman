import { Glyph } from './glyphs';
import './WeightReadout.css';

/** grams -> "1.2 kg" (one decimal). */
export function formatKg(grams: number, digits = 1): string {
  return `${(Math.max(0, grams || 0) / 1000).toFixed(digits)} kg`;
}

export interface WeightReadoutProps {
  /** Sum of known weights (blank weights count 0 here; they are reported as unweighed). */
  grams: number;
  unweighed: number;
  /** Items whose weight is a guesstimate (summed in grams). Draws a ~ before the total and a count. */
  estimated?: number;
  /** weightLimit_g. Adds " / 7.0 kg" and the allowance meter. */
  limit?: number | null;
  overLimit: boolean;
  /** 'light' for white-on-ink title bars. */
  tone?: 'default' | 'light';
  /** Draw the meter (default: whenever limit is set). */
  meter?: boolean;
  className?: string;
}

/** `1.2 kg · 3 unweighed / 7.0 kg`, `~1.2 kg · 5 est.` when any weight is a guesstimate, red past the limit, with a 2 px allowance meter under it. */
export function WeightReadout({ grams, unweighed, estimated = 0, limit, overLimit, tone = 'default', meter, className }: WeightReadoutProps) {
  const hasLimit = limit != null && limit > 0;
  const showMeter = meter ?? hasLimit;
  const cls = [
    'rg-weight',
    tone === 'light' ? 'rg-weight--light' : '',
    overLimit ? 'rg-weight--over' : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  return (
    <span className={cls}>
      <span className="rg-weight__text">
        {estimated > 0 ? '~' : ''}{formatKg(grams)}
        {unweighed > 0 ? <> · {unweighed} unweighed</> : null}
        {estimated > 0 ? <> · {estimated} est.</> : null}
        {hasLimit ? <> / {formatKg(limit!)}</> : null}
      </span>
      {showMeter && hasLimit ? <AllowanceMeter grams={grams} limit={limit!} overLimit={overLimit} /> : null}
    </span>
  );
}

export interface AllowanceMeterProps {
  grams: number;
  limit: number;
  overLimit?: boolean;
  className?: string;
}

/** 2 px bar: share of the allowance used. Fills --bad past the limit. */
export function AllowanceMeter({ grams, limit, overLimit, className }: AllowanceMeterProps) {
  const over = overLimit ?? grams > limit;
  const frac = limit > 0 ? Math.min(1, Math.max(0, grams / limit)) : 0;
  return (
    <span
      className={[over ? 'rg-meter rg-meter--over' : 'rg-meter', className ?? ''].filter(Boolean).join(' ')}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={grams}
    >
      <span className="rg-meter__fill" style={{ width: `${(over ? 1 : frac) * 100}%` }} />
    </span>
  );
}

export interface CarriedReadoutProps {
  grams: number;
  unweighed: number;
  estimated?: number;
}

/** Footer: `CARRIED 3.42 kg · 12 unweighed`, `CARRIED ~3.42 kg · 5 estimated` when any carried weight is a guesstimate, with the tag glyph. */
export function CarriedReadout({ grams, unweighed, estimated = 0 }: CarriedReadoutProps) {
  return (
    <span className="rg-carried">
      <Glyph name="tag" size={15} />
      <span>
        Carried <b>{estimated > 0 ? '~' : ''}{formatKg(grams, 2)}</b>
        {unweighed > 0 ? <> · {unweighed} unweighed</> : null}
        {estimated > 0 ? <> · {estimated} estimated</> : null}
      </span>
    </span>
  );
}
