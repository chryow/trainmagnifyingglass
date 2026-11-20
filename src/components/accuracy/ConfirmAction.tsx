import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { LoadingSpinner } from '@/components/States';
import { uploadConfirmationEvidence, validateImageFile } from '@/lib/upload';
import type { Gem, GemConfirmation, ConfirmationType } from '@/types/database';
import { CONFIRMATION_TYPES, CONFIRMATION_LABELS, CONFIRMATION_DESCRIPTIONS } from '@/types/database';
import { X, Send, ImagePlus, ClipboardCheck } from 'lucide-react';

export function ConfirmAction({
  gem, confirmations, isAuthor, showForm, setShowForm, onSubmitted,
}: {
  gem: Gem;
  confirmations: GemConfirmation[];
  isAuthor: boolean;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  onSubmitted: () => void;
}) {
  const { profile } = useAuth();
  const [type, setType] = useState<ConfirmationType>('still_accurate');
  const [note, setNote] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const myActiveConfirmation = confirmations.find((c) => c.user_id === profile?.id && !c.withdrawn_at);

  const handleEvidenceSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !gem) return;
    const err = validateImageFile(file);
    if (err) { setImageError(err); return; }
    setImageError(null);
    setEvidenceFile(file);
    setEvidencePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!profile || submitting) return;
    setSubmitting(true);
    setError(null);
    const { data, error: insErr } = await supabase.from('gem_confirmations').insert({
      gem_id: gem.id,
      user_id: profile.id,
      confirmation_type: type,
      note: note.trim() || null,
    }).select('id').single();
    if (insErr || !data) {
      setSubmitting(false);
      if (insErr?.code === '23505') setError('You already have an active confirmation for this gem. Withdraw it first.');
      else setError(insErr?.message ?? 'Failed to submit confirmation');
      return;
    }

    let evidencePath: string | null = null;
    if (evidenceFile) {
      try {
        const result = await uploadConfirmationEvidence(gem.id, data.id, evidenceFile);
        evidencePath = result.path;
        await supabase.from('gem_confirmations').update({ evidence_image_url: evidencePath }).eq('id', data.id);
      } catch {
        setImageError('Evidence upload failed, but your confirmation was submitted.');
      }
    }

    setSubmitting(false);
    setNote('');
    setEvidenceFile(null);
    setEvidencePreview(null);
    onSubmitted();
  };

  const handleWithdraw = async () => {
    if (!myActiveConfirmation || !profile) return;
    setSubmitting(true);
    const { error: updErr } = await supabase
      .from('gem_confirmations')
      .update({ withdrawn_at: new Date().toISOString() })
      .eq('id', myActiveConfirmation.id);
    setSubmitting(false);
    if (updErr) { setError(updErr.message); return; }
    onSubmitted();
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold">Community Confirmations</h3>
        {!myActiveConfirmation && !showForm && (
          <button onClick={() => setShowForm(true)} className="btn-outline text-sm">
            <ClipboardCheck className="h-4 w-4" /> Confirm Information
          </button>
        )}
      </div>

      {myActiveConfirmation && (
        <div className="mt-3 rounded-lg bg-stone-50 p-3 dark:bg-stone-800/50">
          <p className="text-sm text-stone-600 dark:text-stone-300">
            You confirmed: <strong>{CONFIRMATION_LABELS[myActiveConfirmation.confirmation_type]}</strong>
          </p>
          <button onClick={handleWithdraw} disabled={submitting} className="mt-2 text-xs text-error-600 hover:text-error-700 dark:text-error-400">
            {submitting ? <LoadingSpinner size={14} /> : 'Withdraw confirmation'}
          </button>
        </div>
      )}

      {showForm && !myActiveConfirmation && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Community confirmations help others know if this information is still accurate. They are not guaranteed facts.
          </p>

          <div>
            <label className="label">Confirmation type</label>
            <div className="space-y-1.5">
              {CONFIRMATION_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                    type === t ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-stone-200 dark:border-stone-700'
                  }`}
                >
                  <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${type === t ? 'border-primary-500 bg-primary-500' : 'border-stone-300 dark:border-stone-600'}`} />
                  <div>
                    <p className="font-medium">{CONFIRMATION_LABELS[t]}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">{CONFIRMATION_DESCRIPTIONS[t]}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Note (optional)</label>
            <textarea className="input min-h-[50px] resize-y text-sm" placeholder="Add details about your visit…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </div>

          <div>
            <label className="label">Evidence photo (optional)</label>
            {evidencePreview ? (
              <div className="relative overflow-hidden rounded-lg">
                <img src={evidencePreview} alt="Evidence" className="h-32 w-full object-cover" />
                <button type="button" onClick={() => { setEvidenceFile(null); setEvidencePreview(null); }} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-stone-300 p-3 text-stone-500 dark:border-stone-700">
                <ImagePlus className="h-5 w-5" />
                <span className="text-xs">Upload evidence</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleEvidenceSelect} />
              </label>
            )}
            {imageError && <p className="mt-1 text-xs text-error-600 dark:text-error-400">{imageError}</p>}
          </div>

          {error && <div role="alert" className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700 dark:bg-error-950/40 dark:text-error-400">{error}</div>}

          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary text-sm flex-1">
              {submitting ? <LoadingSpinner size={16} /> : <><Send className="h-4 w-4" /> Submit confirmation</>}
            </button>
          </div>
        </div>
      )}

      {isAuthor && !showForm && (
        <p className="mt-2 text-xs text-stone-400">Note: Your own confirmation won't count toward Community Confirmed status.</p>
      )}
    </div>
  );
}

// ============================================================================
// Correction Action + Form
// ============================================================================
