import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/States';
import { uploadReportEvidence, validateImageFile } from '@/lib/upload';
import type { ReportTargetType, ReportReason } from '@/types/database';
import { REPORT_REASONS, REPORT_REASON_LABELS } from '@/types/database';
import { X, Flag, ImagePlus, Send } from 'lucide-react';

interface Props {
  targetType: ReportTargetType;
  targetId: string;
  communityId?: string | null;
  onClose: () => void;
  onSubmitted?: () => void;
}

export default function ReportModal({ targetType, targetId, communityId, onClose, onSubmitted }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleEvidenceSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { setImageError(err); return; }
    setImageError(null);
    setEvidenceFile(file);
    setEvidencePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    setError(null);

    const { data: rpcData, error: rpcErr } = await supabase.rpc('create_report', {
      p_target_type: targetType,
      p_target_id: targetId,
      p_reason: reason,
      p_description: description.trim() || null,
      p_community_id: communityId ?? null,
    });

    if (rpcErr || !rpcData?.success) {
      setSubmitting(false);
      setError(rpcErr?.message ?? rpcData?.error ?? 'Failed to submit report');
      return;
    }

    if (evidenceFile && rpcData.report_id) {
      try {
        const result = await uploadReportEvidence(rpcData.report_id, evidenceFile);
        await supabase.from('reports').update({ evidence_path: result.path }).eq('id', rpcData.report_id);
      } catch {
        setImageError('Evidence upload failed, but your report was submitted.');
      }
    }

    setSubmitting(false);
    setSuccess(true);
    setTimeout(() => {
      onSubmitted?.();
      onClose();
    }, 1500);
  };

  const targetTypeLabel: Record<ReportTargetType, string> = {
    profile: 'user',
    gem: 'gem',
    comment: 'comment',
    collection: 'collection',
    community: 'community',
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="card max-w-sm p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-50 dark:bg-success-950/40">
            <Flag className="h-6 w-6 text-success-600 dark:text-success-400" />
          </div>
          <h2 className="font-display text-lg font-semibold">Report submitted</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Thank you. Our moderation team will review this {targetTypeLabel[targetType]}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Report this {targetTypeLabel[targetType]}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Reason</label>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                    reason === r ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-stone-200 dark:border-stone-700'
                  }`}
                >
                  <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${reason === r ? 'border-primary-500 bg-primary-500' : 'border-stone-300 dark:border-stone-600'}`} />
                  <span className="text-stone-600 dark:text-stone-300">{REPORT_REASON_LABELS[r]}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Details (optional)</label>
            <textarea
              className="input min-h-[60px] resize-y text-sm"
              placeholder="Provide additional context…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
            />
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
            <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleSubmit} disabled={!reason || submitting} className="btn-primary text-sm flex-1">
              {submitting ? <LoadingSpinner size={16} /> : <><Send className="h-4 w-4" /> Submit report</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
