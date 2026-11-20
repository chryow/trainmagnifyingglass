import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { LoadingSpinner } from '@/components/States';
import { uploadCorrectionEvidence, validateImageFile } from '@/lib/upload';
import type { Gem, CorrectionType } from '@/types/database';
import { CORRECTION_TYPES, CORRECTION_LABELS } from '@/types/database';
import { X, Send, ImagePlus, MessageSquarePlus } from 'lucide-react';

export function CorrectAction({
  gem, isAuthor, showForm, setShowForm, onSubmitted,
}: {
  gem: Gem;
  isAuthor: boolean;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  onSubmitted: () => void;
}) {
  const { profile } = useAuth();
  const [correctionType, setCorrectionType] = useState<CorrectionType>('name');
  const [currentValue, setCurrentValue] = useState('');
  const [suggestedValue, setSuggestedValue] = useState('');
  const [explanation, setExplanation] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

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
    if (suggestedValue.trim().length < 1) { setError('Suggested value is required.'); return; }
    if (explanation.trim().length < 10) { setError('Explanation must be at least 10 characters.'); return; }
    setSubmitting(true);
    setError(null);
    const { data, error: insErr } = await supabase.from('correction_suggestions').insert({
      gem_id: gem.id,
      suggested_by: profile.id,
      correction_type: correctionType,
      current_value: currentValue.trim() || null,
      suggested_value: suggestedValue.trim(),
      explanation: explanation.trim(),
    }).select('id').single();
    if (insErr || !data) {
      setSubmitting(false);
      if (insErr?.code === '23505') setError('A pending correction with the same type and suggested value already exists.');
      else setError(insErr?.message ?? 'Failed to submit correction');
      return;
    }

    if (evidenceFile) {
      try {
        const result = await uploadCorrectionEvidence(gem.id, data.id, evidenceFile);
        await supabase.from('correction_suggestions').update({ evidence_url: result.path }).eq('id', data.id);
      } catch {
        setImageError('Evidence upload failed, but your correction was submitted.');
      }
    }

    setSubmitting(false);
    setCorrectionType('name');
    setCurrentValue('');
    setSuggestedValue('');
    setExplanation('');
    setEvidenceFile(null);
    setEvidencePreview(null);
    onSubmitted();
  };

  if (isAuthor) return null;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold">Suggest a Correction</h3>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-outline text-sm">
            <MessageSquarePlus className="h-4 w-4" /> Suggest Correction
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="label">What needs correcting?</label>
            <select className="input text-sm" value={correctionType} onChange={(e) => setCorrectionType(e.target.value as CorrectionType)}>
              {CORRECTION_TYPES.map((t) => <option key={t} value={t}>{CORRECTION_LABELS[t]}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Current value</label>
            <input className="input text-sm" placeholder="What does it currently say?" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} maxLength={2000} />
          </div>

          <div>
            <label className="label">Suggested value</label>
            <textarea className="input min-h-[60px] resize-y text-sm" placeholder="What should it say instead?" value={suggestedValue} onChange={(e) => setSuggestedValue(e.target.value)} maxLength={2000} />
          </div>

          <div>
            <label className="label">Explanation</label>
            <textarea className="input min-h-[50px] resize-y text-sm" placeholder="Why should this be changed? (min 10 characters)" value={explanation} onChange={(e) => setExplanation(e.target.value)} maxLength={1000} />
          </div>

          <div>
            <label className="label">Evidence (optional)</label>
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
              {submitting ? <LoadingSpinner size={16} /> : <><Send className="h-4 w-4" /> Submit suggestion</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Correction Review (for gem owner)
// ============================================================================
