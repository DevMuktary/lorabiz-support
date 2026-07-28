import { NextResponse } from 'next/server';
import { sendZeptoMail } from '@/lib/zeptomail';
import { sendBrevoMail } from '@/lib/brevo';
import { templates } from '@/lib/email-templates';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { toEmail, customerName, type, content, ticketId, agentName } = body;

    if (!toEmail || !type) {
      return NextResponse.json({ error: 'Missing required fields (toEmail, type)' }, { status: 400 });
    }

    let subject = '';
    let htmlBody = '';

    // Route the request to the correct template
    switch (type) {
      case 'AGENT_REPLY':
        subject = `Re: Your LoraBiz Support Request [${ticketId}]`;
        htmlBody = templates.agentReply(customerName, content, agentName);
        // Send via Brevo
        await sendBrevoMail({ toEmail, toName: customerName, subject, htmlBody });
        break;
        
      case 'AUTO_RESPONDER':
        subject = `Request Received [${ticketId}]`;
        htmlBody = templates.autoResponder(customerName, ticketId);
        // Send via Brevo
        await sendBrevoMail({ toEmail, toName: customerName, subject, htmlBody });
        break;

      case 'OTP':
        subject = `Your LoraBiz Verification Code`;
        htmlBody = templates.otpVerification(customerName, content);
        // Send via ZeptoMail (High Deliverability Transactional)
        await sendZeptoMail({ toEmail, toName: customerName, subject, htmlBody });
        break;

      default:
        return NextResponse.json({ error: 'Invalid email type specified' }, { status: 400 });
    }

    return NextResponse.json({ status: 'SUCCESS' });
  } catch (error: any) {
    console.error('[EMAIL API ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
