import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate } from '@/lib/router';
import { Avatar, PageHeader } from '@/components/Avatar';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/States';
import type { Community, CommunityType } from '@/types/database';
import { Users, MapPin, Lock, Globe, Plus, Search } from 'lucide-react';

export default function CommunitiesPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'discover' | 'mine'>('discover');

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(false);
    try {
      const [publicRes, mineRes] = await Promise.all([
        supabase.from('communities').select('*').eq('visibility', 'public').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('community_members').select('community:communities(*)').eq('user_id', profile.id),
      ]);
      setCommunities((publicRes.data as Community[] | null) ?? []);
      const mine = (mineRes.data as { community: Community }[] | null) ?? [];
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

      <div className="flex gap-2">
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
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((c) => (
            <button key={c.id} onClick={() => navigate(`/communities/${c.id}`)} className="card overflow-hidden text-left transition-shadow hover:shadow-card-hover">
              <div className="h-28 bg-gradient-to-br from-primary-300 to-accent-400">
                {c.cover_image_url && <img src={c.cover_image_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="p-4">
                <div className="mb-1.5 flex items-center gap-2">
                  <TypeBadge type={c.community_type} />
                  <VisibilityBadge visibility={c.visibility} />
                  {c.general_area && <span className="flex items-center gap-1 text-xs text-stone-400"><MapPin className="h-3 w-3" />{c.general_area}</span>}
                </div>
                <h3 className="font-display text-base font-semibold">{c.name}</h3>
                {c.description && <p className="mt-1 line-clamp-2 text-sm text-stone-500 dark:text-stone-400">{c.description}</p>}
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
    <button onClick={onClick} className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${active ? 'bg-primary-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300'}`}>
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
    <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><Lock className="h-3 w-3" /> Private</span>
  ) : (
    <span className="badge bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300"><Globe className="h-3 w-3" /> Public</span>
  );
}
