import { useNavigate } from '@/lib/router';
import { Logo } from '@/components/Logo';
import { GemArt } from '@/components/GemCard';
import { MapPin, Users, ShieldCheck, Bookmark } from 'lucide-react';

// Sample finds shown in the hero. Fanned like cards dealt onto a table.
const SAMPLE_GEMS = [
  { id: 'sample-reading-corner', icon: 'coffee', category: 'Cafés', title: 'The Reading Corner', place: 'Menteng, Jakarta', rotate: '-rotate-6', offset: 'translate-y-4' },
  { id: 'sample-sunset-point', icon: 'mountain', category: 'Viewpoints', title: 'Sunset Point', place: 'Sekotong, Lombok', rotate: 'rotate-0', offset: '-translate-y-4 z-10' },
  { id: 'sample-pak-bejo', icon: 'utensils', category: 'Food', title: 'Warung Pak Bejo', place: 'Kemang, Jakarta', rotate: 'rotate-6', offset: 'translate-y-6' },
];

const FEATURES = [
  { icon: Users, title: 'Recommended by people, not ads', desc: 'Every gem is shared by a member of a community, for a place they actually go back to.' },
  { icon: ShieldCheck, title: 'Kept accurate by the community', desc: 'Members confirm when details are still right, and suggest fixes when a place changes.' },
  { icon: Bookmark, title: 'Collections you can share', desc: 'Save gems into lists like "Rainy-day cafés" and share them with friends.' },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="auth-bg min-h-screen overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Logo className="h-10 w-10" />
          <span className="font-display text-xl font-extrabold">Hidden Gems</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/login')} className="btn-ghost">Sign in</button>
          <button onClick={() => navigate('/register')} className="btn-primary hidden sm:inline-flex">Join free</button>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-8 sm:px-6 sm:pt-14 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h1 className="font-display text-5xl font-extrabold leading-[0.98] sm:text-6xl lg:text-7xl">
              Find the places everyone else walks past.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-stone-600 dark:text-stone-300">
              A community for sharing overlooked cafés, quiet viewpoints and the warung only locals know about.
              Recommended because they're worth it, never because someone paid.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => navigate('/register')} className="btn-primary px-7 py-3.5 text-base">Start exploring</button>
              <button onClick={() => navigate('/login')} className="btn-outline px-7 py-3.5 text-base">I have an account</button>
            </div>
          </div>

          {/* Dealt cards: overlapping, each tilted a little */}
          <div className="flex items-center justify-center py-6" aria-hidden>
            {SAMPLE_GEMS.map((g, i) => (
              <div
                key={g.id}
                className={`relative w-44 shrink-0 sm:w-56 ${i > 0 ? '-ml-24 sm:-ml-28' : ''} ${g.rotate} ${g.offset} rounded-3xl bg-white p-2 shadow-card-hover transition-transform duration-300 hover:-translate-y-3 dark:bg-stone-900`}
              >
                <GemArt id={g.id} icon={g.icon} className="h-36 rounded-2xl sm:h-48" />
                <div className="px-2 pb-2 pt-3">
                  <p className="text-xs font-semibold text-primary-600 dark:text-primary-400">{g.category}</p>
                  <p className="font-display text-base font-bold leading-tight sm:text-lg">{g.title}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500"><MapPin className="h-3 w-3" />{g.place}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* What makes it different */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-900 text-white dark:bg-white dark:text-stone-900">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-xl font-bold">{f.title}</h3>
                <p className="mt-2 leading-relaxed text-stone-600 dark:text-stone-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing call to action */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="relative overflow-hidden rounded-4xl bg-gem px-6 py-14 text-center text-white sm:px-12">
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-extrabold leading-tight sm:text-5xl">
              Know a place worth sharing?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-white/85">Join a community near you and post your first gem in a couple of minutes.</p>
            <button onClick={() => navigate('/register')} className="btn mt-8 bg-white px-7 py-3.5 text-base text-stone-900 hover:bg-stone-100">
              Create your account
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200/70 py-8 dark:border-stone-800">
        <div className="mx-auto max-w-5xl px-4">
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-stone-500">
            <a href="#/privacy" className="hover:text-stone-800 dark:hover:text-stone-200">Privacy</a>
            <a href="#/terms" className="hover:text-stone-800 dark:hover:text-stone-200">Terms</a>
            <a href="#/guidelines" className="hover:text-stone-800 dark:hover:text-stone-200">Community guidelines</a>
            <a href="#/accuracy" className="hover:text-stone-800 dark:hover:text-stone-200">Accuracy</a>
            <a href="#/content-guidelines" className="hover:text-stone-800 dark:hover:text-stone-200">Content guidelines</a>
            <a href="#/deletion-info" className="hover:text-stone-800 dark:hover:text-stone-200">Account deletion</a>
            <a href="#/support" className="hover:text-stone-800 dark:hover:text-stone-200">Support</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
