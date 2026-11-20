import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useDialogs } from '@/components/Dialogs';
import { useAuth } from '@/lib/auth';
import { useNavigate, useRoute, matchPath } from '@/lib/router';
import { Avatar, PageHeader } from '@/components/Avatar';
import { EmptyState, ErrorState, LoadingSpinner } from '@/components/States';
import ReportModal from '@/components/ReportModal';
import { GemCard, GemArt } from '@/components/GemCard';
import { CollectionCard, COLLECTION_PREVIEW_SELECT, type CollectionWithPreview } from '@/components/CollectionCard';
import { PillTabs, type PillTab } from '@/components/PillTabs';
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

  // Opening a different profile starts on its About tab, not whichever tab
  // was open on the previous profile
  useEffect(() => { setTab('about'); }, [targetId]);
  const dialogs = useDialogs();

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
        .select(`${COLLECTION_PREVIEW_SELECT}, owner:profiles(id, username, display_name, avatar_url)`)
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

      // Following / followers — use relationship-aware RPCs that enforce
      // profile_visibility, show_following/show_followers, and blocking
      type RpcRow = { follow_id: string; profile_id: string; username: string; display_name: string; avatar_url: string | null; created_at: string };
      const [fRes, frRes] = await Promise.all([
        supabase.rpc('get_visible_following', { p_target_user_id: targetId }),
        supabase.rpc('get_visible_followers', { p_target_user_id: targetId }),
      ]);
      const followingRows = (fRes.data as RpcRow[] | null) ?? [];
      const followerRows = (frRes.data as RpcRow[] | null) ?? [];

      const followingData: Follow[] = followingRows.map((r) => ({
        id: r.follow_id,
        follower_id: targetId,
        followee_id: r.profile_id,
        created_at: r.created_at,
        followee: { id: r.profile_id, username: r.username, display_name: r.display_name, avatar_url: r.avatar_url },
      }));
      const followersData: Follow[] = followerRows.map((r) => ({
        id: r.follow_id,
        follower_id: r.profile_id,
        followee_id: targetId,
        created_at: r.created_at,
        follower: { id: r.profile_id, username: r.username, display_name: r.display_name, avatar_url: r.avatar_url },
      }));

      setFollowing(followingData);
      setFollowers(followersData);

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
      if (!(await dialogs.confirm({ title: `Block ${profile.display_name}?`, message: "They won't be able to follow you or reply to your content. You can unblock them later in Settings.", confirmLabel: 'Block', danger: true }))) {
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

  type TabKey = typeof tab;
  const tabs: PillTab<TabKey>[] = [
    { key: 'about', label: 'About' },
    { key: 'gems', label: 'Gems', count: gems.length },
    { key: 'collections', label: 'Collections', count: collections.length },
    ...(isSelf ? [{ key: 'saved' as const, label: 'Saved', count: savedGems.length }] : []),
    { key: 'communities', label: 'Communities', count: communities.length },
    ...(showFollowingTab ? [{ key: 'following' as const, label: 'Following', count: following.length }] : []),
    ...(showFollowersTab ? [{ key: 'followers' as const, label: 'Followers', count: followers.length }] : []),
  ];
  const publishedCount = gems.filter((g) => g.status === 'published').length;

  const personRow = (id: string, p: { display_name?: string; username?: string; avatar_url?: string | null } | undefined) => (
    <button key={id} onClick={() => navigate(`/profile/${id}`)} className="card flex items-center gap-3 p-3 text-left transition-shadow hover:shadow-card-hover">
      <Avatar url={p?.avatar_url ?? null} name={p?.display_name ?? 'User'} size={44} />
      <div className="min-w-0">
        <p className="truncate font-semibold">{p?.display_name}</p>
        <p className="truncate text-sm text-stone-400">@{p?.username}</p>
      </div>
    </button>
  );

  return (
    <div className="space-y-6">
      {!isSelf && (
        <button onClick={() => window.history.back()} className="flex items-center gap-1 text-sm font-medium text-stone-500 hover:text-stone-800 dark:text-stone-400"><ArrowLeft className="h-4 w-4" /> Back</button>
      )}

      {/* Header */}
      <section className="relative overflow-hidden rounded-4xl bg-white shadow-card dark:bg-stone-900">
        <div className="h-28 bg-gem opacity-80 sm:h-36" aria-hidden />
        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-3 sm:-mt-14">
            <div className="rounded-full bg-white p-1.5 dark:bg-stone-900">
              <Avatar url={profile.avatar_url} name={profile.display_name} size={96} />
            </div>
            <div className="flex flex-wrap gap-2">
              {isSelf ? (
                <>
                  <button onClick={() => navigate('/settings')} className="btn-outline" aria-label="Settings"><Settings className="h-4 w-4" /><span className="hidden sm:inline">Settings</span></button>
                  <button onClick={() => navigate('/profile/edit')} className="btn-primary"><Pencil className="h-4 w-4" /> Edit profile</button>
                </>
              ) : canFollow ? (
                <button onClick={handleToggleFollow} disabled={followAction} className={isFollowing ? 'btn-outline' : 'btn-primary'}>
                  {followAction ? <LoadingSpinner size={16} /> : isFollowing ? <><UserCheck className="h-4 w-4" /> Following</> : <><UserPlus className="h-4 w-4" /> Follow</>}
                </button>
              ) : null}
              {!isSelf && (
                <>
                  <button onClick={() => setShowReport(true)} className="btn-outline px-3" title="Report" aria-label="Report this profile"><Flag className="h-4 w-4" /></button>
                  <button onClick={handleToggleBlock} disabled={blockAction} className="btn-outline px-3" title={isBlocked ? 'Unblock' : 'Block'} aria-label={isBlocked ? 'Unblock' : 'Block'}>
                    {blockAction ? <LoadingSpinner size={16} /> : <Ban className={`h-4 w-4 ${isBlocked ? 'text-error-500' : ''}`} />}
                  </button>
                </>
              )}
            </div>
          </div>

          <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight">{profile.display_name}</h1>
          <p className="text-stone-400">@{profile.username}</p>
          {profile.bio && <p className="mt-3 max-w-prose text-stone-700 dark:text-stone-300">{profile.bio}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-500 dark:text-stone-400">
            {showArea && profile.home_area && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {profile.home_area}</span>}
            <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Joined {joinDate}</span>
          </div>

          <div className="mt-5 grid max-w-md grid-cols-3 gap-2">
            {[
              { label: 'Gems', value: publishedCount, tab: 'gems' as const },
              { label: 'Followers', value: followers.length, tab: showFollowersTab ? ('followers' as const) : null },
              { label: 'Following', value: following.length, tab: showFollowingTab ? ('following' as const) : null },
            ].map((st) => (
              <button key={st.label} disabled={!st.tab} onClick={() => st.tab && setTab(st.tab)} className="rounded-2xl bg-stone-50 px-3 py-2.5 text-left transition-colors enabled:hover:bg-stone-100 dark:bg-stone-800/60 dark:enabled:hover:bg-stone-800">
                <span className="block font-display text-2xl font-extrabold">{st.value}</span>
                <span className="block text-xs font-medium text-stone-500 dark:text-stone-400">{st.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <PillTabs tabs={tabs} active={tab} onChange={setTab} label="Profile sections" />

      {tab === 'about' && (
        <div className="space-y-4">
          {interests.length > 0 && (
            <div className="card p-5 sm:p-6">
              <h2 className="mb-3 font-display text-lg font-bold">Into</h2>
              <div className="flex flex-wrap gap-2">
                {interests.map((i) => <span key={i.id} className="badge bg-primary-50 px-3 py-1 text-sm text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">{i.interest}</span>)}
              </div>
            </div>
          )}
          {interests.length === 0 && !profile.bio && (
            <EmptyState icon={<Users className="h-6 w-6" />} title="Nothing here yet" description={isSelf ? 'Add a bio and photo from Edit profile so people know who you are.' : "This person hasn't added details yet."} action={isSelf ? <button onClick={() => navigate('/profile/edit')} className="btn-primary">Edit profile</button> : undefined} />
          )}
        </div>
      )}

      {tab === 'gems' && (
        gems.length === 0 ? (
          <EmptyState icon={<Compass className="h-6 w-6" />} title="No gems yet" description={isSelf ? 'Share a place you love that most people walk past.' : "This person hasn't shared any gems yet."} action={isSelf ? <button onClick={() => navigate('/gems/new')} className="btn-primary">Add a gem</button> : undefined} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gems.map((g) => (
              <div key={g.id} className="relative">
                <GemCard gem={g} onOpen={() => navigate(`/gems/${g.id}`)} />
                {g.status === 'draft' && <span className="badge pointer-events-none absolute right-3 top-3 bg-citrine-400 text-stone-900">Draft</span>}
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'collections' && (
        collections.length === 0 ? (
          <EmptyState icon={<Layers className="h-6 w-6" />} title="No collections yet" description={isSelf ? 'Group gems into lists like "Rainy-day cafés" or "Sunset spots".' : "This person hasn't shared any collections."} action={isSelf ? <button onClick={() => navigate('/collections/new')} className="btn-primary">Create a collection</button> : undefined} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((c) => (
              <CollectionCard key={c.id} collection={c as CollectionWithPreview} showVisibility={isSelf} onOpen={() => navigate(`/collections/${c.id}`)} />
            ))}
          </div>
        )
      )}

      {tab === 'saved' && isSelf && (
        savedGems.length === 0 ? (
          <EmptyState icon={<Bookmark className="h-6 w-6" />} title="Nothing saved yet" description="Tap Save on any gem to keep it here for later." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {savedGems.map((g) => <GemCard key={g.id} gem={g} onOpen={() => navigate(`/gems/${g.id}`)} />)}
          </div>
        )
      )}

      {tab === 'communities' && (
        communities.length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="No communities yet" description={isSelf ? 'Join a community to start sharing gems.' : "This person hasn't joined any visible communities."} action={isSelf ? <button onClick={() => navigate('/communities')} className="btn-primary">Find a community</button> : undefined} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {communities.map((c) => (
              <button key={c.id} onClick={() => navigate(`/communities/${c.id}`)} className="card flex items-center gap-3 p-3 text-left transition-shadow hover:shadow-card-hover">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl">
                  {c.cover_image_url ? <img src={c.cover_image_url} alt="" className="h-full w-full object-cover" /> : <GemArt id={c.id} icon="users" className="h-full w-full" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="truncate text-sm text-stone-400">{c.general_area ?? (c.visibility === 'private' ? 'Private community' : 'Community')}</p>
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {tab === 'following' && showFollowingTab && (
        following.length === 0 ? (
          <EmptyState icon={<UserCheck className="h-6 w-6" />} title="Not following anyone yet" description={isSelf ? 'Follow people whose finds you like, and their gems show up in your Following feed.' : "This person isn't following anyone."} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">{following.map((f) => personRow(f.followee_id, f.followee ?? undefined))}</div>
        )
      )}

      {tab === 'followers' && showFollowersTab && (
        followers.length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="No followers yet" description={isSelf ? 'Share a few great gems and people will start following you.' : "This person doesn't have followers yet."} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">{followers.map((f) => personRow(f.follower_id, f.follower ?? undefined))}</div>
        )
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
