import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate, useRoute } from '@/lib/router';
import { PageHeader } from '@/components/Avatar';
import { EmptyState, ErrorState, SkeletonCard, LoadingSpinner } from '@/components/States';
import { GemCard } from '@/components/GemCard';
import type { Gem, Category } from '@/types/database';
import { Search, X, SlidersHorizontal } from 'lucide-react';

const PAGE_SIZE = 24;
const GEM_EMBED = '*, author:profiles(id, username, display_name, avatar_url), community:communities(id, name, visibility), category:categories(id, name, slug, icon)';
type Sort = 'relevance' | 'recent' | 'title';

interface Params { query: string; categoryId: string; area: string; sort: Sort }

/**
 * Ranked, typo-tolerant search via the search_gems() database function.
 * Falls back to simple text matching if that function isn't installed yet.
 */
async function fetchPage(p: Params, page: number): Promise<Gem[]> {
  const term = p.query.trim();
  const { data, error } = await supabase
    .rpc('search_gems', {
      p_query: term,
      p_category_id: p.categoryId || null,
      p_area: p.area.trim() || null,
      p_sort: p.sort,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
    })
    .select(GEM_EMBED);
  if (!error) return (data as unknown as Gem[]) ?? [];

  // Function missing (migration 0010 not applied): basic matching instead
  if (error.code !== 'PGRST202' && !/search_gems/.test(error.message)) throw error;
  const safe = term.replace(/[,()"'\\%*]/g, ' ').replace(/\s+/g, ' ').trim();
  let q = supabase.from('gems').select(GEM_EMBED).eq('status', 'published');
  if (safe) q = q.or(`title.ilike.%${safe}%,place_name.ilike.%${safe}%,description.ilike.%${safe}%,area.ilike.%${safe}%`);
  if (p.categoryId) q = q.eq('category_id', p.categoryId);
  if (p.area.trim()) q = q.ilike('area', `%${p.area.trim().replace(/[%*]/g, '')}%`);
  q = p.sort === 'title' ? q.order('title') : q.order('created_at', { ascending: false });
  const res = await q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (res.error) throw res.error;
  return (res.data as Gem[] | null) ?? [];
}

export default function SearchPage() {
  const route = useRoute();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [query, setQuery] = useState(route.params.q ?? '');
  const [debounced, setDebounced] = useState(query);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [area, setArea] = useState('');
  const [sort, setSort] = useState<Sort>('relevance');
  const [showFilters, setShowFilters] = useState(false);

  const [gems, setGems] = useState<Gem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const requestId = useRef(0);
  const [retry, setRetry] = useState(0);

  // Follow ?q= when arriving from another page's search box
  useEffect(() => { if (route.params.q !== undefined) setQuery(route.params.q); }, [route.params.q]);

  // Search 300 ms after typing stops instead of on every keystroke
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    supabase.from('categories').select('*').order('sort_order').then(({ data }) => setCategories((data as Category[] | null) ?? []));
  }, []);

  useEffect(() => {
    if (!profile) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(false);
    fetchPage({ query: debounced, categoryId, area, sort }, 0)
      .then((rows) => {
        if (id !== requestId.current) return; // a newer search has started
        setGems(rows);
        setPage(0);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch(() => id === requestId.current && setError(true))
      .finally(() => id === requestId.current && setLoading(false));
  }, [profile, debounced, categoryId, area, sort, retry]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const rows = await fetchPage({ query: debounced, categoryId, area, sort }, page + 1);
      setGems((g) => [...g, ...rows.filter((r) => !g.some((x) => x.id === r.id))]);
      setPage((n) => n + 1);
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  const activeFilters = [categoryId, area.trim()].filter(Boolean).length;
  const clearFilters = () => { setCategoryId(''); setArea(''); };

  return (
    <div className="space-y-5">
      <PageHeader title="Search" subtitle="Typos are fine: “kopi kemamg” still finds Kopi Kemang." />

      <div className="relative">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <input
          type="search"
          autoFocus={!route.params.q}
          className="input h-14 rounded-3xl bg-white pl-12 text-base shadow-card dark:bg-stone-900"
          placeholder="Places, areas, cafés, viewpoints…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search gems"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setShowFilters((s) => !s)} className="btn-outline py-2" aria-expanded={showFilters}>
          <SlidersHorizontal className="h-4 w-4" /> Filters
          {activeFilters > 0 && <span className="rounded-full bg-primary-600 px-1.5 text-[11px] text-white">{activeFilters}</span>}
        </button>
        {activeFilters > 0 && (
          <button onClick={clearFilters} className="btn-ghost py-2 text-stone-500"><X className="h-4 w-4" /> Clear</button>
        )}
        <div className="ml-auto flex rounded-full bg-stone-100 p-1 dark:bg-stone-800" role="radiogroup" aria-label="Sort results">
          {([['relevance', 'Best match'], ['recent', 'Newest'], ['title', 'A–Z']] as const).map(([v, label]) => (
            <button
              key={v}
              role="radio"
              aria-checked={sort === v}
              onClick={() => setSort(v)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${sort === v ? 'bg-white text-stone-900 shadow-card dark:bg-stone-900 dark:text-white' : 'text-stone-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {showFilters && (
        <div className="card grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <label htmlFor="search-category" className="label">Category</label>
            <select id="search-category" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="search-area" className="label">Area</label>
            <input id="search-area" className="input" placeholder="e.g. Kemang, Ubud" value={area} onChange={(e) => setArea(e.target.value)} />
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : error ? (
        <ErrorState description="Search didn't go through. Check your connection and try again." onRetry={() => setRetry((n) => n + 1)} />
      ) : gems.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title={debounced.trim() || activeFilters ? 'No gems match that' : 'Nothing shared yet'}
          description={debounced.trim() || activeFilters ? 'Try fewer words, a nearby area, or clearing the filters.' : 'Published gems will show up here.'}
          action={debounced.trim() || activeFilters
            ? <button onClick={() => { setQuery(''); clearFilters(); }} className="btn-outline">Clear search</button>
            : <button onClick={() => navigate('/gems/new')} className="btn-primary">Add a gem</button>}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gems.map((g) => <GemCard key={g.id} gem={g} onOpen={() => navigate(`/gems/${g.id}`)} />)}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button onClick={loadMore} disabled={loadingMore} className="btn-outline">
                {loadingMore ? <LoadingSpinner size={16} /> : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
