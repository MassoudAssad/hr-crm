exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  const { employerName, contactName, contactPhone, title, domain, type, location, salary, positions } = JSON.parse(event.body || '{}');

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'RESEND_API_KEY missing' }) };
  }

  const payload = {
    from: 'HR Recruitment <mass@topgroup4u.com>',
    to: 'mass@topgroup4u.com',
    subject: `דרישות משרה חדשות: ${employerName || 'מעסיק'}${title ? ' – ' + title : ''}`,
    html: `
      <div dir="rtl" style="font-family:Arial;padding:20px">
        <h2>דרישות משרה חדשות התקבלו</h2>
        <p><strong>מעסיק:</strong> ${employerName || 'לא צוין'}</p>
        <p><strong>איש קשר:</strong> ${contactName || 'לא צוין'}${contactPhone ? ' · ' + contactPhone : ''}</p>
        <p><strong>תפקיד:</strong> ${title || 'לא צוין'}</p>
        <p><strong>תחום:</strong> ${domain || 'לא צוין'}</p>
        <p><strong>סוג משרה:</strong> ${type || 'לא צוין'}</p>
        <p><strong>מיקום:</strong> ${location || 'לא צוין'}</p>
        <p><strong>שכר:</strong> ${salary || 'לא צוין'}</p>
        <p><strong>מספר משרות:</strong> ${positions || 'לא צוין'}</p>
      </div>
    `
  };

  console.log('Sending job-intake email via Resend to:', payload.to);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const resBody = await res.json();

  if (!res.ok) {
    console.error('Resend error:', JSON.stringify(resBody));
    return { statusCode: 500, body: JSON.stringify({ error: resBody }) };
  }

  console.log('Job-intake email sent successfully:', resBody.id);
  return { statusCode: 200, body: JSON.stringify({ ok: true, id: resBody.id }) };
};
