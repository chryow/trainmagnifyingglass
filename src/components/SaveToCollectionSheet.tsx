import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/States';
import type { Collection, CollectionVisibility } from '@/types/database';
import { Check, Plus, X, Lock, Users, Globe, Layers } from 'lucide-react';

const VISIBILITY_ICON: Record<CollectionVisibility, typeof Lock> = { private: Lock, followers: Users, public: Globe };

/**
 * Bottom sheet (phones) / dialog (desktop) for adding a gem to one or more of
 * the user's collections, or creating a new collection on the spot.
 */
export default function SaveToCollectionSheet({ gemId, userId, onClose }: { gemId: string; userId: string; onClose: () => void }) {
  const [collections, setCollections] = useState<Collection[]>([]);
  // collection id -> collection_items row id, for the collections this gem is in
  const [membership, setMembership] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const [colRes, itemRes] = await Promise.all([
        supabase.from('collections').select('*').eq('owner_id', userId).order('updated_at', { ascending: false }),
        supabase.from('collection_items').select('id, collection_id').eq('gem_id', gemId).eq('added_by', userId),
      ]);
      if (!active) return;
      if (colRes.error || itemRes.error) {
        setError("Couldn't load your collections. Close this and try again.");
      } else {
        setCollections((colRes.data as Collection[]) ?? []);
        const map: Record<string, string> = {};
        for (const row of (itemRes.data as { id: string; collection_id: string }[]) ?? []) map[row.collection_id] = row.id;
        setMembership(map);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [gemId, userId]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = async (c: Collection) => {
    if (busyId) return;
    await applyToggle(c);
  };

  // No busy guard here: createAndAdd calls this while it is still marked busy
  const applyToggle = async (c: Collection) => {
    setBusyId(c.id);
    setError(null);
    const itemId = membership[c.id];
    if (itemId) {
      const { error: delErr } = await supabase.from('collection_items').delete().eq('id', itemId);
      if (delErr) setError(delErr.message);
      else setMembership(({ [c.id]: _removed, ...rest }) => rest);
    } else {
      const { data, error: insErr } = await supabase
        .from('collection_items')
        .insert({ collection_id: c.id, gem_id: gemId, added_by: userId })
        .select('id')
        .single();
      if (insErr) setError(insErr.code === '23505' ? 'Already in that collection.' : insErr.message);
      else setMembership((m) => ({ ...m, [c.id]: (data as { id: string }).id }));
    }
    setBusyId(null);
  };

  const createAndAdd = async (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || busyId) return;
    setBusyId('new');
    setError(null);
    const { data, error: createErr } = await supabase
      .from('collections')
      .insert({ name, owner_id: userId, visibility: 'private' })
      .select('*')
      .single();
    if (createErr || !data) {
      setError(createErr?.message ?? "Couldn't create the collection.");
      setBusyId(null);
      return;
    }
    const created = data as Collection;
    setCollections((cs) => [created, ...cs]);
    setNewName('');
    setCreating(false);
    await applyToggle(created);
  };

  const savedCount = Object.keys(membership).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-to-collection-title"
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-4xl bg-white p-6 pb-8 shadow-card-hover animate-slide-up dark:bg-stone-900 sm:max-w-md sm:rounded-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-stone-200 dark:bg-stone-700 sm:hidden" aria-hidden />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="save-to-collection-title" className="font-display text-2xl font-extrabold">Save to collection</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {savedCount === 0 ? 'Pick one or more lists.' : `In ${savedCount} collection${savedCount === 1 ? '' : 's'}.`}
            </p>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10 text-primary-500"><LoadingSpinner /></div>
        ) : (
          <div className="space-y-2">
            {collections.length === 0 && !creating && (
              <div className="rounded-3xl bg-stone-50 p-5 text-center dark:bg-stone-800/50">
                <Layers className="mx-auto mb-2 h-6 w-6 text-stone-400" />
                <p className="text-sm text-stone-500 dark:text-stone-400">You don't have any collections yet. Create one like "Rainy-day cafés".</p>
              </div>
            )}

            {collections.map((c) => {
              const inIt = !!membership[c.id];
              const Icon = VISIBILITY_ICON[c.visibility] ?? Lock;
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c)}
                  disabled={busyId !== null}
                  aria-pressed={inIt}
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
                    inIt ? 'border-primary-400 bg-primary-50 dark:border-primary-500 dark:bg-primary-500/10' : 'border-stone-200 hover:border-stone-300 dark:border-stone-700'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="flex items-center gap-1 text-xs capitalize text-stone-400"><Icon className="h-3 w-3" /> {c.visibility}</p>
                  </div>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${inIt ? 'bg-gem text-white' : 'border-2 border-stone-300 dark:border-stone-600'}`}>
                    {busyId === c.id ? <LoadingSpinner size={14} /> : inIt ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
                  </span>
                </button>
              );
            })}

            {creating ? (
              <form onSubmit={createAndAdd} className="flex gap-2 pt-2">
                <input
                  autoFocus
                  className="input"
                  placeholder="Collection name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={80}
                  aria-label="New collection name"
                />
                <button type="submit" className="btn-primary shrink-0" disabled={!newName.trim() || busyId !== null}>
                  {busyId === 'new' ? <LoadingSpinner size={16} /> : 'Create'}
                </button>
              </form>
            ) : (
              <button onClick={() => setCreating(true)} className="btn-ghost mt-1 w-full justify-start px-4">
                <Plus className="h-4 w-4" /> New collection
              </button>
            )}
            {creating && <p className="text-xs text-stone-400">New collections start private. You can change that from the collection page.</p>}
          </div>
        )}

        {error && <p role="alert" className="mt-3 text-sm text-error-600 dark:text-error-400">{error}</p>}

        <button onClick={onClose} className="btn-secondary mt-5 w-full">Done</button>
      </div>
    </div>
  );
}
