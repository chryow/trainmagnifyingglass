import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate, useRoute, matchPath } from '@/lib/router';
import { Avatar, PageHeader } from '@/components/Avatar';
import { EmptyState, ErrorState, LoadingSpinner } from '@/components/States';
import ReportModal from '@/components/ReportModal';
import type { Community, Profile, UserInterest, Gem, Collection, Follow } from '@/types/database';
import { MapPin, Calendar, Pencil, Settings, Layers, Compass, Users, ArrowLeft, Bookmark, UserPlus, UserCheck, Map, Ban, Flag } from 'lucide-react';

export default function ProfilePage() {
  const route = useRoute();
  const navigate = useNavigate();
  const { profile: myProfile } = useAuth();

  const match = matchPath('/profile/:id', route.path);
  const RESERVED_SEGMENTS = ['edit', 'settings', 'password', 'delete-account'];
  const targetId = match && !RESERVED_SEGMENTS.includes(match.id) ? match.id : (myProfile?.id ?? '');
  const isSelf = !match || match.id === myProfile?.id || RESERVED_SEGMENTS.includes(match?.id ?? '');

  const [profile, setProfile] = useState<Profile | null>(null);
  const [interests, setInterests] = useState<UserInterest[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [gems, setGems] = useState<Gem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [savedGems, setSavedGems] = useState<Gem[]>([]);
  const [following, setFollowing] = useState<Follow[]>([]);
  const [followers, setFollowers] = useState<Follow[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<'about' | 'gems' | 'collections' | 'saved' | 'communities' | 'following' | 'followers'>('about');
  const [followAction, setFollowAction] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockAction, setBlockAction] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const load = useCallback(async () => {
    if (!targetId || !myProfile) return;
    setLoading(true);
    setError(false);
    setIsFollowing(false);
    setIsBlocked(false);
    try {
      const { data: p, error: pErr } = await supabase.from('profiles').select('*').eq('id', targetId).maybeSingle();
      if (pErr || !p) { setError(true); return; }
      setProfile(p as Profile);

      const [iRes, cRes] = await Promise.all([
        supabase.from('user_interests').select('*').eq('user_id', targetId),
        supabase.from('community_members').select('community:communities(*)').eq('user_id', targetId),
      ]);
      setInterests((iRes.data as UserInterest[] | null) ?? []);
      setCommunities(((cRes.data as { community: Community }[] | null) ?? []).map((c) => c.community).filter(Boolean));

      // Gems by this user (only published ones visible to others; drafts visible to self)
      const gemsQuery = isSelf
        ? supabase.from('gems').select('*, author:profiles(id, username, display_name, avatar_url), community:communities(id, name, visibility), category:categories(id, name, slug, icon)').eq('author_id', targetId).order('created_at', { ascending: false })
        : supabase.from('gems').select('*, author:profiles(id, username, display_name, avatar_url), community:communities(id, name, visibility), category:categories(id, name, slug, icon)').eq('author_id', targetId).eq('status', 'published').order('created_at', { ascending: false });
      const { data: gData } = await gemsQuery;
      setGems((gData as Gem[] | null) ?? []);

      // Collections — visible based on privacy + viewer relationship
      const { data: colData } = await supabase
        .from('collections')
        .select('*, owner:profiles(id, username, display_name, avatar_url)')
        .eq('owner_id', targetId)
        .order('updated_at', { ascending: false });
      setCollections((colData as Collection[] | null) ?? []);

      // Saved gems (only visible to self)
      if (isSelf) {
        const { data: sData } = await supabase
          .from('saved_gems')
          .select('gem:gems(*, author:profiles(id, username, display_name, avatar_url), community:communities(id, name, visibility), category:categories(id, name, slug, icon))')
          .eq('user_id', targetId)
          .order('created_at', { ascending: false });
        const sg = (sData as { gem: Gem }[] | null) ?? [];
        setSavedGems(sg.map((s) => s.gem).filter(Boolean));
      }

      // Following / followers
      const [fRes, frRes] = await Promise.all([
        supabase.from('follows').select('*, followee:profiles(id, username, display_name, avatar_url)').eq('follower_id', targetId),
        supabase.from('follows').select('*, follower:profiles(id, username, display_name, avatar_url)').eq('followee_id', targetId),
      ]);
      const followingData = (fRes.data as Follow[] | null) ?? [];
      const followersData = (frRes.data as Follow[] | null) ?? [];

      // Resolve null profile joins via safe_profile_summary (for community_only profiles)
      const missingFollowingIds = followingData.filter((f) => !f.followee).map((f) => f.followee_id);
      const missingFollowerIds = followersData.filter((f) => !f.follower).map((f) => f.follower_id);
      const missingIds = Array.from(new Set([...missingFollowingIds, ...missingFollowerIds]));
      const safeProfiles = new Map<string, { id: string; username: string; display_name: string; avatar_url: string | null }>();
      if (missingIds.length > 0) {
        const { data: summaries } = await supabase.rpc('safe_profile_summary', { p_user_id: missingIds[0] });
        // RPC only accepts single UUID, so fetch individually for multiple
        if (missingIds.length === 1 && summaries) {
          const s = summaries as { id: string; username: string; display_name: string; avatar_url: string | null } | null;
          if (s) safeProfiles.set(s.id, s);
        } else {
          const results = await Promise.all(
            missingIds.map((id) => supabase.rpc('safe_profile_summary', { p_user_id: id }).maybeSingle())
          );
          for (const r of results) {
            const s = r.data as { id: string; username: string; display_name: string; avatar_url: string | null } | null;
            if (s) safeProfiles.set(s.id, s);
          }
        }
      }

      const enrichedFollowing = followingData.map((f) => {
        if (f.followee) return f;
        const safe = safeProfiles.get(f.followee_id);
        return safe ? { ...f, followee: safe } : f;
      });
      const enrichedFollowers = followersData.map((f) => {
        if (f.follower) return f;
        const safe = safeProfiles.get(f.follower_id);
        return safe ? { ...f, follower: safe } : f;
      });

      setFollowing(enrichedFollowing);
      setFollowers(enrichedFollowers);

      // Is current user following this person?
      if (!isSelf) {
        const [myFollow, myBlock] = await Promise.all([
          supabase.from('follows').select('id').eq('follower_id', myProfile.id).eq('followee_id', targetId).maybeSingle(),
          supabase.from('blocked_users').select('id').eq('blocker_id', myProfile.id).eq('blocked_id', targetId).maybeSingle(),
        ]);
        setIsFollowing(!!myFollow.data);
        setIsBlocked(!!myBlock.data);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [targetId, isSelf, myProfile]);

  useEffect(() => { load(); }, [load]);

  const handleToggleFollow = async () => {
    if (!profile || !myProfile || isSelf) return;
    setFollowAction(true);
    if (isFollowing) {
      const { error: delErr } = await supabase.from('follows').delete().eq('follower_id', myProfile.id).eq('followee_id', profile.id);
      if (delErr) {
        setFollowAction(false);
        return;
      }
      setIsFollowing(false);
      setFollowers((prev) => prev.filter((f) => f.follower_id !== myProfile.id));
    } else {
      const { error: insErr } = await supabase.from('follows').insert({ follower_id: myProfile.id, followee_id: profile.id });
      if (insErr) {
        setFollowAction(false);
        return;
      }
      setIsFollowing(true);
      setFollowers((prev) => [...prev, { id: 'temp', follower_id: myProfile.id, followee_id: profile.id, created_at: new Date().toISOString(), follower: { id: myProfile.id, username: myProfile.username, display_name: myProfile.display_name, avatar_url: myProfile.avatar_url } }]);
    }
    setFollowAction(false);
  };

  const handleToggleBlock = async () => {
    if (!profile || !myProfile || isSelf) return;
    setBlockAction(true);
    if (isBlocked) {
      const { error: rpcErr } = await supabase.rpc('unblock_user', { p_blocked_user_id: profile.id });
      if (!rpcErr) setIsBlocked(false);
    } else {
      if (!confirm(`Block ${profile.display_name}? They won't be able to follow you or reply to your content.`)) {
        setBlockAction(false);
        return;
      }
      const { error: rpcErr } = await supabase.rpc('block_user', { p_blocked_user_id: profile.id });
      if (!rpcErr) {
        setIsBlocked(true);
        setIsFollowing(false);
        setFollowers((prev) => prev.filter((f) => f.follower_id !== myProfile.id));
      }
    }
    setBlockAction(false);
  };

  if (loading) {
    return <div className="flex items-center gap-3 py-16"><LoadingSpinner className="text-primary-500" /> <span className="text-stone-500">Loading profile…</span></div>;
  }
  if (error || !profile) {
    return <ErrorState title="Profile not found" description="This profile may not exist." onRetry={() => navigate('/discover')} />;
  }

  const joinDate = new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
  const showArea = isSelf || profile.show_area;
  const showFollowingTab = isSelf || profile.show_following;
  const showFollowersTab = isSelf || profile.show_followers;
  const canFollow = !isSelf && profile.allow_followers;

  const tabs: { key: typeof tab; label: string; icon: typeof Users }[] = [
    { key: 'about', label: 'About', icon: Users },
    { key: 'gems', label: `Gems (${gems.length})`, icon: Compass },
    { key: 'collections', label: `Collections (${collections.length})`, icon: Layers },
    ...(isSelf ? [{ key: 'saved' as const, label: `Saved (${savedGems.length})`, icon: Bookmark }] : []),
    { key: 'communities', label: 'Communities', icon: Users },
    ...(showFollowingTab ? [{ key: 'following' as const, label: `Following (${following.length})`, icon: UserCheck }] : []),
    ...(showFollowersTab ? [{ key: 'followers' as const, label: `Followers (${followers.length})`, icon: Users }] : []),
  ];

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
            <div className="flex gap-2">
              {isSelf ? (
                <>
                  <button onClick={() => navigate('/settings')} className="btn-outline"><Settings className="h-4 w-4" /> Privacy</button>
                  <button onClick={() => navigate('/profile/edit')} className="btn-primary"><Pencil className="h-4 w-4" /> Edit profile</button>
                </>
              ) : canFollow ? (
                <button onClick={handleToggleFollow} disabled={followAction} className={isFollowing ? 'btn-outline' : 'btn-primary'}>
                  {followAction ? <LoadingSpinner size={16} /> : isFollowing ? <><UserCheck className="h-4 w-4" /> Following</> : <><UserPlus className="h-4 w-4" /> Follow</>}
                </button>
              ) : null}
              {!isSelf && (
                <>
                  <button onClick={() => setShowReport(true)} className="btn-outline" title="Report">
                    <Flag className="h-4 w-4" />
                  </button>
                  <button onClick={handleToggleBlock} disabled={blockAction} className={isBlocked ? 'btn-outline' : 'btn-outline'} title={isBlocked ? 'Unblock' : 'Block'}>
                    {blockAction ? <LoadingSpinner size={16} /> : <Ban className={`h-4 w-4 ${isBlocked ? 'text-error-500' : ''}`} />}
                  </button>
                </>
              )}
            </div>
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
        {tabs.map((t) => (
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
        <div>
          {gems.length === 0 ? (
            <EmptyState icon={<Compass className="h-6 w-6" />} title="No gems yet" description={isSelf ? "Share your first hidden gem with a community." : "This person hasn't shared any gems yet."} action={isSelf ? <button onClick={() => navigate('/gems/new')} className="btn-primary">Share a gem</button> : undefined} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {gems.map((g) => (
                <button key={g.id} onClick={() => navigate(`/gems/${g.id}`)} className="card overflow-hidden text-left transition-shadow hover:shadow-card-hover">
                  {g.cover_image_url ? (
                    <img src={g.cover_image_url} alt={g.title} className="h-32 w-full object-cover" />
                  ) : (
                    <div className="flex h-32 items-center justify-center bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900/30 dark:to-accent-900/30" />
                  )}
                  <div className="p-4">
                    {g.status === 'draft' && <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Draft</span>}
                    <h3 className="font-display text-base font-semibold">{g.title}</h3>
                    <p className="mt-1 flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400"><MapPin className="h-3.5 w-3.5" /> {g.place_name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'collections' && (
        <div>
          {collections.length === 0 ? (
            <EmptyState icon={<Layers className="h-6 w-6" />} title="No collections yet" description={isSelf ? "Create a collection to organize your favorite gems." : "This person hasn't created any visible collections."} action={isSelf ? <button onClick={() => navigate('/collections/new')} className="btn-primary">Create collection</button> : undefined} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {collections.map((c) => (
                <button key={c.id} onClick={() => navigate(`/collections/${c.id}`)} className="card overflow-hidden text-left transition-shadow hover:shadow-card-hover">
                  <div className="h-24 bg-gradient-to-br from-primary-300 to-accent-400" />
                  <div className="p-4">
                    <h3 className="font-display text-base font-semibold">{c.name}</h3>
                    {c.description && <p className="mt-1 line-clamp-2 text-sm text-stone-500 dark:text-stone-400">{c.description}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'saved' && isSelf && (
        <div>
          {savedGems.length === 0 ? (
            <EmptyState icon={<Bookmark className="h-6 w-6" />} title="No saved gems" description="Bookmark gems you want to revisit later." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {savedGems.map((g) => (
                <button key={g.id} onClick={() => navigate(`/gems/${g.id}`)} className="card overflow-hidden text-left transition-shadow hover:shadow-card-hover">
                  {g.cover_image_url ? (
                    <img src={g.cover_image_url} alt={g.title} className="h-32 w-full object-cover" />
                  ) : (
                    <div className="flex h-32 items-center justify-center bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900/30 dark:to-accent-900/30" />
                  )}
                  <div className="p-4">
                    <h3 className="font-display text-base font-semibold">{g.title}</h3>
                    <p className="mt-1 flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400"><MapPin className="h-3.5 w-3.5" /> {g.place_name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
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

      {tab === 'following' && showFollowingTab && (
        <div>
          {following.length === 0 ? (
            <EmptyState icon={<UserCheck className="h-6 w-6" />} title="Not following anyone" description={isSelf ? "Follow people to see their gems and collections in your feed." : "This person isn't following anyone."} action={isSelf ? <button onClick={() => navigate('/search')} className="btn-primary">Discover people</button> : undefined} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {following.map((f) => (
                <button key={f.id} onClick={() => navigate(`/profile/${f.followee_id}`)} className="card flex items-center gap-3 p-3.5 text-left transition-shadow hover:shadow-card-hover">
                  <Avatar url={f.followee?.avatar_url ?? null} name={f.followee?.display_name ?? 'User'} size={40} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{f.followee?.display_name}</p>
                    <p className="truncate text-xs text-stone-400">@{f.followee?.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'followers' && showFollowersTab && (
        <div>
          {followers.length === 0 ? (
            <EmptyState icon={<Users className="h-6 w-6" />} title="No followers yet" description={isSelf ? "Share great gems and people will follow you." : "This person doesn't have followers yet."} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {followers.map((f) => (
                <button key={f.id} onClick={() => navigate(`/profile/${f.follower_id}`)} className="card flex items-center gap-3 p-3.5 text-left transition-shadow hover:shadow-card-hover">
                  <Avatar url={f.follower?.avatar_url ?? null} name={f.follower?.display_name ?? 'User'} size={40} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{f.follower?.display_name}</p>
                    <p className="truncate text-xs text-stone-400">@{f.follower?.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showReport && profile && (
        <ReportModal
          targetType="profile"
          targetId={profile.id}
          onClose={() => setShowReport(false)}
          onSubmitted={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
