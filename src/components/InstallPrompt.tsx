import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'hg-install-dismissed';

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - at < 30 * 86400000; // ask again after 30 days
  } catch { return false; }
}

/**
 * Small "Add to home screen" card shown on Discover. Android/desktop Chrome
 * get a one-tap install; iPhone (no install API) gets the Share → Add to Home
 * Screen hint. Hidden when already installed or recently dismissed.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(dismissedRecently);
  const standalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (hidden || standalone || (!deferred && !isIOS)) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* storage unavailable */ }
    setHidden(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === 'accepted') setHidden(true);
  };

  return (
    <div className="card flex items-center gap-3 p-4">
      <img src="/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Add Hidden Gems to your home screen</p>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {deferred ? 'Opens full screen, like an app.' : <>Tap <Share className="inline h-3.5 w-3.5" /> Share, then “Add to Home Screen”.</>}
        </p>
      </div>
      {deferred && <button onClick={install} className="btn-primary shrink-0 py-2"><Download className="h-4 w-4" /> Install</button>}
      <button onClick={dismiss} className="shrink-0 rounded-xl p-1.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800" aria-label="Not now"><X className="h-4 w-4" /></button>
    </div>
  );
}
