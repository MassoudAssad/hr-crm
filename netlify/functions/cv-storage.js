const crypto = require('crypto');

const SB_URL = 'https://rdzmwtixtfenmojeugyx.supabase.co';
const BUCKET = 'candidate-cvs';
const ALLOWED_TYPES = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' }) };
  }
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const action = event.queryStringParameters && event.queryStringParameters.action;
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  // ── action=upload-url: mint a one-time signed URL the browser uploads directly to ──
  if (action === 'upload-url') {
    const ext = ALLOWED_TYPES[body.contentType];
    if (!ext) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Unsupported file type' }) };
    }
    const path = `cv-${Date.now()}-${crypto.randomUUID()}.${ext}`;

    console.log('Requesting upload-url for path:', path);

    const res = await fetch(`${SB_URL}/storage/v1/object/upload/sign/${BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json',
      },
    });
    const resBody = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('Supabase upload-url error:', JSON.stringify(resBody));
      return { statusCode: 500, body: JSON.stringify({ error: resBody }) };
    }

    // Returning the raw upstream response alongside our own fields while we
    // confirm the exact shape via isolated curl testing (not yet wired to apply.html).
    return {
      statusCode: 200,
      body: JSON.stringify({ path, raw: resBody }),
    };
  }

  // ── action=read-url: mint a long-lived signed URL for viewing an already-uploaded CV ──
  if (action === 'read-url') {
    const path = body.path;
    if (!path) return { statusCode: 400, body: JSON.stringify({ error: 'path is required' }) };

    const expiresIn = 315360000; // requested 10 years - verifying Supabase's real max via this isolated test
    console.log('Requesting read-url for path:', path, 'expiresIn:', expiresIn);

    const res = await fetch(`${SB_URL}/storage/v1/object/sign/${BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn }),
    });
    const resBody = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('Supabase read-url error:', JSON.stringify(resBody));
      return { statusCode: 500, body: JSON.stringify({ error: resBody }) };
    }

    const signedPath = resBody.signedURL || resBody.signedUrl || null;
    const url = signedPath ? `${SB_URL}/storage/v1${signedPath}` : null;

    return {
      statusCode: 200,
      body: JSON.stringify({ url, raw: resBody }),
    };
  }

  return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
};
