import type { KeyboardEvent } from 'react';
import './SegmentedControl.css';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: (SegmentOption<T> | T)[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  /** Stretch segments to fill the width. */
  block?: boolean;
  'aria-label'?: string;
  className?: string;
}

/** Joined buttons, active segment filled --accent. Arrow keys move the choice. */
export function SegmentedControl<T extends string = string>({
  options, value, onChange, size = 'md', block, className, ...aria
}: SegmentedControlProps<T>) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const idx = opts.findIndex((o) => o.value === value);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const n = opts.length;
    const next = (Math.max(0, idx) + (e.key === 'ArrowRight' ? 1 : n - 1)) % n;
    onChange(opts[next].value);
    const btns = e.currentTarget.querySelectorAll('button');
    (btns[next] as HTMLButtonElement | undefined)?.focus();
  };
  const cls = ['rg-seg', `rg-seg--${size}`, block ? 'rg-seg--block' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <div className={cls} role="radiogroup" aria-label={aria['aria-label']} onKeyDown={onKey}>
      {opts.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (idx < 0 && o === opts[0]) ? 0 : -1}
            className={on ? 'rg-seg__opt rg-seg__opt--on' : 'rg-seg__opt'}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
