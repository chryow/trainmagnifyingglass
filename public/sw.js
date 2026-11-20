/*
 * Minimal service worker: makes the app installable and shows a friendly
 * offline page. It deliberately does NOT cache the app itself, so every
 * deploy is picked up immediately (no stale versions after an update).
 */
const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Hidden Gems</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#f8f6ff;color:#1c1433;text-align:center;padding:24px}
h1{font-size:24px;margin:16px 0 8px}p{color:#736a8f;margin:0 0 20px}button{border:0;border-radius:16px;padding:12px 20px;font-weight:600;color:#fff;background:linear-gradient(135deg,#c96685,#8f74c2 52%,#5e6ec2)}</style></head>
<body><div><img src="/icon-192.png" width="72" height="72" alt=""><h1>You're offline</h1><p>Hidden Gems needs a connection. Check your signal and try again.</p><button onclick="location.reload()">Try again</button></div></body></html>`;

self.addEventListener('install', (event) => {
  // Cache only the icon used by the offline page
  event.waitUntil(caches.open('hg-offline-v1').then((c) => c.add('/icon-192.png')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
    return;
  }
  if (new URL(req.url).pathname === '/icon-192.png') {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});
