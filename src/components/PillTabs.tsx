import type { ReactNode } from 'react';

export interface PillTab<K extends string> { key: K; label: string; count?: number; icon?: ReactNode }

/** Horizontally scrollable pill tabs, used on profile, community and admin pages. */
export function PillTabs<K extends string>({ tabs, active, onChange, label }: { tabs: PillTab<K>[]; active: K; onChange: (k: K) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              on ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' : 'bg-white text-stone-600 shadow-card hover:text-stone-900 dark:bg-stone-900 dark:text-stone-300 dark:hover:text-white'
            }`}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <span className={`rounded-full px-1.5 text-xs ${on ? 'bg-white/20' : 'bg-stone-100 text-stone-500 dark:bg-stone-800'}`}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
