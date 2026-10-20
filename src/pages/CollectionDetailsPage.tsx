import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate, useRoute, matchPath } from '@/lib/router';
import { Avatar, PageHeader } from '@/components/Avatar';
import { EmptyState, ErrorState, LoadingSpinner } from '@/components/States';
import type { Collection, CollectionItem, Gem, CollectionVisibility } from '@/types/database';
import { ArrowLeft, Lock, Globe, Users, Trash2, MapPin, Plus, Search, X, Edit3, Save } from 'lucide-react';

export default function CollectionDetailsPage() {
  const route = useRoute();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const match = matchPath('/collections/:id', route.path);
  const collectionId = match?.id ?? '';

  const [collection, setCollection] = useState<Collection | null>(null);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [searchGems, setSearchGems] = useState('');
  const [searchResults, setSearchResults] = useState<Gem[]>([]);
  const [searching, setSearching] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editVis, setEditVis] = useState<CollectionVisibility>('private');
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!collectionId || !profile) return;
    setLoading(true);
    setError(false);
    try {
      const { data: c, error: cErr } = await supabase
        .from('collections')
        .select('*, owner:profiles(id, username, display_name, avatar_url)')
        .eq('id', collectionId)
        .maybeSingle();
      if (cErr || !c) { setError(true); return; }
      setCollection(c as Collection);

      const { data: iData } = await supabase
        .from('collection_items')
        .select('*, gem:gems(*, author:profiles(id, username, display_name, avatar_url), community:communities(id, name, visibility), category:categories(id, name, slug, icon))')
        .eq('collection_id', collectionId)
        .order('sort_order', { ascending: true });
      setItems((iData as CollectionItem[] | null) ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [collectionId, profile]);

  useEffect(() => { load(); }, [load]);

  const isOwner = collection?.owner_id === profile?.id;

  const startEditing = () => {
    if (!collection) return;
    setEditName(collection.name);
    setEditDesc(collection.description ?? '');
    setEditVis(collection.visibility);
    setFormError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!collection || !isOwner) return;
    if (editName.trim().length < 1) { setFormError('Name is required.'); return; }
    setSaving(true);
    const { error: updErr } = await supabase.from('collections').update({
      name: editName.trim(),
      description: editDesc.trim() || null,
      visibility: editVis,
    }).eq('id', collection.id);
    setSaving(false);
    if (updErr) { setFormError(updErr.message); return; }
    setEditing(false);
    await load();
  };

  const handleDelete = async () => {
    if (!collection || !isOwner) return;
    if (!confirm('Delete this collection? This cannot be undone.')) return;
    await supabase.from('collections').delete().eq('id', collection.id);
    navigate('/collections');
  };

  const handleRemoveItem = async (item: CollectionItem) => {
    await supabase.from('collection_items').delete().eq('id', item.id);
    await load();
  };

  const handleSearchGems = async () => {
    if (!searchGems.trim() || !profile) return;
    setSearching(true);
    const { data } = await supabase
      .from('gems')
      .select('*, author:profiles(id, username, display_name, avatar_url), community:communities(id, name, visibility), category:categories(id, name, slug, icon)')
      .eq('status', 'published')
      .or(`title.ilike.%${searchGems.trim()}%,place_name.ilike.%${searchGems.trim()}%`)
      .limit(10);
    setSearchResults((data as Gem[] | null) ?? []);
    setSearching(false);
  };

  const handleAddGem = async (gem: Gem) => {
    if (!collection) return;
    const nextOrder = (items[items.length - 1]?.sort_order ?? 0) + 1;
    await supabase.from('collection_items').insert({
      collection_id: collection.id,
      gem_id: gem.id,
      added_by: profile?.id,
      sort_order: nextOrder,
    });
    setSearchGems('');
    setSearchResults([]);
    setShowAdd(false);
    await load();
  };

  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-3 py-16"><LoadingSpinner className="text-primary-500" /> <span className="text-stone-500">Loading collection…</span></div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div>
        <button onClick={() => navigate('/collections')} className="mb-4 flex items-center gap-1 text-sm text-stone-500"><ArrowLeft className="h-4 w-4" /> Collections</button>
        <ErrorState title="Collection not found" description="This collection may not exist or you don't have access to it." onRetry={() => navigate('/collections')} />
      </div>
    );
  }

  if (editing) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-sm text-stone-500"><ArrowLeft className="h-4 w-4" /> Cancel</button>
        <PageHeader title="Edit collection" />
        <div className="card space-y-5 p-6">
          <div>
            <label className="label">Name</label>
            <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={80} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[80px] resize-y" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} maxLength={500} />
          </div>
          <div>
            <span className="label">Visibility</span>
            <select className="input" value={editVis} onChange={(e) => setEditVis(e.target.value as CollectionVisibility)}>
              <option value="private">Private</option>
              <option value="followers">Followers only</option>
              <option value="public">Public</option>
            </select>
          </div>
          {formError && <div role="alert" className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/40 dark:text-error-400">{formError}</div>}
          <div className="flex gap-3">
            <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? <LoadingSpinner size={16} /> : <><Save className="h-4 w-4" /> Save</>}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button onClick={() => navigate('/collections')} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400"><ArrowLeft className="h-4 w-4" /> Collections</button>

      {/* Header */}
      <div className="card overflow-hidden">
        <div className="h-32 bg-gradient-to-br from-primary-300 to-accent-400">
          {collection.cover_image_url && <img src={collection.cover_image_url} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="p-5 sm:p-6">
          <div className="mb-2 flex items-center gap-2">
            <VisibilityBadge visibility={collection.visibility} />
          </div>
          <h1 className="font-display text-2xl font-semibold">{collection.name}</h1>
          {collection.description && <p className="mt-2 text-stone-600 dark:text-stone-300">{collection.description}</p>}
          {collection.owner && (
            <button onClick={() => navigate(`/profile/${collection.owner!.id}`)} className="mt-3 flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400">
              <Avatar url={collection.owner.avatar_url ?? null} name={collection.owner.display_name} size={28} />
              <span>by {collection.owner.display_name}</span>
            </button>
          )}

          {isOwner && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={startEditing} className="btn-outline"><Edit3 className="h-4 w-4" /> Edit</button>
              <button onClick={() => setShowAdd((s) => !s)} className="btn-secondary"><Plus className="h-4 w-4" /> Add gems</button>
              <button onClick={handleDelete} className="btn-danger ml-auto"><Trash2 className="h-4 w-4" /> Delete</button>
            </div>
          )}
        </div>
      </div>

      {/* Add gem search */}
      {showAdd && isOwner && (
        <div className="card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Search for gems to add</h2>
            <button onClick={() => { setShowAdd(false); setSearchResults([]); setSearchGems(''); }} className="text-stone-400 hover:text-stone-600"><X className="h-5 w-5" /></button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
            <input className="input pl-11" placeholder="Search by title or place name…" value={searchGems} onChange={(e) => setSearchGems(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSearchGems(); }} />
          </div>
          {searching && <p className="text-sm text-stone-400">Searching…</p>}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((g) => {
                const alreadyAdded = items.some((i) => i.gem_id === g.id);
                return (
                  <div key={g.id} className="flex items-center justify-between rounded-xl border border-stone-200 p-3 dark:border-stone-700">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{g.title}</p>
                      <p className="truncate text-xs text-stone-400">{g.place_name}</p>
                    </div>
                    <button onClick={() => handleAddGem(g)} disabled={alreadyAdded} className="btn-primary shrink-0 text-xs">
                      {alreadyAdded ? 'Added' : 'Add'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <div>
        <h2 className="mb-3 section-title text-lg">Gems ({items.length})</h2>
        {items.length === 0 ? (
          <EmptyState icon={<Plus className="h-6 w-6" />} title="No gems yet" description={isOwner ? "Search and add gems to this collection." : "This collection is empty."} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.id} className="card overflow-hidden">
                <button onClick={() => navigate(`/gems/${item.gem_id}`)} className="block w-full text-left">
                  {item.gem?.cover_image_url ? (
                    <img src={item.gem.cover_image_url} alt={item.gem.title} className="h-32 w-full object-cover" />
                  ) : (
                    <div className="flex h-32 items-center justify-center bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900/30 dark:to-accent-900/30" />
                  )}
                  <div className="p-4">
                    <h3 className="font-display text-base font-semibold">{item.gem?.title ?? 'Gem'}</h3>
                    <p className="mt-1 flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400"><MapPin className="h-3.5 w-3.5" /> {item.gem?.place_name}</p>
                    {item.note && <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">{item.note}</p>}
                  </div>
                </button>
                {isOwner && (
                  <div className="border-t border-stone-100 px-4 py-2 dark:border-stone-800">
                    <button onClick={() => handleRemoveItem(item)} className="flex items-center gap-1 text-xs text-error-600 hover:text-error-700 dark:text-error-400">
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VisibilityBadge({ visibility }: { visibility: CollectionVisibility }) {
  if (visibility === 'public') return <span className="badge bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300"><Globe className="h-3 w-3" /> Public</span>;
  if (visibility === 'followers') return <span className="badge bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"><Users className="h-3 w-3" /> Followers</span>;
  return <span className="badge bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300"><Lock className="h-3 w-3" /> Private</span>;
}
