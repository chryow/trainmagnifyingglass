import { useState } from 'react';
import type { GemEditHistory } from '@/types/database';
import { FIELD_DISPLAY_NAMES, CHANGE_SOURCE_LABELS } from '@/types/database';
import { History, ChevronDown, ChevronUp } from 'lucide-react';

export function EditHistorySection({
  history, show, setShow, loading,
}: {
  history: GemEditHistory[];
  show: boolean;
  setShow: (v: boolean) => void;
  loading: boolean;
}) {
  if (loading) return null;
  if (history.length === 0) return null;

  return (
    <div className="card p-4">
      <button onClick={() => setShow(!show)} className="flex w-full items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <History className="h-4 w-4 text-stone-400" /> Edit History ({history.length})
        </h3>
        {show ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {show && (
        <div className="mt-3 space-y-2">
          {history.map((h) => (
            <EditHistoryItem key={h.id} entry={h} />
          ))}
        </div>
      )}
    </div>
  );
}

export function EditHistoryItem({ entry }: { entry: GemEditHistory }) {
  const [expanded, setExpanded] = useState(false);
  const fieldName = FIELD_DISPLAY_NAMES[entry.changed_field] ?? entry.changed_field;
  const sourceLabel = CHANGE_SOURCE_LABELS[entry.change_source] ?? entry.change_source;
  const hasLongValues = (entry.previous_value && entry.previous_value.length > 80) || (entry.new_value && entry.new_value.length > 80);

  return (
    <div className="rounded-lg border border-stone-200 p-3 dark:border-stone-700">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{fieldName}</span>
        <span className="text-xs text-stone-400">{new Date(entry.created_at).toLocaleDateString()}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="badge bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400 text-xs">{sourceLabel}</span>
        {entry.changed_by_user && <span className="text-xs text-stone-400">by {entry.changed_by_user.display_name}</span>}
      </div>
      <div className="mt-2 text-xs">
        {entry.previous_value !== null ? (
          <div className="space-y-1">
            <div className="flex gap-2">
              <span className="text-error-500 line-through">-{hasLongValues && !expanded ? truncate(entry.previous_value) : entry.previous_value ?? 'empty'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-success-600">+{hasLongValues && !expanded ? truncate(entry.new_value) : entry.new_value ?? 'empty'}</span>
            </div>
            {hasLongValues && (
              <button onClick={() => setExpanded(!expanded)} className="text-stone-400 hover:text-stone-600">
                {expanded ? 'Show less' : 'Show full'}
              </button>
            )}
          </div>
        ) : (
          <p className="text-stone-500 dark:text-stone-400">Set to: {entry.new_value ?? 'empty'}</p>
        )}
      </div>
      {entry.reason && <p className="mt-1 text-xs text-stone-400">{entry.reason}</p>}
    </div>
  );
}

export function truncate(val: string | null): string {
  if (!val) return 'empty';
  return val.length > 80 ? val.slice(0, 80) + '…' : val;
}
