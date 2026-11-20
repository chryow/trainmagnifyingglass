import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate } from '@/lib/router';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/States';
import { GemCard, GemArt, CategoryIcon } from '@/components/GemCard';
import type { Category, Community, UserInterest, Gem } from '@/types/database';
import { Search, Compass as CompassIcon, MapPin, ArrowRight, Heart, Layers, PenLine } from 'lucide-react';

export default function DiscoverPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [interests, setInterests] = useState<UserInterest[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [gems, setGems] = useState<Gem[]>([]);
  const [myDrafts, setMyDrafts] = useState<Gem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    setError(false);
    try {
      const [interestsRes, categoriesRes, communitiesRes, gemsRes, draftsRes] = await Promise.all([
        supabase.from('user_interests').select('*').eq('user_id', profile.id),
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('communities').select('*').eq('visibility', 'public').eq('is_active', true).order('created_at', { ascending: false }).limit(6),
        supabase
          .from('gems')
          .select('*, author:profiles(id, username, display_name, avatar_url), community:communities(id, name, visibility), category:categories(id, name, slug, icon)')
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(12),
        supabase.from('gems').select('*').eq('author_id', profile.id).eq('status', 'draft').order('updated_at', { ascending: false }).limit(4),
      ]);
      // supabase-js returns errors instead of throwing; surface them so the
      // page shows the retry state instead of silently looking empty.
      const failed = [interestsRes, categoriesRes, communitiesRes, gemsRes, draftsRes].find((r) => r.error);
      if (failed) throw failed.error;
      setInterests((interestsRes.data as UserInterest[] | null) ?? []);
      setCategories((categoriesRes.data as Category[] | null) ?? []);
      setCommunities((communitiesRes.data as Community[] | null) ?? []);
      setGems((gemsRes.data as Gem[] | null) ?? []);
      setMyDrafts((draftsRes.data as Gem[] | null) ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.id]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.display_name?.split(' ')[0] ?? 'Explorer';
  const [featured, ...restGems] = gems;

  const header = (
    <div className="mb-6">
      <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">{greeting}, {firstName}</p>
      <h1 className="mt-1 font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl">What will you find today?</h1>
    </div>
  );

  if (loading) {
    return (
      <div>
        {header}
        <div className="skeleton mb-6 h-14 w-full rounded-3xl" />
        <div className="skeleton mb-6 h-72 w-full rounded-4xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState description="We couldn't load your feed. Check your connection and try again." onRetry={load} />;
  }

  const goSearch = () => { if (search.trim()) navigate(`/search?q=${encodeURIComponent(search.trim())}`); };

  return (
    <div className="space-y-10">
      <div>
        {header}

        {/* Search */}
        <form onSubmit={(e) => { e.preventDefault(); goSearch(); }} className="relative">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            className="input h-14 rounded-3xl bg-white pl-12 pr-28 text-base shadow-card dark:bg-stone-900"
            placeholder="Cafés, viewpoints, warungs, neighbourhoods…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search gems"
          />
          <button type="submit" className="btn-primary absolute right-2 top-1/2 -translate-y-1/2 rounded-2xl px-5">Search</button>
        </form>

        {/* Shortcuts + interests */}
        <div className="scrollbar-hide -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          <button onClick={() => navigate('/following')} className="badge shrink-0 bg-stone-900 px-3.5 py-1.5 text-sm text-white dark:bg-white dark:text-stone-900">
            <Heart className="h-3.5 w-3.5" /> Following
          </button>
          <button onClick={() => navigate('/collections')} className="badge shrink-0 bg-stone-900 px-3.5 py-1.5 text-sm text-white dark:bg-white dark:text-stone-900">
            <Layers className="h-3.5 w-3.5" /> My collections
          </button>
          {interests.map((i) => (
            <button
              key={i.id}
              onClick={() => navigate(`/search?q=${encodeURIComponent(i.interest)}`)}
              className="badge shrink-0 border border-stone-200 bg-white px-3.5 py-1.5 text-sm text-stone-700 hover:border-primary-300 hover:text-primary-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
            >
              {i.interest}
            </button>
          ))}
        </div>
      </div>

      {/* Drafts nudge */}
      {myDrafts.length > 0 && (
        <section className="rounded-3xl bg-citrine-100 p-4 dark:bg-citrine-500/10 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <PenLine className="h-4 w-4 text-citrine-700 dark:text-citrine-300" />
            <h2 className="font-display text-base font-bold text-stone-900 dark:text-citrine-100">
              {myDrafts.length === 1 ? 'You have a draft waiting' : `You have ${myDrafts.length} drafts waiting`}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {myDrafts.map((g) => (
              <button key={g.id} onClick={() => navigate(`/gems/${g.id}`)} className="rounded-2xl bg-white px-3.5 py-2 text-left text-sm font-semibold shadow-card hover:shadow-card-hover dark:bg-stone-900">
                {g.title}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Latest gems: one featured, the rest in a grid */}
      {featured && (
        <section>
          <SectionHeading title="Fresh finds" action="See all" onAction={() => navigate('/search')} />
          <GemCard gem={featured} featured onOpen={() => navigate(`/gems/${featured.id}`)} />
          {restGems.length > 0 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {restGems.map((g) => (
                <GemCard key={g.id} gem={g} onOpen={() => navigate(`/gems/${g.id}`)} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <section>
          <SectionHeading title="Browse by category" action="Explore" onAction={() => navigate('/explore')} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.slice(0, 8).map((cat, i) => (
              <button
                key={cat.id}
                onClick={() => navigate(`/explore?category=${cat.slug}`)}
                className="group flex items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-card transition-shadow hover:shadow-card-hover dark:bg-stone-900"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${CATEGORY_TINTS[i % CATEGORY_TINTS.length]}`}>
                  <CategoryIcon icon={cat.icon} className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold">{cat.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Communities */}
      {communities.length > 0 && (
        <section>
          <SectionHeading title="Communities to join" action="See all" onAction={() => navigate('/communities')} />
          <div className="scrollbar-hide -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
            {communities.map((c) => (
              <button key={c.id} onClick={() => navigate(`/communities/${c.id}`)} className="card w-64 shrink-0 snap-start overflow-hidden text-left transition-shadow hover:shadow-card-hover sm:w-auto">
                <div className="h-24">
                  {c.cover_image_url
                    ? <img src={c.cover_image_url} alt="" className="h-full w-full object-cover" />
                    : <GemArt id={c.id} icon="users" className="h-full w-full" />}
                </div>
                <div className="p-4">
                  <h3 className="font-display text-base font-bold">{c.name}</h3>
                  <p className="mt-1 flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
                    {typeLabel(c.community_type)}
                    {c.general_area && <><MapPin className="ml-1 h-3 w-3" />{c.general_area}</>}
                  </p>
                  {c.description && <p className="mt-2 line-clamp-2 text-sm text-stone-500 dark:text-stone-400">{c.description}</p>}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {gems.length === 0 && (
        <EmptyState
          icon={<CompassIcon className="h-6 w-6" />}
          title="No gems shared yet"
          description="Be the first: join or create a community, then share a place you love that most people walk past."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={() => navigate('/communities')} className="btn-outline">Find a community</button>
              <button onClick={() => navigate('/gems/new')} className="btn-primary">Add a gem</button>
            </div>
          }
        />
      )}
    </div>
  );
}

// Soft tinted chips with matching icon colour, instead of solid saturated blocks
const CATEGORY_TINTS = [
  'bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300',
  'bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300',
  'bg-[#efe8f8] text-[#7a5aa8] dark:bg-[#8f74c2]/15 dark:text-[#c3b1e3]',
  'bg-[#e4f2ec] text-[#4c8a72] dark:bg-[#6fae96]/15 dark:text-[#a7d4c2]',
  'bg-citrine-100 text-citrine-700 dark:bg-citrine-500/15 dark:text-citrine-300',
  'bg-[#e3f1f3] text-[#4a8a95] dark:bg-[#6fb3bf]/15 dark:text-[#a8d6de]',
];

function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <h2 className="font-display text-2xl font-extrabold">{title}</h2>
      {action && onAction && (
        <button onClick={onAction} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">
          {action} <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function typeLabel(t: string) {
  return t === 'location_based' ? 'Location' : t === 'interest_based' ? 'Interest' : 'Private group';
}
