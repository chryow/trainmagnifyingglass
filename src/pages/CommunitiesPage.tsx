import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate } from '@/lib/router';
import { Avatar, PageHeader } from '@/components/Avatar';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/States';
import { GemArt } from '@/components/GemCard';
import type { Community, CommunityType } from '@/types/database';
import { Users, MapPin, Lock, Globe, Plus, Search, KeyRound } from 'lucide-react';

export default function CommunitiesPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'discover' | 'mine'>('discover');
  const [inviteCode, setInviteCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Private communities are invisible to non-members, so invite codes are
  // redeemed from here rather than from the community page.
  const redeem = async () => {
    if (!inviteCode.trim() || redeeming) return;
    setRedeeming(true);
    setInviteError(null);
    const { data, error: rpcErr } = await supabase.rpc('redeem_invitation', { p_code: inviteCode.trim() });
    setRedeeming(false);
    const res = data as { success?: boolean; error?: string; community_id?: string } | null;
    if (rpcErr || !res?.success || !res.community_id) {
      setInviteError(res?.error ?? rpcErr?.message ?? 'Could not join with that code.');
      return;
    }
    navigate(`/communities/${res.community_id}`);
  };

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(false);
    try {
      const [publicRes, mineRes] = await Promise.all([
        supabase.from('communities').select('*').eq('visibility', 'public').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('community_members').select('community:communities(*)').eq('user_id', profile.id),
      ]);
      if (publicRes.error || mineRes.error) throw publicRes.error ?? mineRes.error;
      setCommunities((publicRes.data as Community[] | null) ?? []);
      const mine = (mineRes.data as unknown as { community: Community }[] | null) ?? [];
      setMyCommunities(mine.map((m) => m.community).filter(Boolean));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const filtered = (tab === 'discover' ? communities : myCommunities).filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.general_area ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communities"
        subtitle="Find groups exploring places and interests together."
        action={<button onClick={() => navigate('/communities/new')} className="btn-primary"><Plus className="h-4 w-4" /> New</button>}
      />

      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-3 sm:flex-1">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gem text-white"><KeyRound className="h-5 w-5" /></span>
          <div>
            <p className="text-sm font-semibold">Have an invite code?</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">Join a private community.</p>
          </div>
        </div>
        <div className="flex gap-2 sm:w-80">
          <input className="input" placeholder="Invite code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void redeem(); }} />
          <button onClick={redeem} disabled={redeeming || !inviteCode.trim()} className="btn-primary shrink-0">{redeeming ? '…' : 'Join'}</button>
        </div>
        {inviteError && <p role="alert" className="text-sm text-error-600 dark:text-error-400 sm:basis-full">{inviteError}</p>}
      </div>

      <div role="tablist" aria-label="Communities" className="flex gap-2">
        <TabBtn active={tab === 'discover'} onClick={() => setTab('discover')}>Discover</TabBtn>
        <TabBtn active={tab === 'mine'} onClick={() => setTab('mine')}>My communities ({myCommunities.length})</TabBtn>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <input type="search" className="input pl-11" placeholder="Search communities…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : error ? (
        <ErrorState description="Couldn't load communities." onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={tab === 'mine' ? "You haven't joined any communities" : 'No communities found'}
          description={tab === 'mine' ? 'Discover public communities to join, or start your own.' : 'Try a different search or create a new community.'}
          action={tab === 'mine' ? <button onClick={() => setTab('discover')} className="btn-primary">Browse communities</button> : <button onClick={() => navigate('/communities/new')} className="btn-primary">Create community</button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <button key={c.id} onClick={() => navigate(`/communities/${c.id}`)} className="card flex flex-col overflow-hidden text-left transition-shadow hover:shadow-card-hover">
              <div className="h-32 shrink-0">
                {c.cover_image_url
                  ? <img src={c.cover_image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  : <GemArt id={c.id} icon="users" className="h-full w-full" />}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <TypeBadge type={c.community_type} />
                  <VisibilityBadge visibility={c.visibility} />
                  {c.general_area && <span className="flex items-center gap-1 text-xs text-stone-400"><MapPin className="h-3 w-3" />{c.general_area}</span>}
                </div>
                <h3 className="break-words font-display text-lg font-bold">{c.name}</h3>
                {c.description && <p className="mt-1 line-clamp-2 break-words text-sm text-stone-500 dark:text-stone-400">{c.description}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button role="tab" aria-selected={active} onClick={onClick} className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${active ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' : 'bg-white text-stone-600 shadow-card hover:text-stone-900 dark:bg-stone-900 dark:text-stone-300'}`}>
      {children}
    </button>
  );
}
function TypeBadge({ type }: { type: CommunityType }) {
  const label = type === 'location_based' ? 'Location' : type === 'interest_based' ? 'Interest' : 'Group';
  return <span className="badge bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">{label}</span>;
}
function VisibilityBadge({ visibility }: { visibility: string }) {
  return visibility === 'private' ? (
    <span className="badge bg-citrine-100 text-citrine-700 dark:bg-citrine-500/15 dark:text-citrine-300"><Lock className="h-3 w-3" /> Private</span>
  ) : (
    <span className="badge bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300"><Globe className="h-3 w-3" /> Public</span>
  );
}
