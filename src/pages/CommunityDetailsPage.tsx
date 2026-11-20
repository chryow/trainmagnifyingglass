import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useDialogs } from '@/components/Dialogs';
import { useAuth } from '@/lib/auth';
import { useNavigate, useRoute, matchPath } from '@/lib/router';
import { Avatar, PageHeader } from '@/components/Avatar';
import { EmptyState, ErrorState, LoadingSpinner } from '@/components/States';
import { GemCard, GemArt } from '@/components/GemCard';
import { PillTabs } from '@/components/PillTabs';
import type { Community, CommunityMember, Profile, CommunityType, Gem } from '@/types/database';
import { MapPin, Lock, Globe, Users, ArrowLeft, LogIn, LogOut, Shield, KeyRound, Plus, Sparkles, Settings as SettingsIcon, Archive } from 'lucide-react';

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
  const [actioningMember, setActioningMember] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [section, setSection] = useState<'gems' | 'members' | 'guidelines'>('gems');
  const dialogs = useDialogs();
  const [joinError, setJoinError] = useState<string | null>(null);
  const [gems, setGems] = useState<Gem[]>([]);

  const load = useCallback(async () => {
    if (!communityId || communityId === 'new' || !profile) return;
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
      // Invitees can't read invitations or insert into private communities
      // directly (RLS), so redeem the code server-side.
      const { data, error: rpcErr } = await supabase.rpc('redeem_invitation', { p_code: joinCode.trim() });
      const res = data as { success?: boolean; error?: string } | null;
      if (rpcErr || !res?.success) {
        setJoining(false);
        setJoinError(res?.error ?? rpcErr?.message ?? 'Could not join with that code.');
        return;
      }
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
    if (!(await dialogs.confirm({ title: 'Leave this community?', message: community.visibility === 'public' ? 'You can rejoin any time.' : "It's private, so you'll need a new invite code to rejoin.", confirmLabel: 'Leave', danger: true }))) return;
    setLeaving(true);
    const { error: leaveErr } = await supabase.from('community_members').delete().eq('community_id', community.id).eq('user_id', profile.id);
    setLeaving(false);
    if (leaveErr) { setJoinError(leaveErr.message); return; }
    await load();
  };

  const handleToggleModerator = async (member: CommunityMember) => {
    if (!isOwner || actioningMember) return;
    const newRole = member.role === 'moderator' ? 'member' : 'moderator';
    setActioningMember(member.id);
    await supabase.from('community_members').update({ role: newRole }).eq('id', member.id);
    setActioningMember(null);
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

      {(!community.is_active) && (
        <div className="card flex items-center gap-3 border-citrine-300 p-4 dark:border-citrine-700">
          <Archive className="h-5 w-5 shrink-0 text-citrine-500" />
          <div>
            <p className="text-sm font-medium">This community is archived</p>
            <p className="text-xs text-stone-500">Content is preserved but new activity is limited. {isOwner && 'You can restore it from the Edit page.'}</p>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="overflow-hidden rounded-4xl bg-white shadow-card dark:bg-stone-900">
        <div className="relative h-48 sm:h-64">
          {community.cover_image_url
            ? <img src={community.cover_image_url} alt="" className="h-full w-full object-cover" />
            : <GemArt id={community.id} icon="users" className="h-full w-full" />}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="badge bg-white/20 text-white backdrop-blur">{typeLabel(community.community_type)}</span>
              <span className="badge bg-white/20 text-white backdrop-blur">
                {community.visibility === 'private' ? <><Lock className="h-3 w-3" /> Private</> : <><Globe className="h-3 w-3" /> Public</>}
              </span>
              {!community.is_active && <span className="badge bg-white/90 text-stone-800">Archived</span>}
            </div>
            <h1 className="break-words font-display text-3xl font-extrabold leading-tight sm:text-4xl">{community.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 text-sm text-white/85">
              <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {members.length} member{members.length !== 1 ? 's' : ''}</span>
              {community.general_area && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {community.general_area}</span>}
            </p>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-7">
          {community.description && <p className="max-w-prose break-words text-stone-700 dark:text-stone-300">{community.description}</p>}

          <div className="flex flex-wrap gap-2">
            {isMember && community.is_active && (
              <button onClick={() => navigate(`/gems/new?community=${community.id}`)} className="btn-primary"><Plus className="h-4 w-4" /> Add a gem</button>
            )}
            {!isMember && !isPrivate && community.is_active && (
              <button onClick={handleJoin} disabled={joining} className="btn-primary">
                {joining ? <LoadingSpinner size={16} /> : <><LogIn className="h-4 w-4" /> Join community</>}
              </button>
            )}
            {isOwner && (
              <>
                <button onClick={() => navigate(`/communities/${community.id}/edit`)} className="btn-outline"><SettingsIcon className="h-4 w-4" /> Edit</button>
                <button onClick={() => setShowInvite((s) => !s)} className="btn-outline" aria-expanded={showInvite}><KeyRound className="h-4 w-4" /> Invite</button>
              </>
            )}
            {(isOwner || myMembership?.role === 'moderator') && (
              <button onClick={() => navigate(`/moderation/${community.id}`)} className="btn-outline"><Shield className="h-4 w-4" /> Moderation</button>
            )}
            {isMember && !isOwner && (
              <button onClick={handleLeave} disabled={leaving} className="btn-ghost text-stone-500">
                {leaving ? <LoadingSpinner size={16} /> : <><LogOut className="h-4 w-4" /> Leave</>}
              </button>
            )}
          </div>

          {!isMember && isPrivate && community.is_active && (
            <div className="space-y-2 rounded-3xl bg-stone-50 p-4 dark:bg-stone-800/50">
              <p className="text-sm font-semibold">This community is invite-only</p>
              <div className="flex gap-2">
                <input className="input bg-white dark:bg-stone-900" placeholder="Invite code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
                <button onClick={handleJoin} disabled={joining || !joinCode.trim()} className="btn-primary shrink-0">
                  {joining ? <LoadingSpinner size={16} /> : 'Join'}
                </button>
              </div>
            </div>
          )}

          {joinError && <div role="alert" className="rounded-2xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/40 dark:text-error-400">{joinError}</div>}

          {showInvite && isOwner && (
            <div className="rounded-3xl bg-stone-50 p-4 dark:bg-stone-800/50">
              <h3 className="font-semibold">Invite someone</h3>
              <p className="mt-1 text-sm text-stone-500">Each code works once. Send it to the person you want to invite; they enter it on the Communities page.</p>
              <button onClick={handleCreateInvite} className="btn-secondary mt-3 bg-white dark:bg-stone-900"><Plus className="h-4 w-4" /> New invite code</button>
              {inviteCode && (
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 rounded-2xl bg-white px-4 py-2.5 font-mono text-sm dark:bg-stone-900">{inviteCode}</code>
                  <button onClick={() => { void navigator.clipboard?.writeText(inviteCode); dialogs.toast('Invite code copied', 'success'); }} className="btn-outline">Copy</button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <PillTabs
        label="Community sections"
        active={section}
        onChange={setSection}
        tabs={[
          { key: 'gems', label: 'Gems', count: gems.length },
          { key: 'members', label: 'Members', count: members.length },
          ...(community.guidelines ? [{ key: 'guidelines' as const, label: 'Guidelines' }] : []),
        ]}
      />

      {section === 'gems' && (
        gems.length === 0 ? (
          <EmptyState
            icon={<Plus className="h-6 w-6" />}
            title="No gems yet"
            description={!community.is_active ? 'This community is archived, so new gems can’t be added.' : isMember ? 'Be the first to share a place with this community.' : 'Gems appear here once members start sharing.'}
            action={isMember && community.is_active ? <button onClick={() => navigate(`/gems/new?community=${community.id}`)} className="btn-primary">Add the first gem</button> : undefined}
          />
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

      {section === 'members' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {members.map((m) => (
            <div key={m.id} className="card flex items-center gap-3 p-3">
              <button onClick={() => navigate(`/profile/${m.user_id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <Avatar url={m.profile?.avatar_url ?? null} name={m.profile?.display_name ?? 'User'} size={44} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{m.profile?.display_name}</p>
                  <p className="truncate text-sm text-stone-400">
                    @{m.profile?.username}
                    {m.user_id === community.owner_id ? ' · Owner' : m.role === 'moderator' ? ' · Moderator' : ''}
                  </p>
                </div>
              </button>
              {isOwner && m.user_id !== profile?.id && (
                <button
                  onClick={() => handleToggleModerator(m)}
                  disabled={actioningMember === m.id}
                  className="btn-outline shrink-0 px-3 py-1.5 text-xs"
                >
                  {actioningMember === m.id ? <LoadingSpinner size={14} /> : m.role === 'moderator' ? 'Remove mod' : 'Make mod'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {section === 'guidelines' && community.guidelines && (
        <div className="card p-5 sm:p-7">
          <p className="max-w-prose whitespace-pre-line leading-relaxed text-stone-700 dark:text-stone-300">{community.guidelines}</p>
        </div>
      )}
    </div>
  );
}

function typeLabel(type: CommunityType) {
  return type === 'location_based' ? 'Location' : type === 'interest_based' ? 'Interest' : 'Private group';
}

