exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  const { name, phone, email, jobTitle } = JSON.parse(event.body || '{}');

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'RESEND_API_KEY missing' }) };
  }

  const payload = {
    from: 'HR Recruitment <mass@topgroup4u.com>',
    to: 'mass@tghr4u.com',
    subject: `מועמדות חדשה: ${jobTitle || 'משרה'}`,
    html: `
      <div dir="rtl" style="font-family:Arial;padding:20px">
        <h2>מועמדות חדשה התקבלה</h2>
        <p><strong>שם:</strong> ${name}</p>
        <p><strong>טלפון:</strong> ${phone}</p>
        <p><strong>אימייל:</strong> ${email || 'לא צוין'}</p>
        <p><strong>משרה:</strong> ${jobTitle || 'לא צוין'}</p>
      </div>
    `
  };

  console.log('Sending email via Resend to:', payload.to);

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

  console.log('Email sent successfully:', resBody.id);
  return { statusCode: 200, body: JSON.stringify({ ok: true, id: resBody.id }) };
};
