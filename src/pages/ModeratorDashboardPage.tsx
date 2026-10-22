import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate, useRoute, matchPath } from '@/lib/router';
import { Avatar, PageHeader } from '@/components/Avatar';
import { EmptyState, ErrorState, LoadingSpinner } from '@/components/States';
import type { Report, CommunitySuspension, ModerationAction, Community } from '@/types/database';
import { REPORT_REASON_LABELS, REPORT_STATUS_LABELS, MODERATION_ACTION_LABELS } from '@/types/database';
import {
  ArrowLeft, Flag, Shield, Gavel, Eye, EyeOff, Ban, ArrowUpCircle,
  CheckCircle, XCircle, Clock, Users, FileText,
} from 'lucide-react';
import ReportTargetInfo from '@/components/ReportTargetInfo';

export default function ModeratorDashboardPage() {
  const route = useRoute();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const match = matchPath('/moderation/:id', route.path);
  const communityId = match?.id ?? '';

  const [community, setCommunity] = useState<Community | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [suspensions, setSuspensions] = useState<CommunitySuspension[]>([]);
  const [actions, setActions] = useState<ModerationAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<'reports' | 'suspensions' | 'history'>('reports');
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!communityId || !profile) return;
    setLoading(true);
    setError(false);
    try {
      const { data: comm, error: commErr } = await supabase
        .from('communities').select('*').eq('id', communityId).maybeSingle();
      if (commErr || !comm) { setError(true); return; }
      setCommunity(comm as Community);

      const [rRes, sRes, aRes] = await Promise.all([
        supabase.from('reports')
          .select('*, reporter:profiles!reports_reporter_id_fkey(id, username, display_name, avatar_url)')
          .eq('community_id', communityId)
          .order('created_at', { ascending: false }),
        supabase.from('community_suspensions')
          .select('*, user:profiles!community_suspensions_user_id_fkey(id, username, display_name, avatar_url), suspended_by_user:profiles!community_suspensions_suspended_by_fkey(id, username, display_name, avatar_url)')
          .eq('community_id', communityId)
          .order('created_at', { ascending: false }),
        supabase.from('moderation_actions')
          .select('*, moderator:profiles!moderation_actions_moderator_id_fkey(id, username, display_name, avatar_url)')
          .eq('community_id', communityId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      setReports((rRes.data as Report[] | null) ?? []);
      setSuspensions((sRes.data as CommunitySuspension[] | null) ?? []);
      setActions((aRes.data as ModerationAction[] | null) ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [communityId, profile]);

  useEffect(() => { load(); }, [load]);

  const handleEscalate = async (reportId: string) => {
    const reason = prompt('Why are you escalating this report to platform admins?');
    if (!reason?.trim()) return;
    setActioning(reportId);
    const { error: rpcErr } = await supabase.rpc('escalate_report', {
      p_report_id: reportId,
      p_escalation_reason: reason.trim(),
    });
    setActioning(null);
    if (rpcErr) return;
    await load();
  };

  const handleLiftSuspension = async (suspensionId: string) => {
    const reason = prompt('Why are you lifting this suspension?');
    if (!reason?.trim()) return;
    setActioning(suspensionId);
    const { error: rpcErr } = await supabase.rpc('moderator_lift_suspension', {
      p_suspension_id: suspensionId,
      p_reason: reason.trim(),
    });
    setActioning(null);
    if (rpcErr) return;
    await load();
  };

  if (loading) {
    return <div className="flex items-center gap-3 py-16"><LoadingSpinner className="text-primary-500" /> <span className="text-stone-500">Loading moderation dashboard…</span></div>;
  }
  if (error || !community) {
    return <ErrorState title="Access denied" description="You may not have moderator access to this community, or it doesn't exist." onRetry={() => navigate('/communities')} />;
  }

  const pendingReports = reports.filter((r) => r.status === 'pending' || r.status === 'reviewing');
  const activeSuspensions = suspensions.filter((s) => !s.lifted_at && (!s.expires_at || new Date(s.expires_at) > new Date()));

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(`/communities/${communityId}`)} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400"><ArrowLeft className="h-4 w-4" /> {community.name}</button>
      <PageHeader title="Moderation" subtitle={`Manage reports, suspensions, and moderation history for ${community.name}.`} />

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<Flag className="h-5 w-5" />} label="Pending reports" value={pendingReports.length} color="text-amber-500" />
        <StatCard icon={<Ban className="h-5 w-5" />} label="Active suspensions" value={activeSuspensions.length} color="text-error-500" />
        <StatCard icon={<FileText className="h-5 w-5" />} label="Total actions" value={actions.length} color="text-primary-500" />
      </div>

      <div className="flex gap-1 overflow-x-auto scrollbar-hide">
        {([
          { key: 'reports' as const, label: `Reports (${reports.length})`, icon: Flag },
          { key: 'suspensions' as const, label: `Suspensions (${suspensions.length})`, icon: Ban },
          { key: 'history' as const, label: 'History', icon: Clock },
        ]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${tab === t.key ? 'bg-primary-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300'}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'reports' && (
        <div>
          {reports.length === 0 ? (
            <EmptyState icon={<Flag className="h-6 w-6" />} title="No reports" description="No one has reported anything in this community yet." />
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`badge ${r.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : r.status === 'escalated' ? 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400' : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300'}`}>
                        {REPORT_STATUS_LABELS[r.status]}
                      </span>
                      <span className="text-xs text-stone-400">{REPORT_REASON_LABELS[r.reason]}</span>
                    </div>
                    <span className="text-xs text-stone-400">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  {r.description && <p className="mt-2 whitespace-pre-line break-words text-sm text-stone-600 dark:text-stone-300">{r.description}</p>}
                  <ReportTargetInfo targetType={r.target_type} targetId={r.target_id} />
                  <div className="mt-2 flex items-center gap-2 text-xs text-stone-400">
                    {r.reporter && <Avatar url={r.reporter.avatar_url ?? null} name={r.reporter.display_name} size={20} />}
                    <span>Reported by {r.reporter?.display_name ?? 'Unknown'}</span>
                    <span>·</span>
                    <span className="capitalize">{r.target_type}</span>
                  </div>
                  {(r.status === 'pending' || r.status === 'reviewing') && (
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => handleEscalate(r.id)} disabled={actioning === r.id} className="btn-outline text-xs">
                        {actioning === r.id ? <LoadingSpinner size={14} /> : <><ArrowUpCircle className="h-3.5 w-3.5" /> Escalate to admins</>}
                      </button>
                    </div>
                  )}
                  {r.escalation_reason && (
                    <p className="mt-2 rounded-lg bg-error-50 px-3 py-1.5 text-xs text-error-700 dark:bg-error-950/40 dark:text-error-400">Escalated: {r.escalation_reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'suspensions' && (
        <div>
          {suspensions.length === 0 ? (
            <EmptyState icon={<Ban className="h-6 w-6" />} title="No suspensions" description="No users have been suspended from this community." />
          ) : (
            <div className="space-y-3">
              {suspensions.map((s) => {
                const isActive = !s.lifted_at && (!s.expires_at || new Date(s.expires_at) > new Date());
                return (
                  <div key={s.id} className="card p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {s.user && <Avatar url={s.user.avatar_url ?? null} name={s.user.display_name} size={28} />}
                        <div>
                          <p className="text-sm font-semibold">{s.user?.display_name ?? 'Unknown'}</p>
                          <p className="text-xs text-stone-400">@{s.user?.username}</p>
                        </div>
                      </div>
                      <span className={`badge ${isActive ? 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400' : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'}`}>
                        {isActive ? 'Active' : 'Lifted/Expired'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{s.reason}</p>
                    <div className="mt-1 text-xs text-stone-400">
                      Suspended {new Date(s.created_at).toLocaleDateString()}
                      {s.duration_hours && ` · ${s.duration_hours}h`}
                      {s.expires_at && ` · expires ${new Date(s.expires_at).toLocaleDateString()}`}
                    </div>
                    {isActive && (
                      <button onClick={() => handleLiftSuspension(s.id)} disabled={actioning === s.id} className="mt-2 btn-outline text-xs">
                        {actioning === s.id ? <LoadingSpinner size={14} /> : <><CheckCircle className="h-3.5 w-3.5" /> Lift suspension</>}
                      </button>
                    )}
                    {s.lift_reason && <p className="mt-2 text-xs text-stone-400">Lifted: {s.lift_reason}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div>
          {actions.length === 0 ? (
            <EmptyState icon={<Clock className="h-6 w-6" />} title="No moderation actions" description="No moderation actions have been taken in this community yet." />
          ) : (
            <div className="space-y-2">
              {actions.map((a) => (
                <div key={a.id} className="card flex items-start gap-3 p-3">
                  <div className="mt-0.5 text-stone-400">
                    <ActionIcon type={a.action_type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{MODERATION_ACTION_LABELS[a.action_type] ?? a.action_type}</p>
                    {a.reason && <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{a.reason}</p>}
                    <div className="mt-1 flex items-center gap-2 text-xs text-stone-400">
                      {a.moderator && <Avatar url={a.moderator.avatar_url ?? null} name={a.moderator.display_name} size={16} />}
                      <span>{a.moderator?.display_name ?? 'System'}</span>
                      <span>·</span>
                      <span>{new Date(a.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="card p-4 text-center">
      <div className={`mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800 ${color}`}>{icon}</div>
      <p className="font-display text-xl font-bold">{value}</p>
      <p className="text-xs text-stone-400">{label}</p>
    </div>
  );
}

function ActionIcon({ type }: { type: string }) {
  switch (type) {
    case 'hide_gem': return <EyeOff className="h-4 w-4" />;
    case 'restore_gem': return <Eye className="h-4 w-4" />;
    case 'suspend_user': return <Ban className="h-4 w-4" />;
    case 'lift_suspension': return <CheckCircle className="h-4 w-4" />;
    case 'escalate_report': return <ArrowUpCircle className="h-4 w-4" />;
    case 'resolve_report': return <CheckCircle className="h-4 w-4" />;
    case 'dismiss_report': return <XCircle className="h-4 w-4" />;
    case 'deactivate_account': return <Shield className="h-4 w-4" />;
    case 'reactivate_account': return <Shield className="h-4 w-4" />;
    default: return <Gavel className="h-4 w-4" />;
  }
}
