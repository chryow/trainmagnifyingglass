import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useDialogs } from '@/components/Dialogs';
import { Avatar } from '@/components/Avatar';
import { LoadingSpinner } from '@/components/States';
import type { Gem, CorrectionSuggestion } from '@/types/database';
import { CORRECTION_LABELS } from '@/types/database';
import { AlertTriangle, XCircle, HelpCircle, CheckCircle2 } from 'lucide-react';
import { EvidenceLink } from '@/components/accuracy/Evidence';

export function CorrectionReview({
  corrections, showPanel, setShowPanel, onReviewed,
}: {
  gem: Gem;
  corrections: CorrectionSuggestion[];
  showPanel: boolean;
  setShowPanel: (v: boolean) => void;
  onReviewed: () => void;
}) {
  const [actioning, setActioning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const dialogs = useDialogs();

  const handleAction = async (correctionId: string, action: 'accept' | 'reject' | 'needs_info' | 'escalate') => {
    if (action === 'accept' || action === 'reject') {
      const ok = await dialogs.confirm({
        title: action === 'accept' ? 'Accept this correction?' : 'Reject this correction?',
        message: action === 'accept' ? "The gem's details will be updated with the suggested change." : 'The suggestion will be closed without changing the gem.',
        confirmLabel: action === 'accept' ? 'Accept' : 'Reject',
        danger: action === 'reject',
      });
      if (!ok) return;
    }
    setActioning(correctionId);
    setError(null);
    const fnName = action === 'accept' ? 'accept_correction'
      : action === 'reject' ? 'reject_correction'
      : action === 'needs_info' ? 'request_more_info'
      : 'escalate_correction';
    const { error: fnErr } = await supabase.rpc(fnName, {
      p_correction_id: correctionId,
      p_resolution_note: resolutionNote.trim() || null,
    });
    setActioning(null);
    setResolutionNote('');
    if (fnErr) { setError(fnErr.message); return; }
    onReviewed();
  };

  return (
    <div className="card border-citrine-300 p-4 dark:border-citrine-700">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-citrine-700 dark:text-citrine-500">
          {corrections.length} correction suggestion{corrections.length !== 1 ? 's' : ''} to review
        </h3>
        <button onClick={() => setShowPanel(!showPanel)} className="text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400">
          {showPanel ? 'Hide' : 'Show'}
        </button>
      </div>

      {showPanel && (
        <div className="mt-3 space-y-3">
          {corrections.map((c) => (
            <div key={c.id} className="rounded-lg border border-stone-200 p-3 dark:border-stone-700">
              <div className="flex items-center justify-between">
                <span className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                  {CORRECTION_LABELS[c.correction_type]}
                </span>
                <span className="text-xs text-stone-400">{new Date(c.created_at).toLocaleDateString()}</span>
              </div>

              <div className="mt-2 space-y-1 text-sm">
                <div>
                  <span className="text-stone-400">Current: </span>
                  <span className="text-stone-600 dark:text-stone-300">{c.current_value ?? '—'}</span>
                </div>
                <div>
                  <span className="text-stone-400">Suggested: </span>
                  <span className="font-medium text-stone-700 dark:text-stone-200">{c.suggested_value}</span>
                </div>
                <div>
                  <span className="text-stone-400">Explanation: </span>
                  <span className="text-stone-600 dark:text-stone-300">{c.explanation}</span>
                </div>
                {c.evidence_url && (
                  <EvidenceLink path={c.evidence_url} />
                )}
              </div>

              {c.suggester && (
                <div className="mt-2 flex items-center gap-2 text-xs text-stone-400">
                  <Avatar url={c.suggester.avatar_url ?? null} name={c.suggester.display_name} size={20} />
                  {c.suggester.display_name}
                </div>
              )}

              <div className="mt-2">
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="Resolution note (optional)"
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  maxLength={500}
                />
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => handleAction(c.id, 'accept')} disabled={actioning === c.id} className="btn-primary text-xs">
                  {actioning === c.id ? <LoadingSpinner size={14} /> : <><CheckCircle2 className="h-3.5 w-3.5" /> Accept</>}
                </button>
                <button onClick={() => handleAction(c.id, 'reject')} disabled={actioning === c.id} className="btn-danger text-xs">
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </button>
                <button onClick={() => handleAction(c.id, 'needs_info')} disabled={actioning === c.id} className="btn-outline text-xs">
                  <HelpCircle className="h-3.5 w-3.5" /> More Info
                </button>
                <button onClick={() => handleAction(c.id, 'escalate')} disabled={actioning === c.id} className="btn-outline text-xs">
                  <AlertTriangle className="h-3.5 w-3.5" /> Escalate
                </button>
              </div>
              {error && <p className="mt-2 text-xs text-error-600 dark:text-error-400">{error}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Confirmation List
// ============================================================================
