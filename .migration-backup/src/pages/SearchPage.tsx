import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate, useRoute } from '@/lib/router';
import { PageHeader } from '@/components/Avatar';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/States';
import type { Gem, Category } from '@/types/database';
import { Search, MapPin, Filter, X, Sparkles } from 'lucide-react';

export default function SearchPage() {
  const route = useRoute();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const initialQuery = route.params.q ?? '';

  const [query, setQuery] = useState(initialQuery);
  const [categories, setCategories] = useState<Category[]>([]);
  const [gems, setGems] = useState<Gem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [areaFilter, setAreaFilter] = useState<string>('');
  const [sort, setSort] = useState<'recent' | 'title'>('recent');

  useEffect(() => {
    supabase.from('categories').select('*').order('sort_order').then(({ data }) => {
      setCategories((data as Category[] | null) ?? []);
    });
  }, []);

  const search = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(false);
    try {
      let q = supabase
        .from('gems')
        .select('*, author:profiles(id, username, display_name, avatar_url), community:communities(id, name, visibility), category:categories(id, name, slug, icon)')
        .eq('status', 'published');

      if (query.trim()) {
        q = q.or(`title.ilike.%${query.trim()}%,place_name.ilike.%${query.trim()}%,description.ilike.%${query.trim()}%,area.ilike.%${query.trim()}%`);
      }
      if (categoryFilter) {
        q = q.eq('category_id', categoryFilter);
      }
      if (areaFilter.trim()) {
        q = q.ilike('area', `%${areaFilter.trim()}%`);
      }

      if (sort === 'recent') q = q.order('created_at', { ascending: false });
      else q = q.order('title', { ascending: true });

      const { data, error: sErr } = await q.limit(50);
      if (sErr) { setError(true); return; }
      setGems((data as Gem[] | null) ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [profile, query, categoryFilter, areaFilter, sort]);

  useEffect(() => { search(); }, [search]);

  const hasFilters = !!categoryFilter || !!areaFilter.trim();
  const clearFilters = () => { setCategoryFilter(''); setAreaFilter(''); };

  return (
    <div className="space-y-6">
      <PageHeader title="Search" subtitle="Find hidden gems across all your communities." />

      {/* Search bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <input
          type="search"
          className="input pl-11"
          placeholder="Search by name, place, or area…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
        />
      </div>

      {/* Filter toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setShowFilters((s) => !s)} className="btn-outline">
          <Filter className="h-4 w-4" /> Filters
          {hasFilters && <span className="ml-1 rounded-full bg-primary-600 px-1.5 text-[10px] text-white">{[categoryFilter, areaFilter].filter(Boolean).length}</span>}
        </button>
        {hasFilters && <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400"><X className="h-3.5 w-3.5" /> Clear</button>}
        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm text-stone-500 dark:text-stone-400">Sort:</label>
          <select className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900" value={sort} onChange={(e) => setSort(e.target.value as 'recent' | 'title')}>
            <option value="recent">Most recent</option>
            <option value="title">A–Z</option>
          </select>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card space-y-4 p-5">
          <div>
            <label className="label">Category</label>
            <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Area</label>
            <input className="input" placeholder="e.g. Kemang, Bali…" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} />
          </div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : error ? (
        <ErrorState description="Search failed. Please try again." onRetry={search} />
      ) : gems.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="No gems found"
          description={query || hasFilters ? "Try a different search or adjust your filters." : "Published gems will appear here once people start sharing."}
          action={!query && !hasFilters ? <button onClick={() => navigate('/gems/new')} className="btn-primary">Share a gem</button> : undefined}
        />
      ) : (
        <>
          <p className="text-sm text-stone-500 dark:text-stone-400">{gems.length} result{gems.length !== 1 ? 's' : ''}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {gems.map((g) => (
              <button key={g.id} onClick={() => navigate(`/gems/${g.id}`)} className="card overflow-hidden text-left transition-shadow hover:shadow-card-hover">
                {g.cover_image_url ? (
                  <img src={g.cover_image_url} alt={g.title} className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 items-center justify-center bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900/30 dark:to-accent-900/30">
                    <Sparkles className="h-8 w-8 text-primary-400" />
                  </div>
                )}
                <div className="p-4">
                  <div className="mb-1.5 flex items-center gap-2">
                    {g.category && <span className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{g.category.name}</span>}
                    <span className="text-xs text-stone-400">{g.community?.name}</span>
                  </div>
                  <h3 className="font-display text-base font-semibold">{g.title}</h3>
                  <p className="mt-1 flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400"><MapPin className="h-3.5 w-3.5" /> {g.place_name}{g.area ? `, ${g.area}` : ''}</p>
                  {g.description && <p className="mt-1.5 line-clamp-2 text-sm text-stone-500 dark:text-stone-400">{g.description}</p>}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
