import type { KeyboardEvent, ReactNode } from 'react';
import './TabBar.css';

export interface TabDef {
  id: string;
  label: string;
}

export interface TabBarProps {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  /** Right end of the strip. Defaults to the app name "INVENTORY" in --ink-3. */
  right?: ReactNode;
}

/** The 40 px --ink strip across the top. Active tab: --accent text with a 3 px --accent bar. */
export function TabBar({ tabs, active, onChange, right }: TabBarProps) {
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = tabs.findIndex((t) => t.id === active);
    const n = tabs.length;
    const next = tabs[(Math.max(0, i) + (e.key === 'ArrowRight' ? 1 : n - 1)) % n];
    onChange(next.id);
    const el = e.currentTarget.querySelector<HTMLButtonElement>(`[data-tab="${CSS.escape(next.id)}"]`);
    el?.focus();
  };
  return (
    <nav className="rg-tabbar">
      <div className="rg-tabbar__tabs" role="tablist" onKeyDown={onKey}>
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              data-tab={t.id}
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              className={on ? 'rg-tabbar__tab rg-tabbar__tab--on' : 'rg-tabbar__tab'}
              onClick={() => onChange(t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="rg-tabbar__right">{right === undefined ? <span className="rg-tabbar__app">Inventory</span> : right}</div>
    </nav>
  );
}
