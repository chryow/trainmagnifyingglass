import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate, useRoute, matchPath } from '@/lib/router';
import { Logo } from '@/components/Logo';
import { Avatar } from '@/components/Avatar';
import { useTheme } from '@/lib/theme';
import type { ReactNode } from 'react';
import { Compass, Layers, Plus, Bell, User as UserIcon, Map, Users, Heart, Moon, Sun, LogOut, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface NavItem {
  label: string;
  path: string;
  icon: typeof Compass;
  matchPatterns: string[];
}

// Phones: the five places people go most. Collections live on the profile,
// notifications in the top bar.
const MOBILE_NAV: NavItem[] = [
  { label: 'Discover', path: '/discover', icon: Compass, matchPatterns: ['/discover', '/following'] },
  { label: 'Explore', path: '/explore', icon: Map, matchPatterns: ['/explore', '/search'] },
  { label: 'Add gem', path: '/gems/new', icon: Plus, matchPatterns: ['/gems/new'] },
  { label: 'Communities', path: '/communities', icon: Users, matchPatterns: ['/communities'] },
  { label: 'Profile', path: '/profile', icon: UserIcon, matchPatterns: ['/profile', '/settings', '/collections'] },
];

const DESKTOP_NAV: NavItem[] = [
  { label: 'Discover', path: '/discover', icon: Compass, matchPatterns: ['/discover'] },
  { label: 'Explore', path: '/explore', icon: Map, matchPatterns: ['/explore', '/search'] },
  { label: 'Communities', path: '/communities', icon: Users, matchPatterns: ['/communities'] },
  { label: 'Following', path: '/following', icon: Heart, matchPatterns: ['/following'] },
  { label: 'Collections', path: '/collections', icon: Layers, matchPatterns: ['/collections'] },
  { label: 'Notifications', path: '/notifications', icon: Bell, matchPatterns: ['/notifications'] },
  { label: 'Profile', path: '/profile', icon: UserIcon, matchPatterns: ['/profile', '/settings'] },
];

function isActive(path: string, patterns: string[]) {
  return patterns.some((p) => matchPath(p, path) !== null || (p !== '/' && path.startsWith(p)));
}

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const route = useRoute();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!profile) return;
    supabase.rpc('is_platform_admin').then(({ data }) => setIsAdmin(!!data));
  }, [profile]);

  // Unread badge: refreshed whenever the user moves between pages
  useEffect(() => {
    if (!profile) return;
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', profile.id)
      .eq('read', false)
      .then(({ count }) => setUnread(count ?? 0));
  }, [profile, route.path]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const iconButton = 'relative rounded-xl p-2 text-stone-600 transition-colors hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800';
  const unreadDot = unread > 0 && (
    <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-primary-500 ring-2 ring-white dark:ring-stone-900" aria-hidden />
  );

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-stone-200/70 bg-white px-4 py-6 dark:border-stone-800 dark:bg-stone-900 lg:flex">
        <button onClick={() => navigate('/discover')} className="mb-6 flex items-center gap-2.5 px-2">
          <Logo className="h-9 w-9" />
          <span className="font-display text-xl font-extrabold">Hidden Gems</span>
        </button>

        <button onClick={() => navigate('/gems/new')} className="btn-primary mb-6 w-full py-3">
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Add a gem
        </button>

        <nav className="flex flex-1 flex-col gap-0.5">
          {DESKTOP_NAV.map((item) => {
            const active = isActive(route.path, item.matchPatterns);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300'
                    : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800'
                }`}
              >
                <item.icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                {item.label}
                {item.path === '/notifications' && unread > 0 && (
                  <span className="ml-auto rounded-full bg-primary-500 px-2 py-0.5 text-[11px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>
                )}
              </button>
            );
          })}

          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              aria-current={isActive(route.path, ['/admin']) ? 'page' : undefined}
              className={`mt-3 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                isActive(route.path, ['/admin'])
                  ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300'
                  : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800'
              }`}
            >
              <Shield className="h-5 w-5" />
              Admin Panel
            </button>
          )}
        </nav>

        <div className="space-y-1 border-t border-stone-200/70 pt-4 dark:border-stone-800">
          {profile && (
            <button onClick={() => navigate('/profile')} className="mb-1 flex w-full items-center gap-3 rounded-2xl p-2 hover:bg-stone-100 dark:hover:bg-stone-800">
              <Avatar url={profile.avatar_url} name={profile.display_name} size={36} />
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold">{profile.display_name}</p>
                <p className="truncate text-xs text-stone-400">@{profile.username}</p>
              </div>
            </button>
          )}
          <div className="flex gap-1">
            <button onClick={toggleTheme} className="btn-ghost flex-1 justify-start px-3 text-stone-500" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button onClick={handleSignOut} className="btn-ghost flex-1 justify-start px-3 text-stone-500">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200/60 bg-white/80 px-4 py-2.5 backdrop-blur-xl dark:border-stone-800 dark:bg-stone-900/80 lg:hidden">
        <button onClick={() => navigate('/discover')} className="flex items-center gap-2">
          <Logo className="h-8 w-8" />
          <span className="font-display text-lg font-extrabold">Hidden Gems</span>
        </button>
        <div className="flex items-center gap-0.5">
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className={`${iconButton} ${isActive(route.path, ['/admin']) ? '!text-accent-600 dark:!text-accent-400' : ''}`}
              aria-label="Admin Panel"
            >
              <Shield className="h-5 w-5" />
            </button>
          )}
          <button onClick={toggleTheme} className={iconButton} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            onClick={() => navigate('/notifications')}
            className={`${iconButton} ${isActive(route.path, ['/notifications']) ? '!text-primary-600 dark:!text-primary-400' : ''}`}
            aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
          >
            <Bell className="h-5 w-5" />
            {unreadDot}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="pb-28 pt-5 lg:ml-64 lg:pb-12 lg:pt-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-10">{children}</div>
      </main>

      {/* Mobile bottom nav: a floating bar with the gem button in the middle */}
      <nav className="fixed inset-x-3 bottom-3 z-30 rounded-3xl border border-stone-200/70 bg-white/90 shadow-card-hover backdrop-blur-xl dark:border-stone-800 dark:bg-stone-900/90 lg:hidden" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto flex max-w-md items-stretch justify-between px-1">
          {MOBILE_NAV.map((item) => {
            const active = isActive(route.path, item.matchPatterns);
            const isAdd = item.path === '/gems/new';
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
                  active ? 'text-primary-600 dark:text-primary-400' : 'text-stone-500 dark:text-stone-400'
                }`}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
              >
                {isAdd ? (
                  <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gem text-white shadow-glow ring-4 ring-stone-50 transition-transform active:scale-95 dark:ring-stone-950">
                    <item.icon className="h-6 w-6" strokeWidth={2.5} />
                  </span>
                ) : (
                  <item.icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                )}
                {!isAdd && <span>{item.label}</span>}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
