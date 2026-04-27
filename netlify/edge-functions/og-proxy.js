// Netlify Edge Function: netlify/edge-functions/og-proxy.js
// This function intercepts requests to apply.html and injects OG tags server-side

export default async (request, context) => {
  const url = new URL(request.url);
  const jobParam = url.searchParams.get('job');

  if (!jobParam) {
    return context.next();
  }

  // Decode the job data
  let job = null;
  try {
    const decoded = decodeURIComponent(jobParam);
    try {
      job = JSON.parse(decodeURIComponent(escape(atob(decoded))));
    } catch {
      const bytes = Uint8Array.from(atob(decoded), c => c.charCodeAt(0));
      job = JSON.parse(new TextDecoder().decode(bytes));
    }
  } catch (e) {
    return context.next();
  }

  if (!job) return context.next();

  // Fetch the original apply.html
  const response = await context.next();
  const html = await response.text();

  const title = `${job.publishTitle || job.title} | טופ גרופ גיוס והשמה`;
  const description = `📍 ${job.location || ''} | 💼 ${job.type || ''} | ${job.domain || ''} – הגש מועמדות עכשיו!`;
  const image = job.imageUrl || 'https://crm-hr.topgroup4u.com/og-default.png';
  const pageUrl = request.url;

  // Inject OG tags into <head>
  const ogTags = `
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="טופ גרופ גיוס והשמה">
  <meta property="og:locale" content="he_IL">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${image}">
  <title>${title}</title>`;

  // Replace existing meta tags and title
  let newHtml = html
    .replace(/<title>[^<]*<\/title>/, '')
    .replace(/<!-- Open Graph[^>]*-->[\s\S]*?<!-- Twitter Card -->[\s\S]*?<meta name="twitter:image"[^>]*>/, '')
    .replace('</head>', ogTags + '\n</head>');

  return new Response(newHtml, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
};

export const config = { path: '/apply.html' };
