import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Glyph } from './glyphs';
import './TextField.css';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
  value: string;
  onChange: (value: string) => void;
  /** 'search' (default) draws the magnifier and a clear ×; 'plain' is a bare input for forms. */
  variant?: 'search' | 'plain';
  size?: 'sm' | 'md';
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { value, onChange, variant = 'search', size = 'md', className, placeholder, ...rest },
  ref,
) {
  const cls = ['rg-field', `rg-field--${variant}`, `rg-field--${size}`, className ?? ''].filter(Boolean).join(' ');
  return (
    <label className={cls}>
      {variant === 'search' ? <Glyph name="search" size={size === 'sm' ? 14 : 16} className="rg-field__icon" /> : null}
      <input
        ref={ref}
        type={variant === 'search' ? 'search' : 'text'}
        value={value}
        placeholder={placeholder ?? (variant === 'search' ? 'Search' : undefined)}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (variant === 'search' && e.key === 'Escape' && value) { e.stopPropagation(); onChange(''); } }}
        {...rest}
      />
      {variant === 'search' && value ? (
        <button type="button" className="rg-field__clear" aria-label="Clear search" onClick={() => onChange('')}>
          <Glyph name="close" size={12} strokeWidth={2} />
        </button>
      ) : null}
    </label>
  );
});
