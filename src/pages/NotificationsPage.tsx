import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate } from '@/lib/router';
import { PageHeader } from '@/components/Avatar';
import { Avatar } from '@/components/Avatar';
import { EmptyState, ErrorState, LoadingSpinner } from '@/components/States';
import type { AppNotification, NotificationType } from '@/types/database';
import {
  Bell, Heart, MessageCircle, UserPlus, Bookmark, Layers, Check, X, AlertCircle
} from 'lucide-react';

export default function NotificationsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [unavailableId, setUnavailableId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(false);
    try {
      const { data, error: err } = await supabase
        .from('notifications')
        .select('*, actor:profiles(id, username, display_name, avatar_url)')
        .eq('recipient_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (err) { setError(true); return; }
      setNotifications((data as AppNotification[] | null) ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${profile.id}` },
        () => { load(); }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${profile.id}` },
        () => { load(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    if (!profile || unreadCount === 0) return;
    setMarkingAll(true);
    const { error: updErr } = await supabase.from('notifications').update({ read: true }).eq('recipient_id', profile.id).eq('read', false);
    setMarkingAll(false);
    // Update in place instead of reloading (avoids the full-page spinner)
    if (!updErr) setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
  };

  const handleMarkRead = async (n: AppNotification) => {
    if (n.read) { handleNavigate(n); return; }
    await supabase.from('notifications').update({ read: true }).eq('id', n.id);
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    handleNavigate(n);
  };

  const handleDismiss = async (n: AppNotification) => {
    await supabase.from('notifications').update({ read: true }).eq('id', n.id);
    setNotifications((prev) => prev.filter((item) => item.id !== n.id));
  };

  const handleNavigate = async (n: AppNotification) => {
    if (n.type === 'follow' && n.actor) {
      const { data: prof } = await supabase.from('profiles').select('id').eq('id', n.actor.id).maybeSingle();
      if (!prof) {
        setUnavailableId(n.id);
        setTimeout(() => setUnavailableId(null), 3000);
        return;
      }
      navigate(`/profile/${n.actor.id}`);
    } else if (n.type === 'comment' || n.type === 'gem_reaction' || n.type === 'reply' ||
      n.type === 'correction_accepted' || n.type === 'correction_rejected' ||
      n.type === 'correction_needs_info' || n.type === 'correction_escalated' ||
      n.type === 'comment_reaction') {
      if (!n.entity_id) {
        setUnavailableId(n.id);
        setTimeout(() => setUnavailableId(null), 3000);
        return;
      }
      const { data: gem } = await supabase.from('gems').select('id').eq('id', n.entity_id).maybeSingle();
      if (!gem) {
        setUnavailableId(n.id);
        setTimeout(() => setUnavailableId(null), 3000);
        return;
      }
      navigate(`/gems/${n.entity_id}`);
    } else if (n.type === 'collection_add') {
      if (!n.entity_id) {
        setUnavailableId(n.id);
        setTimeout(() => setUnavailableId(null), 3000);
        return;
      }
      const { data: coll } = await supabase.from('collections').select('id').eq('id', n.entity_id).maybeSingle();
      if (!coll) {
        setUnavailableId(n.id);
        setTimeout(() => setUnavailableId(null), 3000);
        return;
      }
      navigate(`/collections/${n.entity_id}`);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-3 py-16"><LoadingSpinner className="text-primary-500" /> <span className="text-stone-500">Loading notifications…</span></div>;
  }

  if (error) {
    return <ErrorState description="Couldn't load notifications." onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : "You're all caught up"}
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/settings')} className="btn-ghost hidden text-sm sm:inline-flex">Preferences</button>
            {unreadCount > 0 && <button onClick={handleMarkAllRead} disabled={markingAll} className="btn-outline text-sm">{markingAll ? <LoadingSpinner size={16} /> : <><Check className="h-4 w-4" /> Mark all read</>}</button>}
          </div>
        }
      />

      {unavailableId && (
        <div className="flex items-center gap-2 rounded-2xl bg-citrine-100 px-4 py-3 text-sm text-citrine-700 dark:bg-citrine-500/15 dark:text-citrine-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          That item has been deleted or is no longer visible to you.
        </div>
      )}

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title="You're all caught up"
          description="Comments, reactions, new followers and collection adds will show up here."
          action={<button onClick={() => navigate('/settings')} className="btn-outline">Choose what you're notified about</button>}
        />
      ) : (
        <div className="space-y-6">
          {groupByDay(notifications).map(([label, group]) => (
            <section key={label}>
              <h2 className="mb-2 px-1 text-sm font-semibold text-stone-500 dark:text-stone-400">{label}</h2>
              <div className="overflow-hidden rounded-3xl bg-white shadow-card dark:bg-stone-900">
                {group.map((n, idx) => (
                  <div key={n.id} className={`group flex items-center gap-3 px-4 py-3.5 ${idx > 0 ? 'border-t border-stone-100 dark:border-stone-800' : ''} ${n.read ? '' : 'bg-primary-50/60 dark:bg-primary-500/10'}`}>
                    <button onClick={() => handleMarkRead(n)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="relative shrink-0">
                        <Avatar url={n.actor?.avatar_url ?? null} name={n.actor?.display_name ?? '?'} size={44} />
                        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-card dark:bg-stone-900">
                          <NotificationIcon type={n.type} />
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-snug">
                          <span className="font-semibold">{n.actor?.display_name ?? 'Someone'}</span>{' '}
                          <span className="text-stone-600 dark:text-stone-300">{notificationText(n.type)}</span>
                        </span>
                        <span className="mt-0.5 block text-xs text-stone-400">{timeAgo(n.created_at)}</span>
                      </span>
                      {!n.read && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary-500" aria-label="Unread" />}
                    </button>
                    <button
                      onClick={() => handleDismiss(n)}
                      className="shrink-0 rounded-xl p-1.5 text-stone-300 transition-opacity hover:bg-stone-100 hover:text-stone-500 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 dark:hover:bg-stone-800"
                      title="Dismiss"
                      aria-label="Dismiss notification"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByDay(items: AppNotification[]): [string, AppNotification[]][] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();
  const weekAgo = today - 6 * 86400000;
  const groups: Record<string, AppNotification[]> = { Today: [], 'This week': [], Earlier: [] };
  for (const n of items) {
    const t = new Date(n.created_at).getTime();
    groups[t >= today ? 'Today' : t >= weekAgo ? 'This week' : 'Earlier'].push(n);
  }
  return Object.entries(groups).filter(([, g]) => g.length > 0);
}

function notificationText(type: NotificationType): string {
  switch (type) {
    case 'comment': return 'commented on your gem';
    case 'reply': return 'replied to your comment';
    case 'gem_reaction': return 'reacted to your gem';
    case 'comment_reaction': return 'reacted to your comment';
    case 'follow': return 'started following you';
    case 'collection_add': return 'added your gem to a collection';
    case 'correction_accepted': return 'accepted your correction suggestion';
    case 'correction_rejected': return 'rejected your correction suggestion';
    case 'correction_needs_info': return 'requested more information on your correction';
    case 'correction_escalated': return 'escalated your correction for review';
  }
}

function NotificationIcon({ type }: { type: NotificationType }) {
  const iconClass = "h-3.5 w-3.5";
  switch (type) {
    case 'comment':
    case 'reply':
      return <MessageCircle className={`${iconClass} text-primary-500`} />;
    case 'gem_reaction':
    case 'comment_reaction':
      return <Heart className={`${iconClass} text-error-500`} />;
    case 'follow':
      return <UserPlus className={`${iconClass} text-accent-500`} />;
    case 'collection_add':
      return <Layers className={`${iconClass} text-primary-500`} />;
    case 'correction_accepted':
    case 'correction_rejected':
    case 'correction_needs_info':
    case 'correction_escalated':
      return <Bookmark className={`${iconClass} text-accent-500`} />;
    default:
      return <Bell className={`${iconClass} text-stone-400`} />;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
