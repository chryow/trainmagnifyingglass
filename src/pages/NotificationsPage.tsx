import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate } from '@/lib/router';
import { PageHeader } from '@/components/Avatar';
import { Avatar } from '@/components/Avatar';
import { EmptyState, ErrorState, LoadingSpinner } from '@/components/States';
import type { AppNotification, NotificationType } from '@/types/database';
import {
  Bell, Heart, MessageCircle, UserPlus, Bookmark, Layers, Check
} from 'lucide-react';

export default function NotificationsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

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

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    if (!profile || unreadCount === 0) return;
    setMarkingAll(true);
    await supabase.from('notifications').update({ read: true }).eq('recipient_id', profile.id).eq('read', false);
    setMarkingAll(false);
    await load();
  };

  const handleMarkRead = async (n: AppNotification) => {
    if (n.read) { handleNavigate(n); return; }
    await supabase.from('notifications').update({ read: true }).eq('id', n.id);
    await load();
    handleNavigate(n);
  };

  const handleNavigate = (n: AppNotification) => {
    if (n.type === 'follow' && n.actor) navigate(`/profile/${n.actor.id}`);
    else if (n.type === 'comment' || n.type === 'gem_reaction') {
      if (n.entity_id) navigate(`/gems/${n.entity_id}`);
    } else if (n.type === 'reply') {
      if (n.entity_id) navigate(`/gems/${n.entity_id}`);
    } else if (n.type === 'collection_add') {
      if (n.entity_id) navigate(`/collections/${n.entity_id}`);
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
        action={unreadCount > 0 ? <button onClick={handleMarkAllRead} disabled={markingAll} className="btn-outline text-sm">{markingAll ? <LoadingSpinner size={16} /> : <><Check className="h-4 w-4" /> Mark all read</>}</button> : undefined}
      />

      {notifications.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications yet" description="You'll be notified when someone comments on your gems, reacts, or follows you." />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleMarkRead(n)}
              className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-stone-50 dark:hover:bg-stone-800 ${n.read ? 'border-stone-200 dark:border-stone-800' : 'border-primary-300 bg-primary-50/50 dark:border-primary-700 dark:bg-primary-900/20'}`}
            >
              <NotificationIcon type={n.type} />
              {n.actor && <Avatar url={n.actor.avatar_url ?? null} name={n.actor.display_name} size={36} />}
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{n.actor?.display_name ?? 'Someone'}</span>{' '}
                  <span className="text-stone-500 dark:text-stone-400">{notificationText(n.type)}</span>
                </p>
                <p className="mt-0.5 text-xs text-stone-400">{timeAgo(n.created_at)}</p>
              </div>
              {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function notificationText(type: NotificationType): string {
  switch (type) {
    case 'comment': return 'commented on your gem';
    case 'reply': return 'replied to your comment';
    case 'gem_reaction': return 'reacted to your gem';
    case 'comment_reaction': return 'reacted to your comment';
    case 'follow': return 'started following you';
    case 'collection_add': return 'added your gem to a collection';
  }
}

function NotificationIcon({ type }: { type: NotificationType }) {
  const iconClass = "h-5 w-5";
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
