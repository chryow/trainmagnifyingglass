import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate, useRoute } from '@/lib/router';
import { PageHeader } from '@/components/Avatar';
import { EmptyState, ErrorState, LoadingSpinner, SkeletonCard } from '@/components/States';
import { GemCard } from '@/components/GemCard';
import { GemsMap } from '@/components/Map';
import type { Gem, Category, Community, VerificationStatus } from '@/types/database';
import { VERIFICATION_STATUS_LABELS } from '@/types/database';
import { Search, Sparkles, Filter, X, RotateCcw, Globe, Lock, List, Map as MapIcon } from 'lucide-react';

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
  const [view, setView] = useState<'list' | 'map'>(route.params.view === 'map' ? 'map' : 'list');

  const mapPoints = useMemo(
    () => gems.filter((g) => g.lat != null && g.lng != null).map((g) => ({ id: g.id, lat: g.lat as number, lng: g.lng as number, title: g.title })),
    [gems],
  );
  const openGem = useCallback((id: string) => navigate(`/gems/${id}`), [navigate]);

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
      if (catsRes.error || commsRes.error) throw catsRes.error ?? commsRes.error;
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

    // Strip characters that are syntax in PostgREST's or() filter
    const term = filters.search.trim().replace(/[,()"'\\%*]/g, ' ').replace(/\s+/g, ' ').trim();
    if (term) {
      query = query.or(`title.ilike.%${term}%,place_name.ilike.%${term}%,description.ilike.%${term}%`);
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
      <PageHeader
        title="Explore"
        subtitle="Every gem you can see, across all your communities."
        action={
          <div className="flex shrink-0 rounded-2xl bg-stone-100 p-1 dark:bg-stone-800" role="tablist" aria-label="View">
            {(['list', 'map'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${view === v ? 'bg-white text-stone-900 shadow-card dark:bg-stone-900 dark:text-white' : 'text-stone-500'}`}
              >
                {v === 'list' ? <List className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />}
                {v === 'list' ? 'List' : 'Map'}
              </button>
            ))}
          </div>
        }
      />

      {/* Search bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <input
          type="search"
          className="input h-14 rounded-3xl bg-white pl-11 text-base shadow-card dark:bg-stone-900"
          placeholder="Search by name, place, or description…"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
      </div>

      {/* Filters */}
      <div className="card space-y-4 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-stone-500">
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
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${filters.sort === 'recent' ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300'}`}
            >
              Recently added
            </button>
            <button
              onClick={() => setFilters((f) => ({ ...f, sort: 'confirmed' }))}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${filters.sort === 'confirmed' ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300'}`}
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
          {view === 'map' ? (
            <div className="space-y-2">
              <GemsMap points={mapPoints} onSelect={openGem} className="h-[60vh] min-h-[22rem]" />
              <p className="text-sm text-stone-400">
                {mapPoints.length} of {gems.length}{hasMore ? '+' : ''} gems have a map pin.
                {mapPoints.length < gems.length && ' Authors can add one by editing their gem.'}
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-stone-400">{gems.length} gem{gems.length !== 1 ? 's' : ''}{hasMore ? '+' : ''}</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {gems.map((g) => (
                  <GemCard key={g.id} gem={g} onOpen={() => navigate(`/gems/${g.id}`)} />
                ))}
              </div>
            </>
          )}

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
