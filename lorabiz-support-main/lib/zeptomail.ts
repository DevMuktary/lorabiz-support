interface SendMailParams {
  toEmail: string;
  toName: string;
  subject: string;
  htmlBody: string;
}

export async function sendZeptoMail({ toEmail, toName, subject, htmlBody }: SendMailParams) {
  const zeptoMailToken = process.env.ZEPTOMAIL_API_KEY;
  const bounceAddress = process.env.ZEPTOMAIL_BOUNCE_ADDRESS;
  const supportEmail = process.env.SUPPORT_EMAIL_ADDRESS || "support@lorabiz.com";
  const supportName = process.env.SUPPORT_EMAIL_NAME || "LoraBiz Support";
  
  if (!zeptoMailToken) {
    throw new Error("ZeptoMail API key is missing from environment variables.");
  }

  if (!bounceAddress) {
    console.warn("[ZEPTOMAIL WARNING] ZEPTOMAIL_BOUNCE_ADDRESS is missing. Using fallback.");
  }

  const response = await fetch('https://api.zeptomail.com/v1.1/email', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Zoho-enczapikey ${zeptoMailToken}`
    },
    body: JSON.stringify({
      bounce_address: bounceAddress || `bounce@${supportEmail.split('@')[1]}`, 
      from: {
        address: supportEmail,
        name: supportName
      },
      to: [
        {
          email_address: {
            address: toEmail,
            name: toName || "Customer"
          }
        }
      ],
      subject: subject,
      htmlbody: htmlBody,
      reply_to: [
        {
          address: supportEmail,
          name: supportName
        }
      ]
    })
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("[ZEPTOMAIL ERROR]", result);
    throw new Error(result.error?.message || 'Failed to send email via ZeptoMail');
  }

  return result;
}
