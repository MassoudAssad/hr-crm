// Netlify Edge Function: netlify/edge-functions/og-proxy.js
// Reads ?id=JOB_ID, fetches job from Supabase, injects OG tags server-side

const SB_URL = 'https://rdzmwtixtfenmojeugyx.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkem13dGl4dGZlbm1vamV1Z3l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NjcxODUsImV4cCI6MjA5MjM0MzE4NX0.FUHtMO-wRs0B0weWGuDxSbXflx7RsVOGVYbC7kUrn0M';
const SITE_URL = 'https://crm-hr.topgroup4u.com';

export default async (request, context) => {
  const url = new URL(request.url);
  const jobId = url.searchParams.get('id');

  // No ?id= param — serve page normally
  if (!jobId) {
    return context.next();
  }

  // Fetch job data from Supabase
  let job = null;
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/crm_state?select=data&id=eq.main`,
      {
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );
    const rows = await res.json();
    if (rows && rows[0] && rows[0].data && rows[0].data.jobs) {
      job = rows[0].data.jobs.find(j => j.id === jobId);
    }
  } catch (e) {
    return context.next();
  }

  if (!job) {
    return context.next();
  }

  // Fetch apply.html directly from the site
  let html = '';
  try {
    const pageRes = await fetch(`${SITE_URL}/apply.html`, {
      headers: { 'User-Agent': 'Netlify-Edge-Function' }
    });
    html = await pageRes.text();
  } catch (e) {
    return context.next();
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

export const config = { path: '/apply.html' };
