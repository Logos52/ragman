import { Glyph } from '../primitives/glyphs';
import { toggleTheme, useTheme } from '../theme';

/**
 * Dark mode toggle in the tab bar's right end: a moon in light mode, a sun in dark mode. aria-pressed is true in
 * dark mode. It has a fixed 24 px box, so switching never moves anything in the bar.
 */
export function ThemeToggle() {
  const dark = useTheme() === 'dark';
  const label = dark ? 'Light mode' : 'Dark mode';
  return (
    <button
      type="button"
      className="rg-tabbar__theme"
      aria-pressed={dark}
      aria-label="Dark mode"
      title={label}
      onClick={() => toggleTheme()}
    >
      <Glyph name={dark ? 'sun' : 'moon'} size={16} strokeWidth={1.75} />
    </button>
  );
}
