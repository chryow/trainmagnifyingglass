import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate } from '@/lib/router';
import { PageHeader } from '@/components/Avatar';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/States';
import type { Gem, Collection } from '@/types/database';
import { Heart, MapPin, Layers } from 'lucide-react';

export default function FollowingPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [gems, setGems] = useState<Gem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(false);
    try {
      // Get IDs of users I follow
      const { data: follows } = await supabase
        .from('follows')
        .select('followee_id')
        .eq('follower_id', profile.id);
      const followeeIds = ((follows as { followee_id: string }[] | null) ?? []).map((f) => f.followee_id);
      if (followeeIds.length === 0) {
        setGems([]);
        setCollections([]);
        setLoading(false);
        return;
      }

      const [gemsRes, collectionsRes] = await Promise.all([
        supabase
          .from('gems')
          .select('*, author:profiles(id, username, display_name, avatar_url), community:communities(id, name, visibility), category:categories(id, name, slug, icon)')
          .eq('status', 'published')
          .in('author_id', followeeIds)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('collections')
          .select('*, owner:profiles(id, username, display_name, avatar_url)')
          .in('owner_id', followeeIds)
          .in('visibility', ['public', 'followers'])
          .order('updated_at', { ascending: false })
          .limit(10),
      ]);
      setGems((gemsRes.data as Gem[] | null) ?? []);
      setCollections((collectionsRes.data as Collection[] | null) ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Following" subtitle="Gems and collections from people you follow." />
        <div className="grid gap-4 sm:grid-cols-2"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      </div>
    );
  }

  if (error) {
    return <ErrorState description="Couldn't load your following feed." onRetry={load} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Following" subtitle="Gems and collections from people you follow." />

      {gems.length === 0 && collections.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-6 w-6" />}
          title="Nothing in your feed yet"
          description="Follow people to see their published gems and collections here."
          action={<button onClick={() => navigate('/search')} className="btn-primary">Discover gems</button>}
        />
      ) : (
        <>
          {gems.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Heart className="h-4 w-4 text-error-500" />
                <h2 className="section-title text-lg">Recent gems</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {gems.map((g) => (
                  <button key={g.id} onClick={() => navigate(`/gems/${g.id}`)} className="card overflow-hidden text-left transition-shadow hover:shadow-card-hover">
                    {g.cover_image_url ? (
                      <img src={g.cover_image_url} alt={g.title} className="h-36 w-full object-cover" />
                    ) : (
                      <div className="flex h-36 items-center justify-center bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900/30 dark:to-accent-900/30" />
                    )}
                    <div className="p-4">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs text-stone-400">{g.community?.name}</span>
                      </div>
                      <h3 className="font-display text-base font-semibold">{g.title}</h3>
                      <p className="mt-1 flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400"><MapPin className="h-3.5 w-3.5" /> {g.place_name}</p>
                      {g.author && <p className="mt-2 text-xs text-stone-400">by {g.author.display_name}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {collections.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary-500" />
                <h2 className="section-title text-lg">Collections</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {collections.map((c) => (
                  <button key={c.id} onClick={() => navigate(`/collections/${c.id}`)} className="card overflow-hidden text-left transition-shadow hover:shadow-card-hover">
                    <div className="h-24 bg-gradient-to-br from-primary-300 to-accent-400" />
                    <div className="p-4">
                      <h3 className="font-display text-base font-semibold">{c.name}</h3>
                      {c.description && <p className="mt-1 line-clamp-2 text-sm text-stone-500 dark:text-stone-400">{c.description}</p>}
                      {c.owner && <p className="mt-2 text-xs text-stone-400">by {c.owner.display_name}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
