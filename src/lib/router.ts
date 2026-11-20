import { useEffect, useState, useCallback, type MouseEvent } from 'react';

// Minimal client-side router using normal URLs (/gems/123) and the History API.
// Vercel rewrites every non-file path to index.html (see vercel.json).

export interface Route {
  path: string;
  params: Record<string, string>;
}

const NAV_EVENT = 'hg:navigate';

/**
 * Old links used hash routes (/#/gems/123). Rewrite them to the clean URL once
 * on load so bookmarks and shared links keep working. Supabase auth hashes
 * (#access_token=…) are left alone for supabase-js to read.
 */
function upgradeLegacyHashUrl() {
  const { hash } = window.location;
  if (hash.startsWith('#/')) {
    window.history.replaceState(window.history.state, '', hash.slice(1));
  }
}
upgradeLegacyHashUrl();

function readLocation(): Route {
  const params: Record<string, string> = {};
  new URLSearchParams(window.location.search).forEach((v, k) => (params[k] = v));
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return { path, params };
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const url = to.startsWith('/') ? to : `/${to}`;
  if (url === window.location.pathname + window.location.search) return;
  if (opts.replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
  window.dispatchEvent(new Event(NAV_EVENT));
  window.scrollTo(0, 0);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(readLocation);
  useEffect(() => {
    const onChange = () => setRoute(readLocation());
    window.addEventListener('popstate', onChange);
    window.addEventListener(NAV_EVENT, onChange);
    return () => {
      window.removeEventListener('popstate', onChange);
      window.removeEventListener(NAV_EVENT, onChange);
    };
  }, []);
  return route;
}

export function useNavigate() {
  return useCallback((path: string) => navigate(path), []);
}

/**
 * onClick handler for <a href="/path"> links: navigates in-app for normal
 * clicks, but lets Ctrl/Cmd-click and middle-click open a new tab.
 */
export function linkTo(path: string) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(path);
  };
}

// Remember where a signed-out visitor was going (e.g. a shared gem link) so
// they land there after signing in instead of on Discover.
const RETURN_KEY = 'hg-return-to';
export function rememberReturnTo(path: string) {
  try { sessionStorage.setItem(RETURN_KEY, path); } catch { /* storage unavailable */ }
}
export function consumeReturnTo(): string | null {
  try {
    const v = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return v && v.startsWith('/') && !v.startsWith('//') ? v : null;
  } catch { return null; }
}

// Simple matcher: returns matched params or null
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const pParts = pattern.split('/').filter(Boolean);
  const aParts = path.split('/').filter(Boolean);
  if (pParts.length !== aParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pParts.length; i++) {
    if (pParts[i].startsWith(':')) {
      params[pParts[i].slice(1)] = decodeURIComponent(aParts[i]);
    } else if (pParts[i] !== aParts[i]) {
      return null;
    }
  }
  return params;
}
