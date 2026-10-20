import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate, useRoute, matchPath } from '@/lib/router';
import { Avatar, PageHeader } from '@/components/Avatar';
import { EmptyState, ErrorState, LoadingSpinner } from '@/components/States';
import type { Community, Profile, UserInterest } from '@/types/database';
import { MapPin, Calendar, Pencil, Settings, Layers, Compass, Users, ArrowLeft } from 'lucide-react';

export default function ProfilePage() {
  const route = useRoute();
  const navigate = useNavigate();
  const { profile: myProfile, refreshProfile } = useAuth();

  // /profile (self) or /profile/:id
  const match = matchPath('/profile/:id', route.path);
  const targetId = match?.id ?? myProfile?.id ?? '';
  const isSelf = !match || match.id === myProfile?.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [interests, setInterests] = useState<UserInterest[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<'gems' | 'collections' | 'communities' | 'about'>('about');

  const load = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    setError(false);
    try {
      const { data: p, error: pErr } = await supabase.from('profiles').select('*').eq('id', targetId).maybeSingle();
      if (pErr || !p) { setError(true); return; }
      setProfile(p as Profile);

      const [iRes, cRes] = await Promise.all([
        supabase.from('user_interests').select('*').eq('user_id', targetId),
        // Only show communities the viewer can see
        supabase.from('community_members').select('community:communities(*)').eq('user_id', targetId),
      ]);
      setInterests((iRes.data as UserInterest[] | null) ?? []);
      setCommunities(((cRes.data as { community: Community }[] | null) ?? []).map((c) => c.community).filter(Boolean));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex items-center gap-3 py-16"><LoadingSpinner className="text-primary-500" /> <span className="text-stone-500">Loading profile…</span></div>;
  }
  if (error || !profile) {
    return <ErrorState title="Profile not found" description="This profile may not exist." onRetry={() => navigate('/discover')} />;
  }

  const joinDate = new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
  const showArea = isSelf || profile.show_area;

  return (
    <div className="space-y-6">
      {!isSelf && (
        <button onClick={() => window.history.back()} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400"><ArrowLeft className="h-4 w-4" /> Back</button>
      )}

      <div className="card overflow-hidden">
        <div className="h-24 bg-gradient-to-br from-primary-300 to-accent-400" />
        <div className="px-5 pb-5 sm:px-6">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
            <Avatar url={profile.avatar_url} name={profile.display_name} size={80} />
            {isSelf && (
              <div className="flex gap-2">
                <button onClick={() => navigate('/settings')} className="btn-outline"><Settings className="h-4 w-4" /> Privacy</button>
                <button onClick={() => navigate('/profile/edit')} className="btn-primary"><Pencil className="h-4 w-4" /> Edit profile</button>
              </div>
            )}
          </div>

          <div className="mt-4">
            <h1 className="font-display text-2xl font-semibold">{profile.display_name}</h1>
            <p className="text-stone-400">@{profile.username}</p>
            {profile.bio && <p className="mt-2 text-stone-600 dark:text-stone-300">{profile.bio}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-stone-500 dark:text-stone-400">
              {showArea && profile.home_area && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {profile.home_area}</span>}
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Joined {joinDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hide">
        {([
          { key: 'about', label: 'About', icon: Users },
          { key: 'gems', label: 'Gems', icon: Compass },
          { key: 'collections', label: 'Collections', icon: Layers },
          { key: 'communities', label: 'Communities', icon: Users },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${tab === t.key ? 'bg-primary-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300'}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'about' && (
        <div className="space-y-4">
          {interests.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-3 font-display text-base font-semibold">Interests</h2>
              <div className="flex flex-wrap gap-2">
                {interests.map((i) => <span key={i.id} className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{i.interest}</span>)}
              </div>
            </div>
          )}
          {profile.bio && (
            <div className="card p-5">
              <h2 className="mb-2 font-display text-base font-semibold">About</h2>
              <p className="text-sm text-stone-600 dark:text-stone-300">{profile.bio}</p>
            </div>
          )}
          {interests.length === 0 && !profile.bio && (
            <EmptyState icon={<Users className="h-6 w-6" />} title="Nothing here yet" description={isSelf ? "Add interests and a bio from your edit profile page." : "This person hasn't added details yet."} />
          )}
        </div>
      )}

      {tab === 'gems' && (
        <EmptyState icon={<Compass className="h-6 w-6" />} title="Gems coming in Phase 2" description="Recommended places will appear here once the gem creation feature is built." />
      )}
      {tab === 'collections' && (
        <EmptyState icon={<Layers className="h-6 w-6" />} title="Collections coming in Phase 3" description="Curated collections of gems will appear here." />
      )}

      {tab === 'communities' && (
        <div>
          {communities.length === 0 ? (
            <EmptyState icon={<Users className="h-6 w-6" />} title="No communities yet" description={isSelf ? "Join or create communities to see them here." : "This person hasn't joined any visible communities."} action={isSelf ? <button onClick={() => navigate('/communities')} className="btn-primary">Browse communities</button> : undefined} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {communities.map((c) => (
                <button key={c.id} onClick={() => navigate(`/communities/${c.id}`)} className="card flex items-center gap-3 p-3.5 text-left transition-shadow hover:shadow-card-hover">
                  <div className="h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br from-primary-300 to-accent-400" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <p className="truncate text-xs text-stone-400">{c.general_area ?? '—'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
