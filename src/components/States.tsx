import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ size = 24, className = '' }: { size?: number; className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} size={size} aria-hidden />;
}

export function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-stone-50 dark:bg-stone-950">
      <LoadingSpinner size={32} className="text-primary-500" />
      <p className="text-sm text-stone-500 dark:text-stone-400">{label}</p>
    </div>
  );
}

interface StateContainerProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

// A soft faceted-gem illustration behind the icon, so empty screens feel
// intentional rather than broken.
function GemIllustration({ children }: { children?: ReactNode }) {
  return (
    <div className="relative mb-2 h-28 w-32" aria-hidden>
      <svg viewBox="0 0 128 112" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="empty-gem" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#c96685" stopOpacity="0.22" />
            <stop offset="0.5" stopColor="#8f74c2" stopOpacity="0.2" />
            <stop offset="1" stopColor="#5e6ec2" stopOpacity="0.22" />
          </linearGradient>
        </defs>
        <path d="M36 14h56l26 28-54 62L10 42z" fill="url(#empty-gem)" />
        <path d="M10 42h108M36 14l12 28 16 62 16-62 12-28M48 42l16-28 16 28" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1.5" />
        <circle cx="104" cy="16" r="4" fill="#e6c675" fillOpacity="0.8" />
        <circle cx="18" cy="24" r="2.5" fill="#8f74c2" fillOpacity="0.5" />
      </svg>
      <div className="absolute inset-x-0 top-[34%] flex justify-center text-primary-600 dark:text-primary-300">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: StateContainerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center text-stone-400">
      <GemIllustration>{icon}</GemIllustration>
      <h3 className="font-display text-xl font-bold text-stone-900 dark:text-stone-50">{title}</h3>
      {description && <p className="max-w-sm text-sm text-stone-500 dark:text-stone-400">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', description, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="rounded-2xl bg-error-50 p-4 text-error-600 dark:bg-error-950/40 dark:text-error-500">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-stone-500 dark:text-stone-400">{description}</p>}
      {onRetry && (
        <button onClick={onRetry} className="btn-outline mt-2">
          Try again
        </button>
      )}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton h-40 w-full" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
        <div className="flex gap-2 pt-2">
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}
