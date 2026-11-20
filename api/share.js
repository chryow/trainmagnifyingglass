// Link preview page for shared gems: /g/<gem id>  (rewritten here by vercel.json)
//
// WhatsApp, Instagram, iMessage etc. read the Open Graph tags below to build
// a preview card. People who open the link see a small card and a button into
// the app. Data comes from get_gem_preview(), which only returns public-safe
// fields for published gems in public communities.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadPreview(id) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key || !UUID.test(id)) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/get_gem_preview`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_gem_id: id }),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const id = String(req.query.id ?? '');
  const origin = `https://${req.headers['x-forwarded-host'] ?? req.headers.host}`;
  const gem = await loadPreview(id);

  const appUrl = `${origin}/gems/${encodeURIComponent(id)}`;
  const shareUrl = `${origin}/g/${encodeURIComponent(id)}`;
  const title = gem ? gem.title : 'A hidden gem on Hidden Gems';
  const where = gem ? [gem.place_name, gem.area].filter(Boolean).join(', ') : '';
  const description = gem
    ? [where, gem.summary].filter(Boolean).join(' · ')
    : 'Find the places everyone else walks past, recommended by people who have been there.';
  const image = gem && gem.cover_image_url ? gem.cover_image_url : `${origin}/og-default.png`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} · Hidden Gems</title>
  <meta name="description" content="${esc(description)}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Hidden Gems">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:url" content="${esc(shareUrl)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(image)}">
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
    font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#1c1433;background:#f8f6ff;
    background-image:radial-gradient(40rem 28rem at 10% -10%,rgba(201,102,133,.10),transparent 60%),radial-gradient(36rem 26rem at 100% 110%,rgba(94,110,194,.10),transparent 60%)}
    .card{width:100%;max-width:420px;background:#fff;border-radius:28px;overflow:hidden;box-shadow:0 18px 40px -12px rgba(28,20,51,.22)}
    .img{height:240px;background:linear-gradient(135deg,#c96685,#8f74c2 52%,#5e6ec2) center/cover}
    .body{padding:22px 24px 26px}.cat{font-size:13px;font-weight:600;color:#b4506f;margin:0 0 6px}
    h1{font-size:26px;line-height:1.15;margin:0 0 6px;letter-spacing:-.02em}.where{color:#736a8f;margin:0 0 12px}
    .sum{color:#403957;margin:0 0 20px;line-height:1.5}.btn{display:block;text-align:center;text-decoration:none;color:#fff;font-weight:600;
    padding:14px 18px;border-radius:16px;background:linear-gradient(135deg,#c96685,#8f74c2 52%,#5e6ec2)}
    .brand{display:flex;align-items:center;gap:8px;justify-content:center;margin-top:16px;color:#736a8f;font-size:14px;text-decoration:none}
  </style>
</head>
<body>
  <main class="card">
    <div class="img"${gem && gem.cover_image_url ? ` style="background-image:url('${esc(gem.cover_image_url)}')"` : ''}></div>
    <div class="body">
      ${gem && gem.category_name ? `<p class="cat">${esc(gem.category_name)}</p>` : ''}
      <h1>${esc(title)}</h1>
      ${where ? `<p class="where">📍 ${esc(where)}</p>` : ''}
      ${gem && gem.summary ? `<p class="sum">${esc(gem.summary)}</p>` : ''}
      <a class="btn" href="${esc(gem ? appUrl : origin + '/')}">${gem ? 'Open in Hidden Gems' : 'Explore Hidden Gems'}</a>
      <a class="brand" href="${esc(origin + '/')}"><img src="/favicon.svg" width="20" height="20" alt="">Hidden Gems</a>
    </div>
  </main>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Cache briefly at the edge; edits to a gem show up within a few minutes
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.status(gem ? 200 : 404).send(html);
}
