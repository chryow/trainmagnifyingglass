import { useState, useEffect } from 'react';
import { getEvidenceSignedUrl } from '@/lib/upload';

export function EvidenceLink({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getEvidenceSignedUrl(path)
      .then((signed) => { if (!cancelled) { setUrl(signed); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path]);

  if (loading) return <span className="text-xs text-stone-400">Loading evidence…</span>;
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline dark:text-primary-400">View evidence</a>
  );
}

export function EvidenceThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEvidenceSignedUrl(path)
      .then((signed) => { if (!cancelled) setUrl(signed); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [path]);

  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block">
      <img src={url} alt="Evidence" className="h-16 w-16 rounded-lg object-cover" />
    </a>
  );
}
