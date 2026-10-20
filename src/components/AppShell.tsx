import { useAuth } from '@/lib/auth';
import { useNavigate, useRoute, matchPath } from '@/lib/router';
import { Logo } from '@/components/Logo';
import { useTheme } from '@/lib/theme';
import type { ReactNode } from 'react';
import { Compass, Layers, Plus, Bell, User as UserIcon, Map, Users, Heart, Moon, Sun, LogOut } from 'lucide-react';

interface NavItem {
  label: string;
  path: string;
  icon: typeof Compass;
  matchPatterns: string[];
}

const MOBILE_NAV: NavItem[] = [
  { label: 'Discover', path: '/discover', icon: Compass, matchPatterns: ['/discover'] },
  { label: 'Collections', path: '/collections', icon: Layers, matchPatterns: ['/collections', '/collections/:id'] },
  { label: 'Add Gem', path: '/gems/new', icon: Plus, matchPatterns: ['/gems/new'] },
  { label: 'Notifications', path: '/notifications', icon: Bell, matchPatterns: ['/notifications'] },
  { label: 'Profile', path: '/profile', icon: UserIcon, matchPatterns: ['/profile', '/profile/:id', '/settings'] },
];

const DESKTOP_NAV: NavItem[] = [
  { label: 'Discover', path: '/discover', icon: Compass, matchPatterns: ['/discover'] },
  { label: 'Explore', path: '/explore', icon: Map, matchPatterns: ['/explore', '/search'] },
  { label: 'Collections', path: '/collections', icon: Layers, matchPatterns: ['/collections', '/collections/:id'] },
  { label: 'Following', path: '/following', icon: Heart, matchPatterns: ['/following'] },
  { label: 'Notifications', path: '/notifications', icon: Bell, matchPatterns: ['/notifications'] },
  { label: 'Profile', path: '/profile', icon: UserIcon, matchPatterns: ['/profile', '/profile/:id', '/settings'] },
  { label: 'Communities', path: '/communities', icon: Users, matchPatterns: ['/communities', '/communities/:id'] },
];

function isActive(path: string, patterns: string[]) {
  return patterns.some((p) => matchPath(p, path) !== null || (p !== '/' && path.startsWith(p)));
}

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const route = useRoute();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-stone-200 bg-white px-3 py-5 dark:border-stone-800 dark:bg-stone-900 lg:flex">
        <button onClick={() => navigate('/discover')} className="mb-8 flex items-center gap-2 px-3">
          <Logo className="h-8 w-8" />
          <span className="font-display text-lg font-semibold">Hidden Gems</span>
        </button>

        <nav className="flex flex-1 flex-col gap-1">
          {DESKTOP_NAV.map((item) => {
            const active = isActive(route.path, item.matchPatterns);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800'
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
                {item.label === 'Add Gem' && (
                  <span className="ml-auto rounded-full bg-primary-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">+</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-1 border-t border-stone-200 pt-3 dark:border-stone-800">
          <button onClick={toggleTheme} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800">
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
          {profile && (
            <button onClick={() => navigate('/profile')} className="mt-2 flex w-full items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-stone-100 dark:hover:bg-stone-800">
              <Avatar url={profile.avatar_url} name={profile.display_name} size={32} />
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-medium">{profile.display_name}</p>
                <p className="truncate text-xs text-stone-400">@{profile.username}</p>
              </div>
            </button>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-stone-800 dark:bg-stone-900/90 lg:hidden">
        <button onClick={() => navigate('/discover')} className="flex items-center gap-2">
          <Logo className="h-7 w-7" />
          <span className="font-display text-base font-semibold">Hidden Gems</span>
        </button>
        <div className="flex items-center gap-1">
          <button onClick={toggleTheme} className="rounded-lg p-2 text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button onClick={() => navigate('/notifications')} className="relative rounded-lg p-2 text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="pb-24 pt-4 lg:ml-64 lg:pb-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur dark:border-stone-800 dark:bg-stone-900/95 lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
          {MOBILE_NAV.map((item) => {
            const active = isActive(route.path, item.matchPatterns);
            const isAdd = item.label === 'Add Gem';
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                  active ? 'text-primary-600 dark:text-primary-400' : 'text-stone-500 dark:text-stone-400'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {isAdd ? (
                  <span className={`-mt-5 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform ${active ? 'bg-primary-700' : 'bg-primary-600'} text-white`}>
                    <item.icon className="h-6 w-6" />
                  </span>
                ) : (
                  <item.icon className="h-5 w-5" />
                )}
                <span className={isAdd ? 'mt-0.5' : ''}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function Avatar({ url, name, size = 40 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    return <img src={url} alt={name} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <div className="flex items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300" style={{ width: size, height: size }}>
      {initials}
    </div>
  );
}
