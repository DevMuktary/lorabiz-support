const META_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const HEADERS = {
  'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
  'Content-Type': 'application/json',
};

export async function sendWhatsAppText(to: string, text: string) {
  await fetch(META_API_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text }
    })
  });
}

export async function sendWhatsAppOTPRequest(to: string, email: string) {
  await fetch(META_API_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: `We just sent a 6-digit verification code to ${email}.\n\nPlease reply with the code to verify your account. If you didn't receive it, you can request a new one.`
        },
        action: {
          buttons: [
            {
              type: 'reply',
              reply: {
                id: `resend_otp_${email}`,
                title: 'Resend OTP'
              }
            }
          ]
        }
      }
    })
  });
}
