interface SendMailParams {
  toEmail: string;
  toName: string;
  subject: string;
  htmlBody: string;
}

export async function sendBrevoMail({ toEmail, toName, subject, htmlBody }: SendMailParams) {
  const brevoApiKey = process.env.BREVO_API_KEY;
  const supportEmail = process.env.SUPPORT_EMAIL_ADDRESS || "hello@support.lorabiz.com";
  const supportName = process.env.SUPPORT_EMAIL_NAME || "LoraBiz Support";

  if (!brevoApiKey) {
    throw new Error("Brevo API key is missing from environment variables.");
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': brevoApiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: {
        name: supportName,
        email: supportEmail
      },
      to: [
        {
          email: toEmail,
          name: toName || "Customer"
        }
      ],
      subject: subject,
      htmlContent: htmlBody,
      replyTo: {
        email: supportEmail,
        name: supportName
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("[BREVO ERROR]", errorData);
    throw new Error(errorData.message || 'Failed to send email via Brevo');
  }

  return await response.json();
}
