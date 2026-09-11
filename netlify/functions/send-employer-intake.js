exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  const { employerName, employerEmail, contactName, link } = JSON.parse(event.body || '{}');

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'RESEND_API_KEY missing' }) };
  }
  if (!employerEmail || !link) {
    return { statusCode: 400, body: JSON.stringify({ error: 'employerEmail and link are required' }) };
  }

  const greetName = contactName || employerName || '';

  const FONT = `'Segoe UI',Tahoma,Geneva,Arial,sans-serif`;
  const html = `
    <div dir="rtl" style="font-family:${FONT};background:#f8f7f4;padding:32px 16px;margin:0">
      <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;border-collapse:collapse">
        <tr>
          <td style="background:#1a1a2e;border-radius:14px 14px 0 0;padding:22px 28px">
            <span style="font-family:${FONT};color:#e85d26;font-size:19px;font-weight:700;letter-spacing:0.3px">טופ גרופ גיוס והשמה</span>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;border-radius:0 0 14px 14px;padding:36px 32px;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
            <p style="font-family:${FONT};font-size:19px;color:#1a1a2e;margin:0 0 14px;font-weight:600">שלום ${greetName ? greetName + ' 👋' : '👋'}</p>
            <p style="font-family:${FONT};font-size:15px;color:#374151;line-height:1.9;margin:0 0 28px">
              נשמח לעזור לכם לאייש את המשרה הפתוחה אצלכם. לחצו על הכפתור למטה ומלאו כמה פרטים קצרים על התפקיד –
              כך נוכל להתחיל בתהליך הגיוס עבורכם כבר היום.
            </p>
            <table role="presentation" width="100%">
              <tr>
                <td align="center" style="padding:4px 0 30px">
                  <a href="${link}" style="font-family:${FONT};display:inline-block;background:#e85d26;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:15px 40px;border-radius:10px;box-shadow:0 4px 14px rgba(232,93,38,0.35)">
                    מילוי פרטי המשרה ←
                  </a>
                </td>
              </tr>
            </table>
            <p style="font-family:${FONT};font-size:12px;color:#9ca3af;line-height:1.7;margin:0">
              אם הכפתור לא נפתח, אפשר להעתיק את הקישור הבא לדפדפן:<br/>
              <a href="${link}" style="font-family:${FONT};color:#e85d26">${link}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 0 0">
            <span style="font-family:${FONT};font-size:12px;color:#9ca3af">טופ גרופ גיוס והשמה</span>
          </td>
        </tr>
      </table>
    </div>
  `;

  const payload = {
    from: 'טופ גרופ גיוס והשמה <mass@topgroup4u.com>',
    to: employerEmail,
    subject: `בקשה למילוי פרטי משרה${employerName ? ' – ' + employerName : ''}`,
    html,
  };

  console.log('Sending employer intake email via Resend to:', payload.to);

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

  console.log('Employer intake email sent successfully:', resBody.id);
  return { statusCode: 200, body: JSON.stringify({ ok: true, id: resBody.id }) };
};
