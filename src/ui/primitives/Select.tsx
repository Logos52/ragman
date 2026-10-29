import type { SelectHTMLAttributes } from 'react';
import { Glyph } from './glyphs';
import './Select.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value' | 'size'> {
  options: (SelectOption | string)[];
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md';
  /** Small caps prefix inside the box, e.g. "SORT". */
  prefix?: string;
}

/** A native <select> dressed as a square condensed-caps box with a chevron. */
export function Select({ options, value, onChange, size = 'md', prefix, className, ...rest }: SelectProps) {
  const cls = ['rg-select', `rg-select--${size}`, className ?? ''].filter(Boolean).join(' ');
  return (
    <label className={cls}>
      {prefix ? <span className="rg-select__prefix">{prefix}</span> : null}
      <select value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
        {options.map((o) => {
          const opt = typeof o === 'string' ? { value: o, label: o } : o;
          return <option key={opt.value} value={opt.value}>{opt.label}</option>;
        })}
      </select>
      <Glyph name="chevron-down" size={14} strokeWidth={2} className="rg-select__chev" />
    </label>
  );
}
