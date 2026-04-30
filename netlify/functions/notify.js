exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };
  
  const { name, phone, email, jobTitle } = JSON.parse(event.body || '{}');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'hr@topgroup4u.com',
      to: 'hr@topgroup4u.com',
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
    })
  });

  return { statusCode: res.ok ? 200 : 500 };
};