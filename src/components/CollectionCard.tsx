import type { Collection, CollectionVisibility } from '@/types/database';
import { GemArt } from '@/components/GemCard';
import { Lock, Users, Globe } from 'lucide-react';

/** Up to three gems per collection, fetched with the collection for the mosaic */
export interface CollectionPreview { gem: { id: string; cover_image_url: string | null; category?: { icon: string | null } | null } | null }
export type CollectionWithPreview = Collection & { collection_items?: CollectionPreview[] };

/** Select fragment that returns a collection plus three gems for its mosaic */
export const COLLECTION_PREVIEW_SELECT = '*, collection_items(gem:gems(id, cover_image_url, category:categories(icon)))';

const VIS: Record<CollectionVisibility, { icon: typeof Lock; label: string }> = {
  private: { icon: Lock, label: 'Private' },
  followers: { icon: Users, label: 'Followers' },
  public: { icon: Globe, label: 'Public' },
};

function Tile({ item, fallbackId, className }: { item?: CollectionPreview; fallbackId: string; className: string }) {
  const g = item?.gem;
  if (g?.cover_image_url) return <img src={g.cover_image_url} alt="" loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  return <GemArt id={g?.id ?? fallbackId} icon={g?.category?.icon ?? 'sparkles'} className={`h-full w-full ${className}`} />;
}

/** Collection card with a three-photo mosaic of the gems inside it. */
export function CollectionCard({ collection, onOpen, showVisibility = false }: { collection: CollectionWithPreview; onOpen: () => void; showVisibility?: boolean }) {
  const items = (collection.collection_items ?? []).filter((i) => i.gem).slice(0, 3);
  const vis = VIS[collection.visibility] ?? VIS.private;
  return (
    <button onClick={onOpen} className="group card overflow-hidden p-2 text-left transition-shadow hover:shadow-card-hover">
      <div className="grid h-36 grid-cols-3 grid-rows-2 gap-1 overflow-hidden rounded-2xl">
        <div className="col-span-2 row-span-2 overflow-hidden"><Tile item={items[0]} fallbackId={collection.id} className="" /></div>
        <div className="overflow-hidden"><Tile item={items[1]} fallbackId={`${collection.id}-b`} className="" /></div>
        <div className="overflow-hidden"><Tile item={items[2]} fallbackId={`${collection.id}-c`} className="" /></div>
      </div>
      <div className="px-2 pb-2 pt-3">
        <h3 className="font-display text-lg font-bold leading-snug">{collection.name}</h3>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
          {showVisibility && <><vis.icon className="h-3 w-3" /> {vis.label} ·</>}
          {(collection.collection_items?.length ?? 0) === 0 ? 'Empty' : `${collection.collection_items!.length} gem${collection.collection_items!.length === 1 ? '' : 's'}`}
        </p>
      </div>
    </button>
  );
}
