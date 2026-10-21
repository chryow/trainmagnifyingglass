import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate } from '@/lib/router';
import { PageHeader } from '@/components/Avatar';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/States';
import type { Collection, CollectionVisibility } from '@/types/database';
import { Plus, Layers, Lock, Globe, Users, Search } from 'lucide-react';

export default function CollectionsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<'mine' | 'discover'>('mine');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(false);
    try {
      const { data, error: err } = await supabase
        .from('collections')
        .select('*, owner:profiles(id, username, display_name, avatar_url)')
        .order('updated_at', { ascending: false });
      if (err) { setError(true); return; }
      setCollections((data as Collection[] | null) ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const mine = collections.filter((c) => c.owner_id === profile?.id);
  const discover = collections.filter((c) => c.owner_id !== profile?.id);
  const list = (tab === 'mine' ? mine : discover).filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.description ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collections"
        subtitle="Curate gems into themed lists."
        action={<button onClick={() => navigate('/collections/new')} className="btn-primary"><Plus className="h-4 w-4" /> New</button>}
      />

      <div className="flex gap-2">
        <TabBtn active={tab === 'mine'} onClick={() => setTab('mine')}>My collections ({mine.length})</TabBtn>
        <TabBtn active={tab === 'discover'} onClick={() => setTab('discover')}>Discover</TabBtn>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <input type="search" className="input pl-11" placeholder="Search collections…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : error ? (
        <ErrorState description="Couldn't load collections." onRetry={load} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-6 w-6" />}
          title={tab === 'mine' ? "You haven't created any collections" : 'No collections found'}
          description={tab === 'mine' ? 'Create a collection to organize your favorite gems.' : 'Try a different search.'}
          action={tab === 'mine' ? <button onClick={() => navigate('/collections/new')} className="btn-primary">Create collection</button> : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((c) => (
            <button key={c.id} onClick={() => navigate(`/collections/${c.id}`)} className="card overflow-hidden text-left transition-shadow hover:shadow-card-hover">
              <div className="h-28 bg-gradient-to-br from-primary-300 to-accent-400">
                {c.cover_image_url && <img src={c.cover_image_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="p-4">
                <div className="mb-1.5 flex items-center gap-2">
                  <VisibilityBadge visibility={c.visibility} />
                </div>
                <h3 className="font-display text-base font-semibold">{c.name}</h3>
                {c.description && <p className="mt-1 line-clamp-2 text-sm text-stone-500 dark:text-stone-400">{c.description}</p>}
                {tab === 'discover' && c.owner && (
                  <p className="mt-2 text-xs text-stone-400">by {c.owner.display_name}</p>
                )}
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

function VisibilityBadge({ visibility }: { visibility: CollectionVisibility }) {
  if (visibility === 'public') return <span className="badge bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300"><Globe className="h-3 w-3" /> Public</span>;
  if (visibility === 'followers') return <span className="badge bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"><Users className="h-3 w-3" /> Followers</span>;
  return <span className="badge bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300"><Lock className="h-3 w-3" /> Private</span>;
}
