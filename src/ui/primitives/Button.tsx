import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Glyph } from './glyphs';
import './Button.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'accent' | 'ink' | 'ghost';
  size?: 'sm' | 'md';
  /** Glyph name drawn before the label. */
  icon?: string;
  /** Toggle buttons (Archive): pressed = filled --accent. */
  pressed?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'md', icon, pressed, className, children, type = 'button', ...rest },
  ref,
) {
  const cls = [
    'rg-btn',
    `rg-btn--${variant}`,
    `rg-btn--${size}`,
    pressed ? 'rg-btn--pressed' : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  return (
    <button ref={ref} type={type} className={cls} aria-pressed={pressed} {...rest}>
      {icon ? <Glyph name={icon} size={size === 'sm' ? 14 : 16} strokeWidth={2} /> : null}
      {children != null ? <span>{children}</span> : null}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  /** Accessible name; also the hover title. */
  label: string;
  variant?: 'accent' | 'ink' | 'ghost' | 'bare';
  size?: 'sm' | 'md';
  pressed?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = 'ghost', size = 'md', pressed, className, type = 'button', ...rest },
  ref,
) {
  const cls = [
    'rg-btn',
    'rg-iconbtn',
    `rg-btn--${variant}`,
    `rg-btn--${size}`,
    pressed ? 'rg-btn--pressed' : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  return (
    <button ref={ref} type={type} className={cls} aria-label={label} title={label} aria-pressed={pressed} {...rest}>
      <Glyph name={icon} size={size === 'sm' ? 14 : 18} strokeWidth={size === 'sm' ? 2 : 1.75} />
    </button>
  );
});
