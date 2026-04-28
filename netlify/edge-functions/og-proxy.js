// Netlify Edge Function: netlify/edge-functions/og-proxy.js
// Intercepts /job/:id, fetches job from Supabase, returns apply.html with OG tags

const SB_URL = 'https://rdzmwtixtfenmojeugyx.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkem13dGl4dGZlbm1vamV1Z3l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NjcxODUsImV4cCI6MjA5MjM0MzE4NX0.FUHtMO-wRs0B0weWGuDxSbXflx7RsVOGVYbC7kUrn0M';
const SITE_URL = 'https://crm-hr.topgroup4u.com';

export default async (request, context) => {
  const url = new URL(request.url);

  // Extract job ID from path: /job/j1234567890
  const match = url.pathname.match(/^\/job\/(.+)$/);
  if (!match) return context.next();
  const jobId = match[1];

  // Fetch job from Supabase
  let job = null;
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/crm_state?select=data&id=eq.main`,
      { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } }
    );
    const rows = await res.json();
    if (rows?.[0]?.data?.jobs) {
      job = rows[0].data.jobs.find(j => j.id === jobId);
    }
  } catch (e) {}

  // Fetch apply.html
  let html = '';
  try {
    const pageRes = await fetch(`${SITE_URL}/apply.html`);
    html = await pageRes.text();
  } catch (e) {
    return new Response('Error loading page', { status: 500 });
  }

  if (!job) {
    // No job found — return apply.html as-is
    return new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
  }

  const title = `${job.publishTitle || job.title} | טופ גרופ גיוס והשמה`;
  const description = `📍 ${job.location || ''} | 💼 ${job.type || ''} | ${job.domain || ''} – הגש מועמדות עכשיו דרך טופ גרופ גיוס והשמה`;
  const image = job.imageUrl || `${SITE_URL}/og-default.png`;
  const pageUrl = request.url;

  const ogTags = `<meta property="og:title" content="${ea(title)}">
  <meta property="og:description" content="${ea(description)}">
  <meta property="og:image" content="${ea(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${ea(pageUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="טופ גרופ גיוס והשמה">
  <meta property="og:locale" content="he_IL">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${ea(title)}">
  <meta name="twitter:description" content="${ea(description)}">
  <meta name="twitter:image" content="${ea(image)}">
  <title>${ea(title)}</title>`;

  let newHtml = html
    .replace(/<title>[^<]*<\/title>/gi, '')
    .replace(/<meta\s+[^>]*property="og:[^"]*"[^>]*>/gi, '')
    .replace(/<meta\s+[^>]*name="twitter:[^"]*"[^>]*>/gi, '')
    .replace(/<!--[^>]*-->/gi, '')
    .replace('</head>', `  ${ogTags}\n</head>`);

  return new Response(newHtml, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-cache',
    },
  });
};

function ea(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const config = { path: '/job/*' };
