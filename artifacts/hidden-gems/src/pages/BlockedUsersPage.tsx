import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate } from '@/lib/router';
import { Avatar, PageHeader } from '@/components/Avatar';
import { EmptyState, ErrorState, LoadingSpinner } from '@/components/States';
import type { BlockedUser } from '@/types/database';
import { ArrowLeft, Ban, UserX, Unlock } from 'lucide-react';

export default function BlockedUsersPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(false);
    try {
      const { data, error: err } = await supabase
        .from('blocked_users')
        .select('*, blocked:profiles!blocked_users_blocked_id_fkey(id, username, display_name, avatar_url)')
        .eq('blocker_id', profile.id)
        .order('created_at', { ascending: false });
      if (err) { setError(true); return; }
      setBlocked((data as BlockedUser[] | null) ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const handleUnblock = async (blockedId: string) => {
    if (!profile || actioning) return;
    setActioning(blockedId);
    const { error: rpcErr } = await supabase.rpc('unblock_user', { p_blocked_user_id: blockedId });
    setActioning(null);
    if (rpcErr) return;
    setBlocked((prev) => prev.filter((b) => b.blocked_id !== blockedId));
  };

  if (loading) {
    return <div className="flex items-center gap-3 py-16"><LoadingSpinner className="text-primary-500" /> <span className="text-stone-500">Loading…</span></div>;
  }
  if (error) {
    return <ErrorState description="Couldn't load your blocked users list." onRetry={load} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button onClick={() => navigate('/settings')} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400"><ArrowLeft className="h-4 w-4" /> Settings</button>
      <PageHeader title="Blocked users" subtitle="People you've blocked can't follow you, reply to your comments, or send you notifications." />

      {blocked.length === 0 ? (
        <EmptyState icon={<Ban className="h-6 w-6" />} title="No blocked users" description="You haven't blocked anyone. If someone is bothering you, you can block them from their profile page." />
      ) : (
        <div className="space-y-2">
          {blocked.map((b) => (
            <div key={b.id} className="card flex items-center gap-3 p-4">
              {b.blocked && <Avatar url={b.blocked.avatar_url ?? null} name={b.blocked.display_name} size={40} />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{b.blocked?.display_name ?? 'Unknown user'}</p>
                <p className="truncate text-xs text-stone-400">@{b.blocked?.username}</p>
              </div>
              <button
                onClick={() => handleUnblock(b.blocked_id)}
                disabled={actioning === b.blocked_id}
                className="btn-outline text-sm"
              >
                {actioning === b.blocked_id ? <LoadingSpinner size={16} /> : <><Unlock className="h-4 w-4" /> Unblock</>}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card flex items-start gap-3 p-4">
        <UserX className="mt-0.5 h-5 w-5 shrink-0 text-stone-400" />
        <p className="text-sm text-stone-500 dark:text-stone-400">
          When you block someone, all existing follows between you and that person are removed. They won't be notified that you blocked them.
        </p>
      </div>
    </div>
  );
}
