// Pulls your deployed URL dynamically so the logo always loads, no matter where it's hosted
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://support.lorabiz.com"; 

const generateEmailWrapper = (contentHtml: string) => `
  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc; border-radius: 12px;">
    <div style="text-align: center; margin-bottom: 25px;">
      <img src="${SITE_URL}/logo.png" alt="LoraBiz Logo" style="max-height: 40px; width: auto; object-fit: contain;" />
    </div>
    <div style="background-color: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      ${contentHtml}
    </div>
    <div style="text-align: center; margin-top: 30px; color: #64748b; font-size: 12px;">
      <p>&copy; ${new Date().getFullYear()} Quadrox Technologies Limited. All rights reserved.</p>
    </div>
  </div>
`;

export const templates = {
  agentReply: (customerName: string, content: string, agentName: string) => generateEmailWrapper(`
    <p style="font-size: 16px; color: #1e293b; margin-bottom: 20px;">Hi ${customerName || 'there'},</p>
    <div style="font-size: 16px; color: #334155; line-height: 1.6; white-space: pre-wrap; margin-bottom: 30px;">
      ${content}
    </div>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
    <p style="font-size: 14px; color: #64748b; margin: 0;">
      <strong>Best regards,</strong><br/>
      Signed by ${agentName || 'LoraBiz Support Team'}
    </p>
    <div style="margin-top: 25px; padding: 15px; background-color: #f1f5f9; border-radius: 8px; text-align: center;">
      <p style="font-size: 13px; color: #475569; margin: 0;">
        <em>If you have any more questions, simply reply directly to this email to continue the conversation.</em>
      </p>
    </div>
  `),

  otpVerification: (customerName: string, otpCode: string) => generateEmailWrapper(`
    <p style="font-size: 16px; color: #1e293b; margin-bottom: 20px; text-align: center;">Hi ${customerName || 'there'},</p>
    <p style="font-size: 15px; color: #475569; text-align: center; margin-bottom: 25px;">Please use the verification code below to confirm your identity for WhatsApp Support:</p>
    <div style="text-align: center; margin-bottom: 30px;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #000000; background-color: #f1f5f9; padding: 15px 30px; border-radius: 8px; border: 1px dashed #cbd5e1;">${otpCode}</span>
    </div>
    <p style="font-size: 13px; color: #94a3b8; text-align: center; margin: 0;">This code is valid for 10 minutes. Do not share it with anyone.</p>
  `),

  autoResponder: (customerName: string, ticketId: string) => generateEmailWrapper(`
    <p style="font-size: 16px; color: #1e293b; margin-bottom: 20px;">Hi ${customerName || 'there'},</p>
    <p style="font-size: 15px; color: #334155; line-height: 1.6;">
      We have received your message. Your ticket ID is <strong>${ticketId}</strong>.
    </p>
    <p style="font-size: 15px; color: #334155; line-height: 1.6;">
      One of our support agents will review your request and reply to you here shortly. 
    </p>
  `)
};
