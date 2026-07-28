import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { processWhatsAppMessage } from '@/lib/whatsapp-webhook-handler';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  // SECURITY: Verify the token matches what you set in Meta App Dashboard
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN; 
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden: Invalid Verify Token", { status: 403 });
}

export async function POST(req: Request) {
  try {
    // 1. Get raw text body and signature header for security validation
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');

    // 2. Reject requests missing the Meta signature
    if (!signature) {
      console.warn("[SECURITY] Blocked request without signature.");
      return new Response("Unauthorized", { status: 401 });
    }

    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
      console.error("[CONFIG ERROR] FACEBOOK_APP_SECRET is missing from environment variables.");
      return new Response("Server Configuration Error", { status: 500 });
    }

    // 3. Cryptographically verify the signature matches the payload
    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex')}`;

    if (signature !== expectedSignature) {
      console.error("[SECURITY] Invalid Meta Signature detected! Possible spoofing attempt.");
      return new Response("Unauthorized", { status: 401 });
    }

    // 4. Safe to parse and process
    const body = JSON.parse(rawBody);

    if (body.object === 'whatsapp_business_account') {
      // Pass the safe payload to our separated logic handler
      await processWhatsAppMessage(body);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[WEBHOOK POST ERROR]:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
