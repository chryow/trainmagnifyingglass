import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Gem, GemConfirmation, CorrectionSuggestion, GemEditHistory } from '@/types/database';
import { VerificationBanner, ConfirmationSummary, ConfirmationList } from '@/components/accuracy/StatusSummary';
import { ConfirmAction } from '@/components/accuracy/ConfirmAction';
import { CorrectAction } from '@/components/accuracy/CorrectAction';
import { CorrectionReview } from '@/components/accuracy/CorrectionReview';
import { EditHistorySection } from '@/components/accuracy/EditHistory';

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

