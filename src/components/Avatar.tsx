export function Avatar({ url, name, size = 40 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={`${name}'s avatar`}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gem font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-prose text-[15px] text-stone-500 dark:text-stone-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
