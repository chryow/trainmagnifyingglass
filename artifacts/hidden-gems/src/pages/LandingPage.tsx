import { useNavigate } from '@/lib/router';
import { Logo } from '@/components/Logo';
import { MapPin, Sparkles, Users, ShieldCheck, Compass } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  const features = [
    { icon: Compass, title: 'Discover through trust', desc: 'Find overlooked places recommended by real people — not by ads or rankings.' },
    { icon: Users, title: 'Community-driven', desc: 'Join location and interest communities that match what you care about.' },
    { icon: ShieldCheck, title: 'Accurate by design', desc: 'Members confirm whether information is still current, so you can rely on it.' },
    { icon: Sparkles, title: 'Collect your gems', desc: 'Save, organize, and share the places that matter to you into collections.' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50/50 via-stone-50 to-stone-50 dark:from-stone-900 dark:via-stone-950 dark:to-stone-950">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <Logo className="h-9 w-9" />
          <span className="font-display text-xl font-semibold">Hidden Gems</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/login')} className="btn-ghost">Sign in</button>
          <button onClick={() => navigate('/register')} className="btn-primary">Get started</button>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="animate-slide-up">
              <div className="badge bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300">
                <MapPin className="h-3 w-3" /> Community discovery
              </div>
              <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Find the places <span className="text-primary-600">everyone else</span> walks past.
              </h1>
              <p className="mt-5 max-w-md text-lg text-stone-600 dark:text-stone-300">
                Hidden Gems is a community where people share overlooked places, local experiences, and quiet discoveries — recommended because they're worth it, not because they paid.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button onClick={() => navigate('/register')} className="btn-primary px-6 py-3 text-base">
                  Start exploring
                </button>
                <button onClick={() => navigate('/login')} className="btn-outline px-6 py-3 text-base">
                  I have an account
                </button>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="grid grid-cols-2 gap-4">
                <div className="card mt-8 overflow-hidden">
                  <div className="h-44 bg-gradient-to-br from-primary-300 to-primary-500" />
                  <div className="p-4">
                    <p className="text-xs font-medium text-primary-600">Cafés</p>
                    <p className="font-display text-base font-semibold">The Reading Corner</p>
                    <p className="text-xs text-stone-500">A quiet study café in Menteng</p>
                  </div>
                </div>
                <div className="card overflow-hidden">
                  <div className="h-44 bg-gradient-to-br from-accent-300 to-accent-500" />
                  <div className="p-4">
                    <p className="text-xs font-medium text-accent-600">Scenic Views</p>
                    <p className="font-display text-base font-semibold">Sunset Point Lombok</p>
                    <p className="text-xs text-stone-500">Peaceful overlook, best at dusk</p>
                  </div>
                </div>
                <div className="card overflow-hidden">
                  <div className="h-44 bg-gradient-to-br from-amber-300 to-amber-500" />
                  <div className="p-4">
                    <p className="text-xs font-medium text-amber-600">Food and Drinks</p>
                    <p className="font-display text-base font-semibold">Warung Pak Bejo</p>
                    <p className="text-xs text-stone-500">Underrated local food stall</p>
                  </div>
                </div>
                <div className="card mt-8 overflow-hidden">
                  <div className="h-44 bg-gradient-to-br from-stone-400 to-stone-600" />
                  <div className="p-4">
                    <p className="text-xs font-medium text-stone-600">Books</p>
                    <p className="font-display text-base font-semibold">Shelf &amp; Co.</p>
                    <p className="text-xs text-stone-500">Small independent bookstore</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="card p-5 transition-shadow hover:shadow-card-hover">
                <div className="mb-3 w-fit rounded-xl bg-primary-50 p-2.5 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-20 text-center sm:px-6">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">Discoveries worth sharing, not selling.</h2>
          <p className="mt-3 text-stone-600 dark:text-stone-400">No popularity scores. No sponsored rankings. Just trusted recommendations from people who've been there.</p>
          <button onClick={() => navigate('/register')} className="btn-primary mt-6 px-6 py-3 text-base">Create your account</button>
        </section>
      </main>

      <footer className="border-t border-stone-200 py-8 dark:border-stone-800">
        <div className="mx-auto max-w-4xl px-4">
          <p className="mb-3 text-center text-sm text-stone-400">Hidden Gems — a community discovery app</p>
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-stone-400">
            <a href="#/privacy" className="hover:text-stone-600 dark:hover:text-stone-300">Privacy Overview</a>
            <a href="#/terms" className="hover:text-stone-600 dark:hover:text-stone-300">Terms of Use</a>
            <a href="#/guidelines" className="hover:text-stone-600 dark:hover:text-stone-300">Community Guidelines</a>
            <a href="#/accuracy" className="hover:text-stone-600 dark:hover:text-stone-300">Accuracy Disclaimer</a>
            <a href="#/content-guidelines" className="hover:text-stone-600 dark:hover:text-stone-300">Content Guidelines</a>
            <a href="#/deletion-info" className="hover:text-stone-600 dark:hover:text-stone-300">Account Deletion</a>
            <a href="#/support" className="hover:text-stone-600 dark:hover:text-stone-300">Contact &amp; Support</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
