import { NextResponse } from 'next/server';
import { sendZeptoMail } from '@/lib/zeptomail';
import { templates } from '@/lib/email-templates';
import { generateAndSaveOTP, verifyOTP } from '@/lib/otp-service';
import { sendWhatsAppText, sendWhatsAppOTPRequest } from '@/lib/whatsapp';

export async function GET(req: Request) {
  // Meta API Verification (Unchanged)
  const { searchParams } = new URL(req.url);
  if (searchParams.get('hub.mode') === 'subscribe' && searchParams.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(searchParams.get('hub.challenge'), { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];
      const contact = value?.contacts?.[0];

      if (message) {
        const phoneNumber = message.from; 
        const customerName = contact?.profile?.name || 'Customer';

        // SCENARIO 1: User clicked the "Resend OTP" interactive button
        if (message.type === 'interactive' && message.interactive?.button_reply?.id?.startsWith('resend_otp_')) {
          const emailToResend = message.interactive.button_reply.id.replace('resend_otp_', '');
          
          const otpCode = await generateAndSaveOTP(phoneNumber, emailToResend);
          await sendZeptoMail({
            toEmail: emailToResend,
            toName: customerName,
            subject: 'Your New LoraBiz Verification Code',
            htmlBody: templates.otpVerification(customerName, otpCode)
          });
          
          await sendWhatsAppOTPRequest(phoneNumber, emailToResend);
          return NextResponse.json({ status: 'SUCCESS' });
        }

        // SCENARIO 2: User sent text (Email OR 6-Digit Code)
        if (message.type === 'text') {
          const incomingText = message.text.body.trim();

          // A. User sent an Email Address
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(incomingText)) {
            const customerEmail = incomingText;
            const otpCode = await generateAndSaveOTP(phoneNumber, customerEmail);

            await sendZeptoMail({
              toEmail: customerEmail,
              toName: customerName,
              subject: 'Your LoraBiz Verification Code',
              htmlBody: templates.otpVerification(customerName, otpCode)
            });

            await sendWhatsAppOTPRequest(phoneNumber, customerEmail);
            return NextResponse.json({ status: 'SUCCESS' });
          }

          // B. User sent a 6-Digit Code
          if (/^\d{6}$/.test(incomingText)) {
            const result = await verifyOTP(phoneNumber, incomingText);

            if (result.success) {
              await sendWhatsAppText(phoneNumber, `✅ Verification successful! Your account (${result.email}) is now linked.`);
              // TODO: Link the user's WhatsApp number to their profile in Appwrite
            } else if (result.reason === 'EXPIRED') {
              await sendWhatsAppText(phoneNumber, `❌ That code has expired. Please request a new one.`);
            } else if (result.reason === 'MAX_ATTEMPTS') {
              await sendWhatsAppText(phoneNumber, `❌ Too many invalid attempts. Please request a new code.`);
            } else {
              await sendWhatsAppText(phoneNumber, `❌ Invalid code. Please check your email and try again.`);
            }
            return NextResponse.json({ status: 'SUCCESS' });
          }
        }
      }
    }

    return NextResponse.json({ status: 'SUCCESS' });
  } catch (error: any) {
    console.error('[WHATSAPP WEBHOOK ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
