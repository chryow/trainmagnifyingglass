import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate, useRoute, matchPath } from '@/lib/router';
import { Avatar, PageHeader } from '@/components/Avatar';
import { EmptyState, ErrorState, LoadingSpinner } from '@/components/States';
import type { Community, CommunityMember, Profile, CommunityType, Gem } from '@/types/database';
import { MapPin, Lock, Globe, Users, ArrowLeft, LogIn, LogOut, Shield, KeyRound, Plus, Sparkles } from 'lucide-react';

export default function CommunityDetailsPage() {
  const route = useRoute();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const match = matchPath('/communities/:id', route.path);
  const communityId = match?.id ?? '';

  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<(CommunityMember & { profile: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> })[]>([]);
  const [myMembership, setMyMembership] = useState<CommunityMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [gems, setGems] = useState<Gem[]>([]);

  const load = useCallback(async () => {
    if (!communityId || !profile) return;
    setLoading(true);
    setError(false);
    try {
      const { data: c, error: cErr } = await supabase.from('communities').select('*').eq('id', communityId).maybeSingle();
      if (cErr || !c) { setError(true); return; }
      setCommunity(c as Community);

      const { data: mData } = await supabase
        .from('community_members')
        .select('*, profile:profiles(id, username, display_name, avatar_url)')
        .eq('community_id', communityId)
        .order('joined_at', { ascending: true });
      setMembers((mData as (CommunityMember & { profile: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> })[] | null) ?? []);

      const { data: mine } = await supabase.from('community_members').select('*').eq('community_id', communityId).eq('user_id', profile.id).maybeSingle();
      setMyMembership((mine as CommunityMember | null) ?? null);

      const { data: gData } = await supabase
        .from('gems')
        .select('*, author:profiles(id, username, display_name, avatar_url), community:communities(id, name, visibility), category:categories(id, name, slug, icon)')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false });
      setGems((gData as Gem[] | null) ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [communityId, profile]);

  useEffect(() => { load(); }, [load]);

  const isMember = !!myMembership;
  const isOwner = community?.owner_id === profile?.id;
  const isPrivate = community?.visibility === 'private';

  const handleJoin = async () => {
    if (!profile || !community) return;
    setJoining(true);
    setJoinError(null);
    if (isPrivate) {
      // Validate invite code
      const { data: inv, error: invErr } = await supabase
        .from('community_invitations')
        .select('*')
        .eq('code', joinCode.trim())
        .eq('community_id', community.id)
        .is('used_by', null)
        .maybeSingle();
      if (invErr || !inv) {
        setJoining(false);
        setJoinError('Invalid or already-used invitation code.');
        return;
      }
      if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
        setJoining(false);
        setJoinError('This invitation has expired.');
        return;
      }
      const { error: joinErr } = await supabase.from('community_members').insert({ community_id: community.id, user_id: profile.id });
      if (joinErr) { setJoining(false); setJoinError(joinErr.message); return; }
      await supabase.from('community_invitations').update({ used_by: profile.id, used_at: new Date().toISOString() }).eq('id', inv.id);
    } else {
      const { error: joinErr } = await supabase.from('community_members').insert({ community_id: community.id, user_id: profile.id });
      if (joinErr) { setJoining(false); setJoinError(joinErr.message); return; }
    }
    setJoining(false);
    setJoinCode('');
    await load();
  };

  const handleLeave = async () => {
    if (!profile || !community) return;
    if (!confirm("Leave this community? You can rejoin later if it's public.")) return;
    setLeaving(true);
    const { error: leaveErr } = await supabase.from('community_members').delete().eq('community_id', community.id).eq('user_id', profile.id);
    setLeaving(false);
    if (leaveErr) { setJoinError(leaveErr.message); return; }
    await load();
  };

  const handleCreateInvite = async () => {
    if (!profile || !community) return;
    const { data, error: invErr } = await supabase
      .from('community_invitations')
      .insert({ community_id: community.id, created_by: profile.id })
      .select('code')
      .single();
    if (invErr || !data) { setJoinError(invErr?.message ?? 'Failed to create invite'); return; }
    setInviteCode(data.code);
  };

  if (loading) {
    return (
      <div>
        <button onClick={() => navigate('/communities')} className="mb-4 flex items-center gap-1 text-sm text-stone-500"><ArrowLeft className="h-4 w-4" /> Communities</button>
        <div className="flex items-center gap-3 py-16"><LoadingSpinner className="text-primary-500" /> <span className="text-stone-500">Loading community…</span></div>
      </div>
    );
  }

  if (error || !community) {
    return (
      <div>
        <button onClick={() => navigate('/communities')} className="mb-4 flex items-center gap-1 text-sm text-stone-500"><ArrowLeft className="h-4 w-4" /> Communities</button>
        <ErrorState title="Community not found" description="This community may not exist or you don't have access." onRetry={() => navigate('/communities')} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/communities')} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400"><ArrowLeft className="h-4 w-4" /> Communities</button>

      {/* Cover + header */}
      <div className="card overflow-hidden">
        <div className="h-40 bg-gradient-to-br from-primary-400 to-accent-500 sm:h-52">
          {community.cover_image_url && <img src={community.cover_image_url} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="p-5 sm:p-6">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <TypeBadge type={community.community_type} />
            <VisibilityBadge visibility={community.visibility} />
            {community.general_area && <span className="flex items-center gap-1 text-xs text-stone-400"><MapPin className="h-3 w-3" />{community.general_area}</span>}
            {!community.is_active && <span className="badge bg-stone-200 text-stone-600">Archived</span>}
          </div>
          <h1 className="font-display text-2xl font-semibold">{community.name}</h1>
          {community.description && <p className="mt-2 text-stone-600 dark:text-stone-300">{community.description}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-stone-500"><Users className="h-4 w-4" /> {members.length} member{members.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Actions */}
          <div className="mt-5 flex flex-wrap gap-2">
            {!isMember && !isPrivate && (
              <button onClick={handleJoin} disabled={joining} className="btn-primary">
                {joining ? <LoadingSpinner size={16} /> : <><LogIn className="h-4 w-4" /> Join community</>}
              </button>
            )}
            {!isMember && isPrivate && (
              <div className="w-full space-y-2">
                <div className="flex gap-2">
                  <input className="input" placeholder="Invitation code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
                  <button onClick={handleJoin} disabled={joining || !joinCode.trim()} className="btn-primary shrink-0">
                    {joining ? <LoadingSpinner size={16} /> : 'Join'}
                  </button>
                </div>
                <p className="text-xs text-stone-400">This is a private community. Enter an invitation code to join.</p>
              </div>
            )}
            {isMember && !isOwner && (
              <button onClick={handleLeave} disabled={leaving} className="btn-outline">
                {leaving ? <LoadingSpinner size={16} /> : <><LogOut className="h-4 w-4" /> Leave community</>}
              </button>
            )}
            {isOwner && (
              <>
                <span className="badge bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"><Shield className="h-3 w-3" /> Owner</span>
                <button onClick={() => setShowInvite((s) => !s)} className="btn-outline"><KeyRound className="h-4 w-4" /> Invite</button>
                <button onClick={() => navigate(`/moderation/${community.id}`)} className="btn-outline"><Shield className="h-4 w-4" /> Moderation</button>
              </>
            )}
            {myMembership?.role === 'moderator' && !isOwner && (
              <button onClick={() => navigate(`/moderation/${community.id}`)} className="btn-outline"><Shield className="h-4 w-4" /> Moderation</button>
            )}
            {isMember && (
              <button onClick={() => navigate(`/gems/new?community=${community.id}`)} className="btn-secondary"><Plus className="h-4 w-4" /> Add a gem</button>
            )}
          </div>

          {joinError && <div role="alert" className="mt-3 rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/40 dark:text-error-400">{joinError}</div>}

          {/* Invite panel */}
          {showInvite && isOwner && (
            <div className="mt-4 rounded-xl bg-stone-50 p-4 dark:bg-stone-800/50">
              <h3 className="text-sm font-semibold">Invitation codes</h3>
              <p className="mt-1 text-xs text-stone-500">Share a single-use code with someone to let them join this private community.</p>
              <button onClick={handleCreateInvite} className="btn-secondary mt-3"><Plus className="h-4 w-4" /> Generate code</button>
              {inviteCode && (
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-white px-3 py-2 font-mono text-sm dark:bg-stone-900">{inviteCode}</code>
                  <button onClick={() => { void navigator.clipboard?.writeText(inviteCode); }} className="btn-ghost">Copy</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Guidelines */}
      {community.guidelines && (
        <div className="card p-5">
          <h2 className="mb-2 font-display text-lg font-semibold">Community guidelines</h2>
          <p className="whitespace-pre-line text-sm text-stone-600 dark:text-stone-300">{community.guidelines}</p>
        </div>
      )}

      {/* Members */}
      <div className="card p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">Members ({members.length})</h2>
        {members.length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="No members yet" description="Be the first to join this community." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {members.map((m) => (
              <button key={m.id} onClick={() => navigate(`/profile/${m.user_id}`)} className="flex items-center gap-3 rounded-xl p-2 text-left hover:bg-stone-50 dark:hover:bg-stone-800">
                <Avatar url={m.profile?.avatar_url ?? null} name={m.profile?.display_name ?? 'User'} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.profile?.display_name}</p>
                  <p className="truncate text-xs text-stone-400">@{m.profile?.username}</p>
                </div>
                {m.role === 'moderator' && <span className="ml-auto badge bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"><Shield className="h-3 w-3" /> Mod</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Gems in this community */}
      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Hidden gems ({gems.length})</h2>
          {isMember && (
            <button onClick={() => navigate(`/gems/new?community=${community.id}`)} className="btn-secondary text-sm"><Plus className="h-4 w-4" /> Add a gem</button>
          )}
        </div>
        {gems.length === 0 ? (
          <EmptyState icon={<Plus className="h-6 w-6" />} title="No gems yet" description={isMember ? "Share the first hidden gem in this community." : "Gems will appear here once members start sharing."} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {gems.map((g) => (
              <button key={g.id} onClick={() => navigate(`/gems/${g.id}`)} className="card overflow-hidden text-left transition-shadow hover:shadow-card-hover">
                {g.cover_image_url ? (
                  <img src={g.cover_image_url} alt={g.title} className="h-32 w-full object-cover" />
                ) : (
                  <div className="flex h-32 items-center justify-center bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900/30 dark:to-accent-900/30">
                    <Sparkles className="h-6 w-6 text-primary-400" />
                  </div>
                )}
                <div className="p-4">
                  <div className="mb-1 flex items-center gap-2">
                    {g.category && <span className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{g.category.name}</span>}
                    {g.status === 'draft' && <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Draft</span>}
                  </div>
                  <h3 className="font-display text-base font-semibold">{g.title}</h3>
                  <p className="mt-1 flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400"><MapPin className="h-3.5 w-3.5" /> {g.place_name}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: CommunityType }) {
  const label = type === 'location_based' ? 'Location-Based' : type === 'interest_based' ? 'Interest-Based' : 'Private Group';
  return <span className="badge bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">{label}</span>;
}
function VisibilityBadge({ visibility }: { visibility: string }) {
  return visibility === 'private' ? (
    <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><Lock className="h-3 w-3" /> Private</span>
  ) : (
    <span className="badge bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300"><Globe className="h-3 w-3" /> Public</span>
  );
}
