import { NextResponse } from 'next/server';
import { Client, Databases, Storage, Query, ID } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file'; 
import { processTicketWithAI } from '@/lib/ai';
import { checkBusinessHours } from '@/lib/business-hours';
import { sendZeptoMail } from '@/lib/zeptomail';
import { templates } from '@/lib/email-templates';
import { generateAndSaveOTP, verifyOTP } from '@/lib/otp-service';

const adminClient = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_SECRET_KEY!);

const databases = new Databases(adminClient);
const storage = new Storage(adminClient);

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const ticketsCol = process.env.NEXT_PUBLIC_APPWRITE_TICKETS_COLLECTION_ID!;
const messagesCol = process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID!;
const bucketId = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID!;

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("hub.mode") === "subscribe") {
    return new Response(url.searchParams.get("hub.challenge"), { status: 200 });
  }
  return new Response("Webhook Active", { status: 200 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const message = entry?.changes?.[0]?.value?.messages?.[0];
      const contact = entry?.changes?.[0]?.value?.contacts?.[0];

      if (message) {
        const customerPhone = message.from;
        let customerName = contact?.profile?.name || 'Customer';
        const metaToken = process.env.WHATSAPP_TOKEN;
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

        // ==========================================
        // NEW: OTP INTERCEPT LOGIC
        // ==========================================
        
        // Handle "Resend OTP" button click
        if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
          const buttonId = message.interactive.button_reply.id;
          if (buttonId.startsWith('resend_otp_')) {
            const emailToResend = buttonId.replace('resend_otp_', '');
            const otpCode = await generateAndSaveOTP(customerPhone, emailToResend);
            
            await sendZeptoMail({
              toEmail: emailToResend, toName: customerName,
              subject: 'Your New LoraBiz Verification Code', htmlBody: templates.otpVerification(customerName, otpCode)
            });
            
            await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
              method: "POST", headers: { "Authorization": `Bearer ${metaToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                messaging_product: "whatsapp", to: customerPhone.replace("+", ""), type: "interactive",
                interactive: {
                  type: 'button',
                  body: { text: `We just sent a new 6-digit code to ${emailToResend}.\n\nPlease reply with the code to verify your account.` },
                  action: { buttons: [{ type: 'reply', reply: { id: `resend_otp_${emailToResend}`, title: 'Resend OTP' } }] }
                }
              })
            });
            return NextResponse.json({ success: true });
          }
        }

        // Handle text containing an Email Address or 6-Digit Code
        if (message.type === 'text') {
          const incomingText = message.text.body.trim();

          // A. Is it an Email Address?
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(incomingText)) {
            const customerEmail = incomingText;
            const otpCode = await generateAndSaveOTP(customerPhone, customerEmail);
            
            await sendZeptoMail({
              toEmail: customerEmail, toName: customerName,
              subject: 'Your LoraBiz Verification Code', htmlBody: templates.otpVerification(customerName, otpCode)
            });

            await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
              method: "POST", headers: { "Authorization": `Bearer ${metaToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                messaging_product: "whatsapp", to: customerPhone.replace("+", ""), type: "interactive",
                interactive: {
                  type: 'button',
                  body: { text: `We just sent a 6-digit verification code to ${customerEmail}.\n\nPlease reply with the code to verify your account.` },
                  action: { buttons: [{ type: 'reply', reply: { id: `resend_otp_${customerEmail}`, title: 'Resend OTP' } }] }
                }
              })
            });
            return NextResponse.json({ success: true });
          }

          // B. Is it a 6-Digit Code?
          if (/^\d{6}$/.test(incomingText)) {
            const result = await verifyOTP(customerPhone, incomingText);
            let replyMessage = "";

            if (result.success) replyMessage = `✅ Verification successful! Your account (${result.email}) is now linked.`;
            else if (result.reason === 'EXPIRED') replyMessage = `❌ That code has expired. Please request a new one.`;
            else if (result.reason === 'MAX_ATTEMPTS') replyMessage = `❌ Too many invalid attempts. Please request a new code.`;
            else replyMessage = `❌ Invalid code. Please check your email and try again.`;

            await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
              method: "POST", headers: { "Authorization": `Bearer ${metaToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ messaging_product: "whatsapp", to: customerPhone.replace("+", ""), type: "text", text: { body: replyMessage } })
            });
            return NextResponse.json({ success: true });
          }
        }

        // ==========================================
        // RESTORED: YOUR ORIGINAL LOGIC
        // ==========================================
        
        let content = '';
        let attachmentUrl = null;
        let isButtonReplyYes = false;
        let isFlowSubmission = false;
        let flowData: any = null;

        // --- 1. HANDLE MESSAGE TYPE ---
        if (message.type === 'image' || message.type === 'document') {
          content = '[Attachment Received]';
          let mediaId = message.type === 'image' ? message.image.id : message.document.id;
          let filename = message.type === 'image' ? `img_${Date.now()}.jpg` : (message.document.filename || `doc_${Date.now()}`);

          if (mediaId && metaToken) {
            try {
              const mediaUrlRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, { headers: { "Authorization": `Bearer ${metaToken}` } });
              const mediaData = await mediaUrlRes.json();
              if (mediaData.url) {
                const fileDownloadRes = await fetch(mediaData.url, { headers: { "Authorization": `Bearer ${metaToken}` } });
                const arrayBuffer = await fileDownloadRes.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const upload = await storage.createFile(bucketId, ID.unique(), InputFile.fromBuffer(buffer, filename));
                attachmentUrl = `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/${bucketId}/files/${upload.$id}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;
              }
            } catch (mediaError) {
              content = '[Attachment Failed to Upload]';
            }
          }
        } else if (message.type === 'interactive') {
          if (message.interactive.type === 'button_reply') {
            const buttonId = message.interactive.button_reply.id;
            if (buttonId === 'agent_yes') {
              content = '[Clicked: Connect to Agent]';
              isButtonReplyYes = true;
            } else {
              content = '[Clicked: No Agent Needed]';
            }
          } 
          else if (message.interactive.type === 'nfm_reply') {
             isFlowSubmission = true;
             try {
                flowData = JSON.parse(message.interactive.nfm_reply.response_json);
                content = `[Flow Submitted] Topic: ${flowData.service_topic.split('_').slice(1).join(' ')}`;
                customerName = flowData.customer_name || customerName;
             } catch (e) {
                content = '[Flow Data Received]';
             }
          }
        } else {
          content = message.text?.body || '';
        }

        // --- 2. TICKET MANAGEMENT ---
        const existingTickets = await databases.listDocuments(dbId, ticketsCol, [
          Query.equal('customerPhone', customerPhone),
          Query.notEqual('status', 'CLOSED'), 
          Query.orderDesc('$createdAt'),
          Query.limit(1)
        ]);

        let ticketId = '';
        let currentStatus = 'AI_HANDLING';
        let isFirstContact = false;

        if (existingTickets.documents.length > 0) {
          ticketId = existingTickets.documents[0].$id;
          currentStatus = isButtonReplyYes ? 'PENDING_AGENT' : existingTickets.documents[0].status;
          await databases.updateDocument(dbId, ticketsCol, ticketId, { 
            lastMessage: content,
            status: currentStatus 
          });
        } else {
          isFirstContact = true;
          const newTicket = await databases.createDocument(dbId, ticketsCol, ID.unique(), {
            customerPhone: customerPhone,
            sourceChannel: 'WHATSAPP',
            status: isButtonReplyYes ? 'PENDING_AGENT' : 'AI_HANDLING',
            lastMessage: content
          });
          ticketId = newTicket.$id;
          currentStatus = newTicket.status;
        }

        // --- 3. SAVE CUSTOMER MESSAGE TO DATABASE ---
        if (isFlowSubmission && flowData) {
           await databases.createDocument(dbId, messagesCol, ID.unique(), {
             ticketId, senderType: 'SYSTEM', senderName: 'System',
             content: `[System: Customer Onboarded]\nName: ${flowData.customer_name}\nEmail: ${flowData.customer_email}\nTopic: ${flowData.service_topic}\nDescription: ${flowData.issue_description}`
           });
        }

        await databases.createDocument(dbId, messagesCol, ID.unique(), {
          ticketId, senderType: 'CUSTOMER', senderName: customerName,
          content, attachmentUrl 
        });

        // --- 4. THE AI BRAIN & BUTTON HANDLER ---
        if (isFirstContact && !isFlowSubmission) {
            await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
              method: "POST", headers: { "Authorization": `Bearer ${metaToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                messaging_product: "whatsapp", recipient_type: "individual", to: customerPhone.replace("+", ""),
                type: "interactive",
                interactive: {
                  type: "flow",
                  header: { type: "text", text: "Welcome to LoraBiz Support" },
                  body: { text: "To help us serve you better, please provide your details." },
                  footer: { text: "Secure Verification" },
                  action: {
                    name: "flow",
                    parameters: {
                      flow_message_version: "3", flow_token: `onboarding_${ticketId}`, flow_id: process.env.FLOW_ID, 
                      flow_cta: "Submit Details", flow_action: "navigate", flow_action_payload: { screen: "ONBOARDING_SCREEN" }
                    }
                  }
                }
              })
            });
            return NextResponse.json({ success: true }); 
        }

        if (isButtonReplyYes) {
           const hoursStatus = checkBusinessHours();
           const handoverMessage = hoursStatus.isOnline
             ? "You have been placed in the queue. An available agent will be with you shortly."
             : hoursStatus.message;

           await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
              method: "POST", headers: { "Authorization": `Bearer ${metaToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                messaging_product: "whatsapp", to: customerPhone.replace("+", ""), type: "text",
                text: { body: handoverMessage }
              })
            });
            return NextResponse.json({ success: true }); 
        }

        if (currentStatus === 'AI_HANDLING') {
          const history = await databases.listDocuments(dbId, messagesCol, [
            Query.equal('ticketId', ticketId), Query.orderAsc('$createdAt')
          ]);

          const aiResponseText = await processTicketWithAI(ticketId, history.documents);

          if (aiResponseText.includes('TRIGGER_HANDOVER')) {
            await databases.createDocument(dbId, messagesCol, ID.unique(), {
              ticketId, senderType: 'AI', senderName: 'Lora Assistant', content: "[System: Offered human agent transfer to customer]"
            });

            await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
              method: "POST", headers: { "Authorization": `Bearer ${metaToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                messaging_product: "whatsapp", recipient_type: "individual", to: customerPhone.replace("+", ""),
                type: "interactive",
                interactive: {
                  type: "button",
                  body: { text: "I'm sorry, I don't have the exact information for that. Would you like me to connect you to an available agent?" },
                  action: {
                    buttons: [
                      { type: "reply", reply: { id: "agent_yes", title: "Yes" } },
                      { type: "reply", reply: { id: "agent_no", title: "No" } }
                    ]
                  }
                }
              })
            });
          } else {
            await databases.createDocument(dbId, messagesCol, ID.unique(), {
              ticketId, senderType: 'AI', senderName: 'Lora Assistant', content: aiResponseText
            });

            await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
              method: "POST", headers: { "Authorization": `Bearer ${metaToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                messaging_product: "whatsapp", to: customerPhone.replace("+", ""), type: "text",
                text: { body: aiResponseText }
              })
            });
          }
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
