// ONE-TIME migration tool: moves candidate CVs from the old public
// job-images bucket to the private candidate-cvs bucket, and updates
// each affected candidate's cvUrl in crm_state accordingly.
//
// This file is temporary by design - delete it once the migration is
// run and verified. It is NOT part of the app's permanent architecture.

const SB_URL = 'https://rdzmwtixtfenmojeugyx.supabase.co';
const OLD_MARKER = '/storage/v1/object/public/job-images/';
const SIGN_EXPIRES_IN = 315360000; // 10 years, confirmed honored exactly by Supabase

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' }) };
  }
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const mode = (event.queryStringParameters && event.queryStringParameters.mode) || 'dry-run';

  if (mode !== 'dry-run' && mode !== 'execute' && mode !== 'lookup') {
    return { statusCode: 400, body: JSON.stringify({ error: 'mode must be dry-run, execute, or lookup' }) };
  }

  // Fetch the full crm_state blob using service_role (bypasses RLS entirely)
  const stateRes = await fetch(`${SB_URL}/rest/v1/crm_state?select=data&id=eq.main`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Accept': 'application/json' },
  });
  const stateRows = await stateRes.json().catch(() => null);
  if (!stateRes.ok || !stateRows || !stateRows[0]) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch crm_state', details: stateRows }) };
  }
  const data = stateRows[0].data || {};
  const candidates = data.candidates || [];

  // Temporary diagnostic: name-only lookup by id, for manually spot-checking
  // migrated candidates in the CRM UI (which can't search by candidateId).
  if (mode === 'lookup') {
    const ids = ((event.queryStringParameters && event.queryStringParameters.ids) || '').split(',').map(s => s.trim()).filter(Boolean);
    const found = candidates.filter(c => ids.includes(c.id)).map(c => ({ id: c.id, name: c.name }));
    return { statusCode: 200, body: JSON.stringify({ mode: 'lookup', found }) };
  }

  // A candidate needs migration only if ITS OWN cvUrl still points at the
  // old public bucket - no filename guessing, no cross-referencing.
  const targets = candidates.filter(c => typeof c.cvUrl === 'string' && c.cvUrl.includes(OLD_MARKER));

  if (mode === 'dry-run') {
    const preview = targets.map(c => ({
      candidateId: c.id,
      sourceKey: c.cvUrl.split(OLD_MARKER)[1],
    }));
    return {
      statusCode: 200,
      body: JSON.stringify({
        mode: 'dry-run',
        totalCandidates: candidates.length,
        matchedForMigration: targets.length,
        preview,
      }),
    };
  }

  // ── mode === 'execute' ──
  const results = [];
  const updates = {}; // candidateId -> new signed url, successes only

  for (const c of targets) {
    const sourceKey = c.cvUrl.split(OLD_MARKER)[1];
    try {
      // 1. Download the bytes from the still-working old public URL
      const fileRes = await fetch(c.cvUrl);
      if (!fileRes.ok) throw new Error(`download failed: HTTP ${fileRes.status}`);
      const arrayBuffer = await fileRes.arrayBuffer();
      const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';

      // 2. Upload directly into candidate-cvs with service_role - bypasses
      //    RLS entirely, no signed-upload-url dance needed server-side.
      const upRes = await fetch(`${SB_URL}/storage/v1/object/candidate-cvs/${sourceKey}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: Buffer.from(arrayBuffer),
      });
      if (!upRes.ok) {
        const upErrText = await upRes.text().catch(() => '');
        throw new Error(`upload failed: HTTP ${upRes.status} ${upErrText}`);
      }

      // 3. Mint a long-lived signed URL for the new location
      const signRes = await fetch(`${SB_URL}/storage/v1/object/sign/candidate-cvs/${sourceKey}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: SIGN_EXPIRES_IN }),
      });
      const signBody = await signRes.json().catch(() => ({}));
      if (!signRes.ok || !signBody.signedURL) throw new Error(`sign failed: ${JSON.stringify(signBody)}`);

      updates[c.id] = `${SB_URL}/storage/v1${signBody.signedURL}`;
      results.push({ candidateId: c.id, status: 'success' });
    } catch (e) {
      // Isolated per-candidate failure - loop continues, this candidate's
      // cvUrl is left untouched (still points at job-images, still works,
      // will be picked up again on a re-run).
      results.push({ candidateId: c.id, status: 'failed', error: String((e && e.message) || e) });
    }
  }

  // Apply all successful updates in a single crm_state write
  if (Object.keys(updates).length > 0) {
    const updatedCandidates = candidates.map(c => (updates[c.id] ? { ...c, cvUrl: updates[c.id] } : c));
    const patchRes = await fetch(`${SB_URL}/rest/v1/crm_state?id=eq.main`, {
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`,
        'Accept': 'application/json', 'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        data: { ...data, candidates: updatedCandidates },
        updated_at: new Date().toISOString(),
      }),
    });
    if (!patchRes.ok) {
      const patchErrText = await patchRes.text().catch(() => '');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'crm_state update failed after uploads succeeded', details: patchErrText, results }),
      };
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      mode: 'execute',
      totalTargets: targets.length,
      succeeded: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      results,
    }),
  };
};
