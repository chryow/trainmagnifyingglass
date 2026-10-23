import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate, useRoute } from '@/lib/router';
import { PageHeader } from '@/components/Avatar';
import { EmptyState, ErrorState, LoadingSpinner, SkeletonCard } from '@/components/States';
import type { Gem, Category, Community, VerificationStatus } from '@/types/database';
import { VERIFICATION_STATUS_LABELS } from '@/types/database';
import { Search, MapPin, Sparkles, Filter, X, RotateCcw, Globe, Lock } from 'lucide-react';

type SortMode = 'recent' | 'confirmed';

interface Filters {
  search: string;
  categoryId: string;
  communityId: string;
  area: string;
  verification: string;
  sort: SortMode;
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  categoryId: '',
  communityId: '',
  area: '',
  verification: '',
  sort: 'recent',
};

const PAGE_SIZE = 24;

export default function ExplorePage() {
  const route = useRoute();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [gems, setGems] = useState<Gem[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [filters, setFilters] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    categoryId: route.params.category ?? '',
  }));

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [catsRes, commsRes] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('communities').select('id, name, visibility, is_active').eq('is_active', true).order('name'),
      ]);
      setCategories((catsRes.data as Category[] | null) ?? []);
      const comms = (commsRes.data as Community[] | null) ?? [];
      setCommunities(comms);
      setFilters((prev) => {
        if (prev.communityId && !comms.some((c) => c.id === prev.communityId)) {
          return { ...prev, communityId: '' };
        }
        return prev;
      });
      await loadGems(0, true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadGems = async (pageNum: number, reset: boolean) => {
    let query = supabase
      .from('gems')
      .select('*, author:profiles(id, username, display_name, avatar_url), community:communities(id, name, visibility), category:categories(id, name, slug, icon)')
      .eq('status', 'published');

    if (filters.search.trim()) {
      query = query.or(`title.ilike.%${filters.search.trim()}%,place_name.ilike.%${filters.search.trim()}%,description.ilike.%${filters.search.trim()}%`);
    }
    if (filters.categoryId) {
      const cat = categories.find((c) => c.slug === filters.categoryId);
      if (cat) query = query.eq('category_id', cat.id);
    }
    if (filters.communityId) {
      query = query.eq('community_id', filters.communityId);
    }
    if (filters.area) {
      query = query.ilike('area', `%${filters.area}%`);
    }
    if (filters.verification) {
      query = query.eq('verification_status', filters.verification as VerificationStatus);
    }

    if (filters.sort === 'confirmed') {
      query = query.order('updated_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    const { data, error: qErr } = await query;
    if (qErr) throw qErr;

    const result = (data as Gem[] | null) ?? [];
    if (reset) {
      setGems(result);
      setAreas(Array.from(new Set(result.map((g) => g.area).filter(Boolean))) as string[]);
    } else {
      setGems((prev) => [...prev, ...result]);
    }
    setHasMore(result.length === PAGE_SIZE);
    setPage(pageNum);
  };

  const applyFilters = useCallback(async () => {
    setPage(0);
    setHasMore(true);
    setLoading(true);
    setError(false);
    try {
      await loadGems(0, true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, categories]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  const handleLoadMore = async () => {
    try {
      await loadGems(page + 1, false);
    } catch {
      setError(true);
    }
  };

  const hasActiveFilters = useMemo(() =>
    filters.search || filters.categoryId || filters.communityId || filters.area || filters.verification,
    [filters],
  );

  const resetFilters = () => {
    setFilters({ ...DEFAULT_FILTERS });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Explore gems" subtitle="Discover hidden gems shared across all communities you can access." />

      {/* Search bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <input
          type="search"
          className="input pl-11"
          placeholder="Search by name, place, or description…"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
      </div>

      {/* Filters */}
      <div className="card space-y-4 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-stone-500">
          <Filter className="h-4 w-4" /> Filters
          {hasActiveFilters && (
            <button onClick={resetFilters} className="ml-auto flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400">
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Category</label>
            <select className="input" value={filters.categoryId} onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Community</label>
            <select className="input" value={filters.communityId} onChange={(e) => setFilters((f) => ({ ...f, communityId: e.target.value }))}>
              <option value="">All communities</option>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.visibility === 'private' ? <Lock className="inline h-3 w-3" /> : <Globe className="inline h-3 w-3" />} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Area</label>
            <input
              className="input"
              placeholder="e.g. Kemang"
              value={filters.area}
              onChange={(e) => setFilters((f) => ({ ...f, area: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Status</label>
            <select className="input" value={filters.verification} onChange={(e) => setFilters((f) => ({ ...f, verification: e.target.value }))}>
              <option value="">Any status</option>
              {Object.entries(VERIFICATION_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="label">Sort</label>
          <div className="flex gap-1">
            <button
              onClick={() => setFilters((f) => ({ ...f, sort: 'recent' }))}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${filters.sort === 'recent' ? 'bg-primary-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300'}`}
            >
              Recently added
            </button>
            <button
              onClick={() => setFilters((f) => ({ ...f, sort: 'confirmed' }))}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${filters.sort === 'confirmed' ? 'bg-primary-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300'}`}
            >
              Recently updated
            </button>
          </div>
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.search && <FilterChip label={`Search: "${filters.search}"` } onClear={() => setFilters((f) => ({ ...f, search: '' }))} />}
          {filters.categoryId && <FilterChip label={`Category: ${categories.find((c) => c.slug === filters.categoryId)?.name ?? filters.categoryId}`} onClear={() => setFilters((f) => ({ ...f, categoryId: '' }))} />}
          {filters.communityId && <FilterChip label={`Community: ${communities.find((c) => c.id === filters.communityId)?.name ?? ''}`} onClear={() => setFilters((f) => ({ ...f, communityId: '' }))} />}
          {filters.area && <FilterChip label={`Area: ${filters.area}`} onClear={() => setFilters((f) => ({ ...f, area: '' }))} />}
          {filters.verification && <FilterChip label={`Status: ${VERIFICATION_STATUS_LABELS[filters.verification as VerificationStatus]}`} onClear={() => setFilters((f) => ({ ...f, verification: '' }))} />}
        </div>
      )}

      {/* Results */}
      {loading && gems.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : error ? (
        <ErrorState description="We couldn't load gems. Please try again." onRetry={applyFilters} />
      ) : gems.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title={hasActiveFilters ? "No matching gems" : "No gems yet"}
          description={hasActiveFilters ? "Try adjusting or clearing your filters." : "Gems will appear here once community members start sharing."}
          action={hasActiveFilters ? <button onClick={resetFilters} className="btn-outline">Clear filters</button> : undefined}
        />
      ) : (
        <>
          <p className="text-sm text-stone-400">{gems.length} gem{gems.length !== 1 ? 's' : ''}{hasMore ? '+' : ''}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {gems.map((g) => (
              <button key={g.id} onClick={() => navigate(`/gems/${g.id}`)} className="card overflow-hidden text-left transition-shadow hover:shadow-card-hover">
                {g.cover_image_url ? (
                  <img src={g.cover_image_url} alt={g.title} className="h-36 w-full object-cover" />
                ) : (
                  <div className="flex h-36 items-center justify-center bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900/30 dark:to-accent-900/30">
                    <Sparkles className="h-6 w-6 text-primary-400" />
                  </div>
                )}
                <div className="p-4">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {g.category && <span className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{g.category.name}</span>}
                    {g.verification_status && g.verification_status !== 'new' && (
                      <span className="badge bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300">{VERIFICATION_STATUS_LABELS[g.verification_status]}</span>
                    )}
                  </div>
                  <h3 className="font-display text-base font-semibold">{g.title}</h3>
                  <p className="mt-1 flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400"><MapPin className="h-3.5 w-3.5" /> {g.place_name}</p>
                  {g.area && <p className="text-xs text-stone-400">{g.area}</p>}
                  <div className="mt-2 flex items-center gap-2 text-xs text-stone-400">
                    <span>{g.community?.name}</span>
                    {g.author && <><span>·</span><span>{g.author.display_name}</span></>}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {hasMore && !loading && (
            <div className="flex justify-center pt-2">
              <button onClick={handleLoadMore} className="btn-outline">
                Load more
              </button>
            </div>
          )}

          {loading && gems.length > 0 && (
            <div className="flex justify-center py-2"><LoadingSpinner className="text-primary-500" /></div>
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
      {label}
      <button onClick={onClear} className="rounded-full hover:bg-primary-100 dark:hover:bg-primary-800/40">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
