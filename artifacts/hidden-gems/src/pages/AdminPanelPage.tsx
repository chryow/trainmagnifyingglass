import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/Avatar';
import { Avatar } from '@/components/Avatar';
import { EmptyState, ErrorState, LoadingSpinner } from '@/components/States';
import type { Report, ModerationAction, Profile } from '@/types/database';
import { REPORT_REASON_LABELS, REPORT_STATUS_LABELS, MODERATION_ACTION_LABELS } from '@/types/database';
import { Shield, Flag, Gavel, Users, Clock, CheckCircle, XCircle, UserX, UserCheck, ArrowUpCircle, EyeOff, Eye } from 'lucide-react';

export default function AdminPanelPage() {
  const { profile } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapMsg, setBootstrapMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<'escalated' | 'reports' | 'users' | 'history'>('escalated');
  const [reports, setReports] = useState<Report[]>([]);
  const [actions, setActions] = useState<ModerationAction[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(false);
    try {
      const { data: adminCheck } = await supabase.rpc('is_platform_admin');
      const admin = !!adminCheck;
      setIsAdmin(admin);
      if (!admin) { setLoading(false); return; }
      const [rRes, aRes, uRes] = await Promise.all([
        supabase.from('reports')
          .select('*, reporter:profiles!reports_reporter_id_fkey(id, username, display_name, avatar_url)')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('moderation_actions')
          .select('*, moderator:profiles!moderation_actions_moderator_id_fkey(id, username, display_name, avatar_url)')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('profiles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      setReports((rRes.data as Report[] | null) ?? []);
      setActions((aRes.data as ModerationAction[] | null) ?? []);
      setUsers((uRes.data as Profile[] | null) ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async (reportId: string, resolution: 'resolved' | 'dismissed') => {
    const actionTaken = prompt(resolution === 'resolved' ? 'What action was taken?' : 'Why is this report being dismissed?');
    if (!actionTaken?.trim()) return;
    setActioning(reportId);
    const { error: rpcErr } = await supabase.rpc('admin_resolve_report', {
      p_report_id: reportId,
      p_resolution: resolution,
      p_action_taken: actionTaken.trim(),
    });
    setActioning(null);
    if (rpcErr) return;
    await load();
  };

  const handleDeactivate = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this account?')) return;
    const reason = prompt('Reason for deactivation?');
    if (!reason?.trim()) return;
    setActioning(userId);
    const { error: rpcErr } = await supabase.rpc('admin_deactivate_account', {
      p_user_id: userId,
      p_reason: reason.trim(),
    });
    setActioning(null);
    if (rpcErr) return;
    await load();
  };

  const handleReactivate = async (userId: string) => {
    if (!confirm('Reactivate this account?')) return;
    const reason = prompt('Reason for reactivation?');
    if (!reason?.trim()) return;
    setActioning(userId);
    const { error: rpcErr } = await supabase.rpc('admin_reactivate_account', {
      p_user_id: userId,
      p_reason: reason.trim(),
    });
    setActioning(null);
    if (rpcErr) return;
    await load();
  };

  if (loading) {
    return <div className="flex items-center gap-3 py-16"><LoadingSpinner className="text-primary-500" /> <span className="text-stone-500">Loading admin panel…</span></div>;
  }
  if (error) {
    return <ErrorState description="Couldn't load the admin panel." onRetry={load} />;
  }
  if (isAdmin === false) {
    return (
      <div className="space-y-6">
        <PageHeader title="Platform admin" subtitle="Manage escalated reports, user accounts, and review all moderation actions." />
        <div className="card p-6 text-center">
          <Shield className="mx-auto mb-3 h-10 w-10 text-stone-400" />
          <h2 className="font-display text-lg font-semibold">Not authorized</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">You need platform administrator privileges to access this page.</p>
          <div className="mt-5 border-t border-stone-200 pt-5 dark:border-stone-800">
            <p className="text-sm text-stone-600 dark:text-stone-300">No admin has been assigned yet. You can claim the first admin role for this platform.</p>
            <button
              onClick={async () => {
                setBootstrapping(true);
                setBootstrapMsg(null);
                const { data, error: rpcErr } = await supabase.rpc('try_bootstrap_first_admin');
                setBootstrapping(false);
                if (rpcErr) { setBootstrapMsg(rpcErr.message); return; }
                if (data && (data as { success?: boolean }).success) {
                  setBootstrapMsg('Admin role granted! Please sign out and sign back in for it to take effect.');
                } else {
                  setBootstrapMsg('An admin already exists. Contact them to be promoted.');
                }
              }}
              disabled={bootstrapping}
              className="btn-primary mt-4"
            >
              {bootstrapping ? <LoadingSpinner size={16} /> : <><Shield className="h-4 w-4" /> Become the first admin</>}
            </button>
            {bootstrapMsg && <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">{bootstrapMsg}</p>}
          </div>
        </div>
      </div>
    );
  }

  const escalatedReports = reports.filter((r) => r.status === 'escalated');
  const inactiveUsers = users.filter((u) => !(u as Profile & { is_active?: boolean }).is_active);

  return (
    <div className="space-y-6">
      <PageHeader title="Platform admin" subtitle="Manage escalated reports, user accounts, and review all moderation actions." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<ArrowUpCircle className="h-5 w-5" />} label="Escalated" value={escalatedReports.length} color="text-error-500" />
        <StatCard icon={<Flag className="h-5 w-5" />} label="Total reports" value={reports.length} color="text-amber-500" />
        <StatCard icon={<UserX className="h-5 w-5" />} label="Deactivated" value={inactiveUsers.length} color="text-stone-500" />
        <StatCard icon={<Gavel className="h-5 w-5" />} label="Mod actions" value={actions.length} color="text-primary-500" />
      </div>

      <div className="flex gap-1 overflow-x-auto scrollbar-hide">
        {([
          { key: 'escalated' as const, label: `Escalated (${escalatedReports.length})`, icon: ArrowUpCircle },
          { key: 'reports' as const, label: `All reports (${reports.length})`, icon: Flag },
          { key: 'users' as const, label: `Users (${users.length})`, icon: Users },
          { key: 'history' as const, label: 'History', icon: Clock },
        ]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${tab === t.key ? 'bg-primary-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300'}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'escalated' && (
        <div>
          {escalatedReports.length === 0 ? (
            <EmptyState icon={<Shield className="h-6 w-6" />} title="No escalated reports" description="No reports have been escalated to platform admins." />
          ) : (
            <div className="space-y-3">
              {escalatedReports.map((r) => (
                <div key={r.id} className="card border-error-200 p-4 dark:border-error-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="badge bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400">Escalated</span>
                      <span className="text-xs text-stone-400">{REPORT_REASON_LABELS[r.reason]}</span>
                    </div>
                    <span className="text-xs text-stone-400">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  {r.escalation_reason && <p className="mt-2 rounded-lg bg-error-50 px-3 py-1.5 text-xs text-error-700 dark:bg-error-950/40 dark:text-error-400">Reason: {r.escalation_reason}</p>}
                  {r.description && <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{r.description}</p>}
                  <div className="mt-2 flex items-center gap-2 text-xs text-stone-400">
                    <span className="capitalize">{r.target_type}</span>
                    {r.reporter && <><span>·</span><Avatar url={r.reporter.avatar_url ?? null} name={r.reporter.display_name} size={16} /><span>{r.reporter.display_name}</span></>}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => handleResolve(r.id, 'resolved')} disabled={actioning === r.id} className="btn-primary text-xs">
                      {actioning === r.id ? <LoadingSpinner size={14} /> : <><CheckCircle className="h-3.5 w-3.5" /> Resolve</>}
                    </button>
                    <button onClick={() => handleResolve(r.id, 'dismissed')} disabled={actioning === r.id} className="btn-outline text-xs">
                      <XCircle className="h-3.5 w-3.5" /> Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'reports' && (
        <div>
          {reports.length === 0 ? (
            <EmptyState icon={<Flag className="h-6 w-6" />} title="No reports" description="No reports have been filed." />
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`badge ${r.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:bg-amber-900/30 dark:text-amber-400' : r.status === 'escalated' ? 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400' : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300'}`}>
                        {REPORT_STATUS_LABELS[r.status]}
                      </span>
                      <span className="text-xs text-stone-400">{REPORT_REASON_LABELS[r.reason]}</span>
                    </div>
                    <span className="text-xs text-stone-400">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  {r.description && <p className="mt-2 whitespace-pre-line text-sm text-stone-600 dark:text-stone-300">{r.description}</p>}
                  {r.escalation_reason && <p className="mt-2 rounded-lg bg-error-50 px-3 py-1.5 text-xs text-error-700 dark:bg-error-950/40 dark:text-error-400">Escalated: {r.escalation_reason}</p>}
                  {r.resolution_note && <p className="mt-1 text-xs text-stone-400">Resolution: {r.resolution_note}</p>}
                  <div className="mt-2 flex items-center gap-2 text-xs text-stone-400">
                    <span className="capitalize">{r.target_type}</span>
                    {r.community_id && <><span>·</span><span>Community report</span></>}
                  </div>
                  {(r.status === 'pending' || r.status === 'reviewing' || r.status === 'escalated') && (
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => handleResolve(r.id, 'resolved')} disabled={actioning === r.id} className="btn-primary text-xs">
                        {actioning === r.id ? <LoadingSpinner size={14} /> : <><CheckCircle className="h-3.5 w-3.5" /> Resolve</>}
                      </button>
                      <button onClick={() => handleResolve(r.id, 'dismissed')} disabled={actioning === r.id} className="btn-outline text-xs">
                        <XCircle className="h-3.5 w-3.5" /> Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'users' && (
        <div>
          {users.length === 0 ? (
            <EmptyState icon={<Users className="h-6 w-6" />} title="No users" description="No users found." />
          ) : (
            <div className="space-y-2">
              {users.map((u) => {
                const isActive = (u as Profile & { is_active?: boolean }).is_active !== false;
                return (
                  <div key={u.id} className="card flex items-center gap-3 p-3">
                    <Avatar url={u.avatar_url ?? null} name={u.display_name} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{u.display_name}</p>
                        {u.role !== 'user' && <span className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 capitalize">{u.role}</span>}
                      </div>
                      <p className="truncate text-xs text-stone-400">@{u.username}</p>
                    </div>
                    {!isActive && <span className="badge bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400">Inactive</span>}
                    {u.id !== profile?.id && (
                      isActive ? (
                        <button onClick={() => handleDeactivate(u.id)} disabled={actioning === u.id} className="btn-outline text-xs">
                          {actioning === u.id ? <LoadingSpinner size={14} /> : <><UserX className="h-3.5 w-3.5" /> Deactivate</>}
                        </button>
                      ) : (
                        <button onClick={() => handleReactivate(u.id)} disabled={actioning === u.id} className="btn-outline text-xs">
                          {actioning === u.id ? <LoadingSpinner size={14} /> : <><UserCheck className="h-3.5 w-3.5" /> Reactivate</>}
                        </button>
                      )
                    )}
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
            <EmptyState icon={<Clock className="h-6 w-6" />} title="No actions" description="No moderation actions have been recorded." />
          ) : (
            <div className="space-y-2">
              {actions.map((a) => (
                <div key={a.id} className="card flex items-start gap-3 p-3">
                  <div className="mt-0.5 text-stone-400">
                    <HistoryIcon type={a.action_type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{MODERATION_ACTION_LABELS[a.action_type] ?? a.action_type}</p>
                    {a.reason && <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{a.reason}</p>}
                    <div className="mt-1 flex items-center gap-2 text-xs text-stone-400">
                      {a.moderator && <Avatar url={a.moderator.avatar_url ?? null} name={a.moderator.display_name} size={16} />}
                      <span>{a.moderator?.display_name ?? 'System'}</span>
                      <span>·</span>
                      <span>{new Date(a.created_at).toLocaleDateString()}</span>
                      {a.community_id && <><span>·</span><span>Community action</span></>}
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

function HistoryIcon({ type }: { type: string }) {
  switch (type) {
    case 'hide_gem': return <EyeOff className="h-4 w-4" />;
    case 'restore_gem': return <Eye className="h-4 w-4" />;
    case 'suspend_user': return <UserX className="h-4 w-4" />;
    case 'lift_suspension': return <CheckCircle className="h-4 w-4" />;
    case 'escalate_report': return <ArrowUpCircle className="h-4 w-4" />;
    case 'resolve_report': return <CheckCircle className="h-4 w-4" />;
    case 'dismiss_report': return <XCircle className="h-4 w-4" />;
    case 'deactivate_account': return <Shield className="h-4 w-4" />;
    case 'reactivate_account': return <Shield className="h-4 w-4" />;
    default: return <Gavel className="h-4 w-4" />;
  }
}
