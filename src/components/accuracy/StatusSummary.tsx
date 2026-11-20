import { useState } from 'react';
import { Avatar } from '@/components/Avatar';
import type { GemConfirmation, ConfirmationType, VerificationStatus } from '@/types/database';
import { CONFIRMATION_LABELS, VERIFICATION_STATUS_LABELS, VERIFICATION_STATUS_DESCRIPTIONS } from '@/types/database';
import { ShieldCheck, Clock, AlertTriangle, XCircle, HelpCircle, History, ChevronDown, ChevronUp, ClipboardCheck } from 'lucide-react';
import { EvidenceThumb } from '@/components/accuracy/Evidence';

export function VerificationBanner({ status }: { status: VerificationStatus }) {
  const config: Record<VerificationStatus, { icon: typeof ShieldCheck; className: string; iconColor: string }> = {
    new: { icon: HelpCircle, className: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300', iconColor: 'text-stone-500' },
    community_confirmed: { icon: ShieldCheck, className: 'bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-400', iconColor: 'text-success-500' },
    may_be_outdated: { icon: Clock, className: 'bg-citrine-100 text-citrine-700 dark:bg-citrine-500/40 dark:text-citrine-500', iconColor: 'text-citrine-500' },
    temporarily_unavailable: { icon: AlertTriangle, className: 'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-400', iconColor: 'text-primary-500' },
    permanently_closed: { icon: XCircle, className: 'bg-error-50 text-error-700 dark:bg-error-950/40 dark:text-error-400', iconColor: 'text-error-500' },
    under_review: { icon: AlertTriangle, className: 'bg-citrine-100 text-citrine-700 dark:bg-citrine-500/40 dark:text-citrine-500', iconColor: 'text-citrine-500' },
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

export function ConfirmationSummary({ confirmations }: { confirmations: GemConfirmation[] }) {
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

export function ConfirmationList({ confirmations, loading }: { confirmations: GemConfirmation[]; loading: boolean }) {
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
                <EvidenceThumb path={c.evidence_image_url} />
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
