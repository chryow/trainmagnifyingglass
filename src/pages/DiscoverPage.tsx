import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate } from '@/lib/router';
import { Avatar, PageHeader } from '@/components/Avatar';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/States';
import type { Category, Community, UserInterest } from '@/types/database';
import { Search, Compass as CompassIcon, Sparkles, TrendingUp, MapPin, ArrowRight } from 'lucide-react';

export default function DiscoverPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [interests, setInterests] = useState<UserInterest[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    setError(false);
    try {
      const [interestsRes, categoriesRes, communitiesRes] = await Promise.all([
        supabase.from('user_interests').select('*').eq('user_id', profile.id),
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('communities').select('*').eq('visibility', 'public').eq('is_active', true).order('created_at', { ascending: false }).limit(6),
      ]);
      setInterests((interestsRes.data as UserInterest[] | null) ?? []);
      setCategories((categoriesRes.data as Category[] | null) ?? []);
      setCommunities((communitiesRes.data as Community[] | null) ?? []);
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

  if (loading) {
    return (
      <div>
        <PageHeader title={`${greeting}, ${firstName}`} subtitle="Here's what's waiting to be discovered." />
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState description="We couldn't load your feed. Please check your connection." onRetry={load} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title={`${greeting}, ${firstName}`} subtitle="Here's what's waiting to be discovered." />

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <input
          type="search"
          className="input pl-11"
          placeholder="Search gems, places, communities…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && search.trim()) navigate(`/search?q=${encodeURIComponent(search.trim())}`); }}
        />
      </div>

      {/* Interests */}
      {interests.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary-500" />
            <h2 className="section-title text-lg">Recommended for you</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {interests.map((i) => (
              <span key={i.id} className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                {i.interest}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Coming-soon sections for Phase 2+ */}
      <section className="card overflow-hidden">
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="rounded-2xl bg-accent-50 p-3 text-accent-600 dark:bg-accent-900/30 dark:text-accent-400">
            <CompassIcon className="h-6 w-6" />
          </div>
          <h2 className="font-display text-lg font-semibold">Personalized gems are coming soon</h2>
          <p className="max-w-md text-sm text-stone-500 dark:text-stone-400">
            In the next phase, this feed will show recently added gems, community-confirmed spots, and places near your area — filtered by your interests.
          </p>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title text-lg">Browse by category</h2>
            <button onClick={() => navigate('/explore')} className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
              Explore <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {categories.slice(0, 8).map((cat) => (
              <button
                key={cat.id}
                onClick={() => navigate(`/explore?category=${cat.slug}`)}
                className="card flex items-center gap-3 p-3.5 text-left transition-shadow hover:shadow-card-hover"
              >
                <div className="w-fit rounded-lg bg-stone-100 p-2 text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                  <CategoryIcon icon={cat.icon} />
                </div>
                <span className="text-sm font-medium">{cat.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Communities preview */}
      {communities.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent-500" />
              <h2 className="section-title text-lg">Active communities</h2>
            </div>
            <button onClick={() => navigate('/communities')} className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {communities.map((c) => (
              <button key={c.id} onClick={() => navigate(`/communities/${c.id}`)} className="card overflow-hidden text-left transition-shadow hover:shadow-card-hover">
                <div className="h-28 bg-gradient-to-br from-primary-300 to-accent-400">
                  {c.cover_image_url && <img src={c.cover_image_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="badge bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">{typeLabel(c.community_type)}</span>
                    {c.general_area && <span className="flex items-center gap-1 text-xs text-stone-400"><MapPin className="h-3 w-3" />{c.general_area}</span>}
                  </div>
                  <h3 className="font-display text-base font-semibold">{c.name}</h3>
                  {c.description && <p className="mt-1 line-clamp-2 text-sm text-stone-500 dark:text-stone-400">{c.description}</p>}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {communities.length === 0 && categories.length === 0 && (
        <EmptyState
          icon={<CompassIcon className="h-6 w-6" />}
          title="Nothing to discover yet"
          description="Communities and gems will appear here once people start sharing. Try creating or joining a community."
          action={<button onClick={() => navigate('/communities')} className="btn-primary">Browse communities</button>}
        />
      )}
    </div>
  );
}

function typeLabel(t: string) {
  return t === 'location_based' ? 'Location' : t === 'interest_based' ? 'Interest' : 'Private Group';
}

// Minimal icon mapper (lucide names stored in DB)
import { Utensils, Coffee, Trees, Mountain, BookOpen, Laptop, Palette, Book, ShoppingBag, Bike, Users, Camera, Compass, Moon, Sparkles as SparkleIcon } from 'lucide-react';
const ICONS: Record<string, typeof Utensils> = {
  utensils: Utensils, coffee: Coffee, trees: Trees, mountain: Mountain, 'book-open': BookOpen,
  laptop: Laptop, palette: Palette, book: Book, 'shopping-bag': ShoppingBag, bike: Bike,
  users: Users, camera: Camera, compass: Compass, moon: Moon, sparkles: SparkleIcon,
};
function CategoryIcon({ icon }: { icon: string | null }) {
  const Cmp = (icon && ICONS[icon]) || SparkleIcon;
  return <Cmp className="h-4 w-4" />;
}
