import { MapPin, Sparkles } from 'lucide-react';

export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Hidden Gems logo" fill="none">
      <path
        d="M24 4C15.16 4 8 11.16 8 20c0 10.5 12.5 20.5 15.05 22.62a1.5 1.5 0 0 0 1.9 0C27.5 40.5 40 30.5 40 20c0-8.84-7.16-16-16-16z"
        fill="currentColor"
        className="text-primary-500"
      />
      <circle cx="24" cy="19" r="7" fill="white" fillOpacity="0.95" />
      <path
        d="M24 13.5l1.6 3.2 3.5.5-2.55 2.48.6 3.52L24 21.5l-3.15 1.7.6-3.52-2.55-2.48 3.5-.5L24 13.5z"
        fill="currentColor"
        className="text-accent-500"
      />
    </svg>
  );
}

export function LogoMark({ className = 'h-5 w-5' }: { className?: string }) {
  return <MapPin className={className} strokeWidth={2.5} />;
}

export function LogoWithText({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Logo className="h-8 w-8" />
      <span className="font-display text-lg font-semibold tracking-tight">
        Hidden Gems
      </span>
    </div>
  );
}

export function SparklePin({ className = 'h-5 w-5' }: { className?: string }) {
  return <Sparkles className={className} />;
}
