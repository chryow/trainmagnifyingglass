import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useRoute, linkTo } from '@/lib/router';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/Logo';
import {
  ArrowLeft, Shield, ScrollText, HeartHandshake, BadgeCheck, ImageIcon, UserX, LifeBuoy, Info, Check,
} from 'lucide-react';

// Every help/policy page, in the order shown in the page switcher
export const POLICY_PAGES = [
  { path: '/terms', label: 'Terms of use', icon: ScrollText },
  { path: '/privacy', label: 'Privacy', icon: Shield },
  { path: '/guidelines', label: 'Community guidelines', icon: HeartHandshake },
  { path: '/content-guidelines', label: 'Content guidelines', icon: ImageIcon },
  { path: '/accuracy', label: 'Accuracy', icon: BadgeCheck },
  { path: '/deletion-info', label: 'Account deletion', icon: UserX },
  { path: '/support', label: 'Help & support', icon: LifeBuoy },
] as const;

interface Section { id: string; title: string }

interface Props {
  title: string;
  subtitle?: string;
  /** Optional plain-language highlights shown above the full text */
  summary?: string[];
  children: ReactNode;
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * Shared layout for the help & policy pages. Builds the "On this page" list
 * from the <h2> headings inside `children`, so page files only contain text.
 */
export default function PolicyPage({ title, subtitle, summary, children }: Props) {
  const navigate = useNavigate();
  const route = useRoute();
  const { session } = useAuth();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const current = POLICY_PAGES.find((p) => p.path === route.path);
  const Icon = current?.icon ?? Info;

  // Give each heading an id and collect them for the contents list
  useEffect(() => {
    const headings = Array.from(bodyRef.current?.querySelectorAll('h2') ?? []);
    const found = headings.map((h) => {
      if (!h.id) h.id = slugify(h.textContent ?? '');
      return { id: h.id, title: h.textContent ?? '' };
    });
    setSections(found);
    setActiveId(found[0]?.id ?? null);

    // Highlight the section currently being read
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-15% 0px -70% 0px' },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [route.path]);

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setActiveId(id);
  };

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else navigate(session ? '/discover' : '/');
  };

  const content = (
    <div className="space-y-8">
      <button onClick={goBack} className="flex items-center gap-1 text-sm font-medium text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gem text-white shadow-glow">
          <Icon className="h-7 w-7" />
        </span>
        <div>
          <h1 className="font-display text-4xl font-extrabold leading-tight sm:text-5xl">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-prose text-lg text-stone-500 dark:text-stone-400">{subtitle}</p>}
        </div>
      </header>

      {/* Contents on phones: a row of chips */}
      {sections.length > 1 && (
        <nav aria-label="On this page" className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 lg:hidden">
          {sections.map((s) => (
            <button key={s.id} onClick={() => jumpTo(s.id)} className="shrink-0 rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-sm font-medium text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300">
              {s.title}
            </button>
          ))}
        </nav>
      )}

      <div className="grid gap-8 lg:grid-cols-[13rem_1fr] lg:gap-12">
        {/* Contents on desktop: sticky list with the current section highlighted */}
        <aside className="hidden lg:block">
          {sections.length > 1 && (
            <nav aria-label="On this page" className="sticky top-8">
              <p className="mb-3 text-sm font-semibold text-stone-900 dark:text-stone-100">On this page</p>
              <ul className="space-y-0.5 border-l-2 border-stone-200 dark:border-stone-800">
                {sections.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => jumpTo(s.id)}
                      aria-current={activeId === s.id ? 'location' : undefined}
                      className={`-ml-0.5 block w-full border-l-2 py-1.5 pl-4 text-left text-sm transition-colors ${
                        activeId === s.id
                          ? 'border-primary-500 font-semibold text-primary-700 dark:text-primary-300'
                          : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
                      }`}
                    >
                      {s.title}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </aside>

        <div className="min-w-0 space-y-8">
          {summary && summary.length > 0 && (
            <section aria-label="In short" className="max-w-prose rounded-3xl bg-primary-50 p-5 dark:bg-primary-500/10 sm:p-6">
              <p className="mb-3 font-display text-lg font-bold text-stone-900 dark:text-stone-50">In short</p>
              <ul className="space-y-2.5">
                {summary.map((point) => (
                  <li key={point} className="flex gap-3 text-[15px] leading-relaxed text-stone-700 dark:text-stone-300">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" strokeWidth={3} />
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <article
            ref={bodyRef}
            className="max-w-prose text-[16px] leading-[1.75] text-stone-700 dark:text-stone-300
              [&_h2]:mb-2 [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:leading-snug [&_h2]:text-stone-900 [&>h2:first-child]:mt-0 dark:[&_h2]:text-stone-50
              [&_p]:mb-4
              [&_ul]:mb-4 [&_ul]:space-y-2
              [&_li]:relative [&_li]:pl-6 [&_li]:before:absolute [&_li]:before:left-1 [&_li]:before:top-[0.7em] [&_li]:before:h-2 [&_li]:before:w-2 [&_li]:before:rounded-full [&_li]:before:bg-primary-300 dark:[&_li]:before:bg-primary-500
              [&_strong]:font-semibold [&_strong]:text-stone-900 dark:[&_strong]:text-stone-100"
          >
            {children}
          </article>

          <p className="flex max-w-prose items-start gap-2.5 rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-500 dark:bg-stone-800/60 dark:text-stone-400">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            This is draft wording. The app owner should have it reviewed before a wide public launch.
          </p>

          {/* Switch between the other help & policy pages */}
          <nav aria-label="Help and policies" className="border-t border-stone-200 pt-8 dark:border-stone-800">
            <p className="mb-3 font-display text-lg font-bold">More help & policies</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {POLICY_PAGES.filter((p) => p.path !== route.path).map((p) => (
                <a
                  key={p.path}
                  href={p.path}
                  onClick={linkTo(p.path)}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3 font-medium shadow-card transition-shadow hover:shadow-card-hover dark:bg-stone-900"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"><p.icon className="h-4 w-4" /></span>
                  {p.label}
                </a>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );

  // Signed in: the app shell already provides navigation
  if (session) return content;

  // Signed out (opened from the landing page or sign-up form): add a simple header
  return (
    <div className="auth-bg min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <a href="/" onClick={linkTo('/')} className="flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <span className="font-display text-xl font-extrabold">Hidden Gems</span>
        </a>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/login')} className="btn-ghost">Sign in</button>
          <button onClick={() => navigate('/register')} className="btn-primary hidden sm:inline-flex">Join free</button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-4 sm:px-6">{content}</main>
    </div>
  );
}
