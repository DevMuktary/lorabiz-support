// Pulls your deployed URL dynamically so the images always load correctly
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://support.lorabiz.com"; 

// The Master Table Wrapper (Guarantees perfect rendering on Outlook, Gmail, Apple Mail)
const generateEmailWrapper = (contentHtml: string) => `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <tr>
            <td align="center" style="padding: 30px 20px; border-bottom: 1px solid #e2e8f0; background-color: #ffffff;">
              <img src="${SITE_URL}/logo.png" alt="LoraBiz" style="display: block; max-height: 40px; width: auto; object-fit: contain;" />
            </td>
          </tr>

          <tr>
            <td style="padding: 40px 30px; color: #334155; font-size: 16px; line-height: 1.6;">
              ${contentHtml}
            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 0; background-color: #ffffff;">
              <img src="${SITE_URL}/lorabiz-footer.jpg" alt="LoraBiz Promotion" style="display: block; width: 100%; max-width: 600px; height: auto;" />
            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 20px; background-color: #f1f5f9; color: #64748b; font-size: 12px;">
              &copy; ${new Date().getFullYear()} Quadrox Technologies Limited. All rights reserved.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
`;

export const templates = {
  
  agentReply: (customerName: string, content: string, agentName: string) => generateEmailWrapper(`
    <p style="margin-top: 0; margin-bottom: 20px; color: #1e293b; font-weight: 500;">Hi ${customerName || 'there'},</p>
    
    <div style="white-space: pre-wrap; margin-bottom: 30px; color: #334155;">${content}</div>
    
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0 20px 0;" />
    
    <p style="margin: 0; color: #64748b; font-size: 15px;">
      Best regards,<br/>
      <strong style="color: #1e293b;">${agentName || 'LoraBiz Support'}</strong>
    </p>
    
    <div style="margin-top: 30px; padding: 15px; background-color: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1; text-align: center;">
      <p style="margin: 0; font-size: 13px; color: #64748b;">
        <em>Reply directly to this email to continue the conversation.</em>
      </p>
    </div>
  `),

  otpVerification: (customerName: string, otpCode: string) => generateEmailWrapper(`
    <p style="margin-top: 0; margin-bottom: 20px; color: #1e293b; font-weight: 500; text-align: center;">Hi ${customerName || 'there'},</p>
    
    <p style="text-align: center; margin-bottom: 25px;">Please use the verification code below to confirm your identity for WhatsApp Support:</p>
    
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center">
          <div style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a; background-color: #f1f5f9; padding: 15px 30px; border-radius: 8px; border: 1px solid #cbd5e1;">
            ${otpCode}
          </div>
        </td>
      </tr>
    </table>
    
    <p style="text-align: center; margin-top: 25px; font-size: 13px; color: #94a3b8;">This code is valid for 10 minutes. Do not share it with anyone.</p>
  `),

  autoResponder: (customerName: string, ticketId: string) => generateEmailWrapper(`
    <p style="margin-top: 0; margin-bottom: 20px; color: #1e293b; font-weight: 500;">Hi ${customerName || 'there'},</p>
    
    <p style="margin-bottom: 15px;">We have received your message and a support ticket has been created for you.</p>
    
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
      <tr>
        <td style="padding: 12px 15px; background-color: #f8fafc; border-left: 4px solid #3b82f6; color: #475569; font-size: 14px;">
          <strong>Ticket ID:</strong> ${ticketId}
        </td>
      </tr>
    </table>
    
    <p style="margin-bottom: 0;">One of our agents will review your request and reply to you shortly.</p>
  `)
};
