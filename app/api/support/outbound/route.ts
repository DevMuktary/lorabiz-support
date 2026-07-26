import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { customerPhone, content } = await req.json();

    if (!customerPhone || !content) {
      return NextResponse.json({ error: "Missing phone or content" }, { status: 400 });
    }

    // Your Meta WhatsApp Phone Number ID (Get this from your Meta App Dashboard)
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const metaToken = process.env.WHATSAPP_TOKEN;

    if (!phoneNumberId || !metaToken) {
      console.warn("WhatsApp credentials missing. Message saved to DB but not sent to WhatsApp.");
      return NextResponse.json({ success: true, warning: "Meta credentials missing" });
    }

    // Hit the Meta Graph API to send the text
    const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${metaToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: customerPhone.replace("+", ""), // Meta expects no plus sign
        type: "text",
        text: {
          preview_url: true,
          body: content,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Meta API Error:", data);
      return NextResponse.json({ error: "Failed to send WhatsApp message" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Outbound API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}