import { MapPin, Sparkles } from 'lucide-react';

// A faceted gem: the crown and pavilion facets are shaded separately so the
// mark reads as cut stone at small sizes.
export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Hidden Gems logo" fill="none">
      <defs>
        <linearGradient id="hg-gem" x1="6" y1="6" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c96685" />
          <stop offset="0.52" stopColor="#8f74c2" />
          <stop offset="1" stopColor="#5e6ec2" />
        </linearGradient>
      </defs>
      <path d="M14 7h20l10 11-20 25L4 18 14 7z" fill="url(#hg-gem)" />
      <path d="M4 18h40L24 43 4 18z" fill="#1c1433" fillOpacity="0.18" />
      <path d="M14 7l4 11h12l4-11" stroke="white" strokeOpacity="0.55" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4 18h40M18 18l6 25 6-25" stroke="white" strokeOpacity="0.55" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="35.5" cy="11.5" r="2.5" fill="#e6c675" />
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
      <span className="font-display text-lg font-bold tracking-tight">
        Hidden Gems
      </span>
    </div>
  );
}

export function SparklePin({ className = 'h-5 w-5' }: { className?: string }) {
  return <Sparkles className={className} />;
}
