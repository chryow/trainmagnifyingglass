import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/Avatar';
import { LoadingSpinner, EmptyState } from '@/components/States';
import { uploadGemImage, validateImageFile } from '@/lib/upload';
import type {
  Gem, GemConfirmation, CorrectionSuggestion, GemEditHistory,
  ConfirmationType, CorrectionType, CorrectionStatus,
  VerificationStatus,
} from '@/types/database';
import {
  CONFIRMATION_TYPES, CONFIRMATION_LABELS, CONFIRMATION_DESCRIPTIONS,
  CORRECTION_TYPES, CORRECTION_LABELS, CORRECTION_STATUS_LABELS,
  VERIFICATION_STATUS_LABELS, VERIFICATION_STATUS_DESCRIPTIONS,
  FIELD_DISPLAY_NAMES, CHANGE_SOURCE_LABELS,
} from '@/types/database';
import {
  ShieldCheck, Clock, AlertTriangle, XCircle, HelpCircle, FileEdit,
  CheckCircle2, X, Send, History, ImagePlus, ChevronDown, ChevronUp,
  ClipboardCheck, MessageSquarePlus,
} from 'lucide-react';

interface Props {
  gem: Gem;
  isAuthor: boolean;
  onGemUpdated: () => void;
}

export default function AccuracyPanel({ gem, isAuthor, onGemUpdated }: Props) {
  const [confirmations, setConfirmations] = useState<GemConfirmation[]>([]);
  const [corrections, setCorrections] = useState<CorrectionSuggestion[]>([]);
  const [editHistory, setEditHistory] = useState<GemEditHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirmForm, setShowConfirmForm] = useState(false);
  const [showCorrectForm, setShowCorrectForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showReviewPanel, setShowReviewPanel] = useState(false);

  const load = useCallback(async () => {
    if (!gem) return;
    setLoading(true);
    try {
      const [confRes, corrRes, histRes] = await Promise.all([
        supabase.from('gem_confirmations')
          .select('*, author:profiles(id, username, display_name, avatar_url)')
          .eq('gem_id', gem.id)
          .order('created_at', { ascending: false }),
        supabase.from('correction_suggestions')
          .select('*, suggester:profiles!correction_suggestions_suggested_by_fkey(id, username, display_name, avatar_url), reviewer:profiles!correction_suggestions_reviewed_by_fkey(id, username, display_name, avatar_url)')
          .eq('gem_id', gem.id)
          .order('created_at', { ascending: false }),
        supabase.from('gem_edit_history')
          .select('*, changed_by_user:profiles!gem_edit_history_changed_by_fkey(id, username, display_name, avatar_url)')
          .eq('gem_id', gem.id)
          .order('created_at', { ascending: false }),
      ]);
      setConfirmations((confRes.data as GemConfirmation[] | null) ?? []);
      setCorrections((corrRes.data as CorrectionSuggestion[] | null) ?? []);
      setEditHistory((histRes.data as GemEditHistory[] | null) ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [gem]);

  useEffect(() => { load(); }, [load]);

  const pendingCorrections = corrections.filter((c) => c.status === 'pending');

  return (
    <div className="space-y-4">
      <VerificationBanner status={gem.verification_status} />
      <ConfirmationSummary confirmations={confirmations} />
      <ConfirmAction
        gem={gem}
        confirmations={confirmations}
        isAuthor={isAuthor}
        showForm={showConfirmForm}
        setShowForm={setShowConfirmForm}
        onSubmitted={() => { setShowConfirmForm(false); load(); onGemUpdated(); }}
      />
      <CorrectAction
        gem={gem}
        isAuthor={isAuthor}
        showForm={showCorrectForm}
        setShowForm={setShowCorrectForm}
        onSubmitted={() => { setShowCorrectForm(false); load(); }}
      />
      {isAuthor && pendingCorrections.length > 0 && (
        <CorrectionReview
          gem={gem}
          corrections={pendingCorrections}
          showPanel={showReviewPanel}
          setShowPanel={setShowReviewPanel}
          onReviewed={() => { load(); onGemUpdated(); }}
        />
      )}
      <ConfirmationList confirmations={confirmations} loading={loading} />
      <EditHistorySection
        history={editHistory}
        show={showHistory}
        setShow={setShowHistory}
        loading={loading}
      />
    </div>
  );
}

// ============================================================================
// Verification Banner
// ============================================================================

function VerificationBanner({ status }: { status: VerificationStatus }) {
  const config: Record<VerificationStatus, { icon: typeof ShieldCheck; className: string; iconColor: string }> = {
    new: { icon: HelpCircle, className: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300', iconColor: 'text-stone-500' },
    community_confirmed: { icon: ShieldCheck, className: 'bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-400', iconColor: 'text-success-500' },
    may_be_outdated: { icon: Clock, className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400', iconColor: 'text-amber-500' },
    temporarily_unavailable: { icon: AlertTriangle, className: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400', iconColor: 'text-orange-500' },
    permanently_closed: { icon: XCircle, className: 'bg-error-50 text-error-700 dark:bg-error-950/40 dark:text-error-400', iconColor: 'text-error-500' },
    under_review: { icon: AlertTriangle, className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400', iconColor: 'text-amber-500' },
  };

  const { icon: Icon, className, iconColor } = config[status];

  return (
    <div className={`flex items-start gap-3 rounded-xl px-4 py-3 ${className}`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} />
      <div>
        <p className="text-sm font-semibold">{VERIFICATION_STATUS_LABELS[status]}</p>
        <p className="mt-0.5 text-xs opacity-80">{VERIFICATION_STATUS_DESCRIPTIONS[status]}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Confirmation Summary
// ============================================================================

function ConfirmationSummary({ confirmations }: { confirmations: GemConfirmation[] }) {
  const active = confirmations.filter((c) => !c.withdrawn_at);
  if (active.length === 0) return null;

  const byType: Record<string, number> = {};
  for (const c of active) {
    byType[c.confirmation_type] = (byType[c.confirmation_type] ?? 0) + 1;
  }
  const latest = active[0];
  const latestDate = new Date(latest.created_at).toLocaleDateString();

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-sm">
        <ClipboardCheck className="h-4 w-4 text-stone-400" />
        <span className="font-medium">{active.length} recent confirmation{active.length !== 1 ? 's' : ''}</span>
        <span className="text-stone-400">· Last confirmed {latestDate}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(byType).map(([type, count]) => (
          <span key={type} className="badge bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">
            {CONFIRMATION_LABELS[type as ConfirmationType]}: {count}
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Confirm Action + Form
// ============================================================================

function ConfirmAction({
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
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const myActiveConfirmation = confirmations.find((c) => c.user_id === profile?.id && !c.withdrawn_at);

  const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !gem) return;
    const err = validateImageFile(file);
    if (err) { setImageError(err); return; }
    setImageError(null);
    try {
      const { url } = await uploadGemImage(gem.id, file);
      setEvidenceUrl(url);
    } catch {
      setImageError('Upload failed. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (!profile || submitting) return;
    setSubmitting(true);
    setError(null);
    const { error: insErr } = await supabase.from('gem_confirmations').insert({
      gem_id: gem.id,
      user_id: profile.id,
      confirmation_type: type,
      note: note.trim() || null,
      evidence_image_url: evidenceUrl,
    });
    setSubmitting(false);
    if (insErr) {
      if (insErr.code === '23505') setError('You already have an active confirmation for this gem. Withdraw it first.');
      else setError(insErr.message);
      return;
    }
    setNote('');
    setEvidenceUrl(null);
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
            {evidenceUrl ? (
              <div className="relative overflow-hidden rounded-lg">
                <img src={evidenceUrl} alt="Evidence" className="h-32 w-full object-cover" />
                <button type="button" onClick={() => setEvidenceUrl(null)} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-stone-300 p-3 text-stone-500 dark:border-stone-700">
                <ImagePlus className="h-5 w-5" />
                <span className="text-xs">Upload evidence</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleEvidenceUpload} />
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

function CorrectAction({
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
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !gem) return;
    const err = validateImageFile(file);
    if (err) { setImageError(err); return; }
    setImageError(null);
    try {
      const { url } = await uploadGemImage(gem.id, file);
      setEvidenceUrl(url);
    } catch {
      setImageError('Upload failed.');
    }
  };

  const handleSubmit = async () => {
    if (!profile || submitting) return;
    if (suggestedValue.trim().length < 1) { setError('Suggested value is required.'); return; }
    if (explanation.trim().length < 10) { setError('Explanation must be at least 10 characters.'); return; }
    setSubmitting(true);
    setError(null);
    const { error: insErr } = await supabase.from('correction_suggestions').insert({
      gem_id: gem.id,
      suggested_by: profile.id,
      correction_type: correctionType,
      current_value: currentValue.trim() || null,
      suggested_value: suggestedValue.trim(),
      explanation: explanation.trim(),
      evidence_url: evidenceUrl,
    });
    setSubmitting(false);
    if (insErr) {
      if (insErr.code === '23505') setError('A pending correction with the same type and suggested value already exists.');
      else setError(insErr.message);
      return;
    }
    setCorrectionType('name');
    setCurrentValue('');
    setSuggestedValue('');
    setExplanation('');
    setEvidenceUrl(null);
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
            {evidenceUrl ? (
              <div className="relative overflow-hidden rounded-lg">
                <img src={evidenceUrl} alt="Evidence" className="h-32 w-full object-cover" />
                <button type="button" onClick={() => setEvidenceUrl(null)} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-stone-300 p-3 text-stone-500 dark:border-stone-700">
                <ImagePlus className="h-5 w-5" />
                <span className="text-xs">Upload evidence</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleEvidenceUpload} />
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

function CorrectionReview({
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

  const handleAction = async (correctionId: string, action: 'accept' | 'reject' | 'needs_info' | 'escalate') => {
    if (action === 'accept' || action === 'reject') {
      if (!confirm(`Are you sure you want to ${action === 'accept' ? 'accept' : 'reject'} this correction?`)) return;
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
    <div className="card border-amber-300 p-4 dark:border-amber-700">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-amber-700 dark:text-amber-400">
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
                  <a href={c.evidence_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline dark:text-primary-400">View evidence</a>
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

function ConfirmationList({ confirmations, loading }: { confirmations: GemConfirmation[]; loading: boolean }) {
  const [showAll, setShowAll] = useState(false);
  if (loading) return null;
  const active = confirmations.filter((c) => !c.withdrawn_at);
  if (active.length === 0) return null;
  const displayed = showAll ? active : active.slice(0, 3);

  return (
    <div className="card p-4">
      <h3 className="mb-3 font-display text-sm font-semibold">Recent Confirmations</h3>
      <div className="space-y-2">
        {displayed.map((c) => (
          <div key={c.id} className="flex items-start gap-3 rounded-lg bg-stone-50 p-3 dark:bg-stone-800/50">
            {c.author && <Avatar url={c.author.avatar_url ?? null} name={c.author.display_name} size={28} />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{CONFIRMATION_LABELS[c.confirmation_type]}</span>
                <span className="text-xs text-stone-400">{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
              {c.note && <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{c.note}</p>}
              {c.evidence_image_url && (
                <a href={c.evidence_image_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block">
                  <img src={c.evidence_image_url} alt="Evidence" className="h-16 w-16 rounded-lg object-cover" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      {active.length > 3 && (
        <button onClick={() => setShowAll(!showAll)} className="mt-2 flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 dark:text-stone-400">
          {showAll ? <><ChevronUp className="h-3.5 w-3.5" /> Show less</> : <><ChevronDown className="h-3.5 w-3.5" /> Show all {active.length}</>}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Edit History
// ============================================================================

function EditHistorySection({
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

function EditHistoryItem({ entry }: { entry: GemEditHistory }) {
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

function truncate(val: string | null): string {
  if (!val) return 'empty';
  return val.length > 80 ? val.slice(0, 80) + '…' : val;
}
