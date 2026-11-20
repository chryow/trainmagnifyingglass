import { GOOD_FOR_OPTIONS, PRICE_LEVELS, type GoodFor } from '@/types/database';
import { Clock, Wallet } from 'lucide-react';

export interface DetailsValue { openingHours: string; priceLevel: number | null; goodFor: GoodFor[] }

/**
 * Columns to send when saving a gem. They're only included when they carry a
 * value (or are being cleared), so saving still works on a database where
 * migration 0010 hasn't been applied yet.
 */
export function detailsPayload(d: DetailsValue, hadAny: boolean) {
  const hasAny = !!d.openingHours.trim() || d.priceLevel != null || d.goodFor.length > 0;
  if (!hasAny && !hadAny) return {};
  return { opening_hours: d.openingHours.trim() || null, price_level: d.priceLevel, good_for: d.goodFor };
}

/** Form fields for opening hours, price level and "good for" tags (create + edit gem). */
export function GemDetailsFields({ value, onChange }: { value: DetailsValue; onChange: (v: DetailsValue) => void }) {
  const toggleTag = (t: GoodFor) =>
    onChange({ ...value, goodFor: value.goodFor.includes(t) ? value.goodFor.filter((x) => x !== t) : [...value.goodFor, t] });

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="opening-hours" className="label">Opening hours <span className="text-stone-400">(optional)</span></label>
        <input
          id="opening-hours"
          className="input"
          placeholder="e.g. Daily 08:00–22:00, closed Mondays"
          value={value.openingHours}
          onChange={(e) => onChange({ ...value, openingHours: e.target.value })}
          maxLength={200}
        />
      </div>

      <fieldset>
        <legend className="label">Price <span className="text-stone-400">(optional)</span></legend>
        <div className="flex flex-wrap gap-2">
          {PRICE_LEVELS.map((p) => {
            const on = value.priceLevel === p.value;
            return (
              <button
                key={p.value}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ ...value, priceLevel: on ? null : p.value })}
                className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors ${on ? 'border-primary-400 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-500/15 dark:text-primary-300' : 'border-stone-200 text-stone-600 hover:border-stone-300 dark:border-stone-700 dark:text-stone-300'}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Good for <span className="text-stone-400">(pick any)</span></legend>
        <div className="flex flex-wrap gap-2">
          {GOOD_FOR_OPTIONS.map((o) => {
            const on = value.goodFor.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTag(o.value)}
                className={`rounded-full border-2 px-3.5 py-1.5 text-sm font-medium transition-colors ${on ? 'border-accent-400 bg-accent-50 text-accent-700 dark:border-accent-500 dark:bg-accent-500/15 dark:text-accent-300' : 'border-stone-200 text-stone-600 hover:border-stone-300 dark:border-stone-700 dark:text-stone-300'}`}
              >
                <span aria-hidden>{o.emoji}</span> {o.label}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

/** Read-only display of the same details on the gem page. Renders nothing if none are set. */
export function GemDetailsSummary({ openingHours, priceLevel, goodFor }: { openingHours?: string | null; priceLevel?: number | null; goodFor?: GoodFor[] }) {
  const price = PRICE_LEVELS.find((p) => p.value === priceLevel);
  const tags = GOOD_FOR_OPTIONS.filter((o) => goodFor?.includes(o.value));
  if (!openingHours && !price && tags.length === 0) return null;
  return (
    <div className="card space-y-4 p-5">
      {(openingHours || price) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {openingHours && (
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"><Clock className="h-5 w-5" /></span>
              <div><p className="text-xs font-medium text-stone-400">Opening hours</p><p className="font-semibold">{openingHours}</p></div>
            </div>
          )}
          {price && (
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"><Wallet className="h-5 w-5" /></span>
              <div><p className="text-xs font-medium text-stone-400">Price</p><p className="font-semibold">{price.label}</p></div>
            </div>
          )}
        </div>
      )}
      {tags.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-stone-400">Good for</p>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t.value} className="badge bg-accent-50 px-3 py-1 text-sm text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"><span aria-hidden>{t.emoji}</span> {t.label}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
