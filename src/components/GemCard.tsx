import type { Gem } from '@/types/database';
import {
  Utensils, Coffee, Trees, Mountain, BookOpen, Laptop, Palette, Book, ShoppingBag, Bike, Users, Camera,
  Compass, Moon, Sparkles, MapPin,
} from 'lucide-react';

// Lucide icon names stored on categories in the database
const ICONS: Record<string, typeof Utensils> = {
  utensils: Utensils, coffee: Coffee, trees: Trees, mountain: Mountain, 'book-open': BookOpen,
  laptop: Laptop, palette: Palette, book: Book, 'shopping-bag': ShoppingBag, bike: Bike,
  users: Users, camera: Camera, compass: Compass, moon: Moon, sparkles: Sparkles,
};

export function CategoryIcon({ icon, className = 'h-4 w-4' }: { icon: string | null | undefined; className?: string }) {
  const Cmp = (icon && ICONS[icon]) || Sparkles;
  return <Cmp className={className} />;
}

// Jewel-tone pairs for gems without a photo. Picked from the gem id so the
// same gem always gets the same stone.
const STONES = [
  ['#d07a93', '#9a7fc4'], // rose quartz → amethyst
  ['#6f7fc8', '#6fb3bf'], // sapphire → aquamarine
  ['#a283c9', '#6f7fc8'], // amethyst → sapphire
  ['#e0987a', '#d07a93'], // sunstone → rose quartz
  ['#6fae96', '#6f7fc8'], // jade → sapphire
  ['#dcb867', '#d08a7e'], // citrine → garnet
];

function hash(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/** Faceted placeholder art, used wherever a gem has no cover photo. */
export function GemArt({ id, icon, className = '' }: { id: string; icon?: string | null; className?: string }) {
  const h = hash(id);
  const [a, b] = STONES[h % STONES.length];
  const tilt = (h % 3) * 12 - 12;
  const gid = `ga-${id}`;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="white" stopOpacity="0.28" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g transform={`rotate(${tilt} 100 60)`}>
          <path d="M60 10h80l40 40-80 70-80-70z" fill={`url(#${gid})`} />
          <path d="M20 50h160M60 10l20 40 20 70 20-70 20-40" stroke="white" strokeOpacity="0.35" strokeWidth="1.2" fill="none" />
          <path d="M80 50l20-40 20 40" stroke="white" strokeOpacity="0.25" strokeWidth="1.2" fill="none" />
        </g>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="rounded-2xl bg-white/20 p-3 text-white backdrop-blur-sm">
          <CategoryIcon icon={icon} className="h-6 w-6" />
        </span>
      </div>
    </div>
  );
}

/** Photo-first gem card. `featured` makes a tall card with the title over the image. */
export function GemCard({ gem, onOpen, featured = false }: { gem: Gem; onOpen: () => void; featured?: boolean }) {
  const media = gem.cover_image_url ? (
    <img src={gem.cover_image_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
  ) : (
    <GemArt id={gem.id} icon={gem.category?.icon} className="h-full w-full" />
  );

  if (featured) {
    return (
      <button onClick={onOpen} className="group relative block h-72 w-full overflow-hidden rounded-4xl text-left shadow-card-hover sm:h-80">
        <div className="absolute inset-0">{media}</div>
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
          {gem.category && (
            <span className="badge mb-3 bg-white/20 text-white backdrop-blur">
              <CategoryIcon icon={gem.category.icon} className="h-3 w-3" /> {gem.category.name}
            </span>
          )}
          <h3 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">{gem.title}</h3>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/85">
            <MapPin className="h-4 w-4" /> {gem.place_name}{gem.area ? `, ${gem.area}` : ''}
          </p>
        </div>
      </button>
    );
  }

  return (
    <button onClick={onOpen} className="group card flex flex-col overflow-hidden text-left transition-shadow hover:shadow-card-hover">
      <div className="relative h-40 overflow-hidden">
        {media}
        {gem.category && (
          <span className="badge absolute left-3 top-3 bg-white/90 text-stone-800 backdrop-blur dark:bg-stone-900/80 dark:text-stone-100">
            <CategoryIcon icon={gem.category.icon} className="h-3 w-3" /> {gem.category.name}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-lg font-bold leading-snug">{gem.title}</h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400">
          <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{gem.place_name}{gem.area ? `, ${gem.area}` : ''}</span>
        </p>
        {gem.community?.name && <p className="mt-auto pt-3 text-xs font-medium text-stone-400">in {gem.community.name}</p>}
      </div>
    </button>
  );
}
