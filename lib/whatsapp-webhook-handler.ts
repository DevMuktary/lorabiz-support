import { Client, Databases, Storage, Query, ID } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file'; 
import { processTicketWithAI } from '@/lib/ai';
import { summarizeChatForAgent } from '@/lib/ai-summarizer'; // <--- IMPORT ADDED
import { checkBusinessHours } from '@/lib/business-hours';
import { sendZeptoMail } from '@/lib/zeptomail';
import { templates } from '@/lib/email-templates';
import { handleOTPRequest, verifyOTP, invalidateAllOTPs } from '@/lib/otp-service';

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

// Helper to send text messages
async function sendMetaText(phone: string, text: string) {
  await fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST", headers: { "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: phone.replace("+", ""), type: "text", text: { body: text } })
  });
}

export async function processWhatsAppMessage(body: any) {
  const entry = body.entry?.[0];
  const message = entry?.changes?.[0]?.value?.messages?.[0];
  const contact = entry?.changes?.[0]?.value?.contacts?.[0];

  if (!message) return;

  const customerPhone = message.from;
  let customerName = contact?.profile?.name || 'Customer';
  const metaToken = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // 1. FETCH ACTIVE TICKET TO DETERMINE STATE
  const existingTickets = await databases.listDocuments(dbId, ticketsCol, [
    Query.equal('customerPhone', customerPhone),
    Query.notEqual('status', 'CLOSED'), 
    Query.notEqual('status', 'RESOLVED'),
    Query.orderDesc('$createdAt'),
    Query.limit(1)
  ]);
  
  let ticket = existingTickets.documents.length > 0 ? existingTickets.documents[0] : null;

  // ==========================================
  // NEW USER / NO ACTIVE TICKET
  // ==========================================
  if (!ticket) {
    if (message.type !== 'interactive' || message.interactive?.type !== 'nfm_reply') {
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
                flow_message_version: "3", flow_token: `onboarding_${Date.now()}`, flow_id: process.env.FLOW_ID, 
                flow_cta: "Submit Details", flow_action: "navigate", flow_action_payload: { screen: "ONBOARDING_SCREEN" }
              }
            }
          }
        })
      });
      return;
    }
  }

  // ==========================================
  // RESET CRON TIMERS FOR ACTIVE TICKETS
  // ==========================================
  if (ticket) {
    await databases.updateDocument(dbId, ticketsCol, ticket.$id, {
      lastActivityAt: new Date().toISOString(),
      warningSent: false
    });
  }

  // ==========================================
  // BUTTON CLICKS (EDIT DETAILS, RESEND OTP, AGENT HANDOFF)
  // ==========================================
  if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
    const buttonId = message.interactive.button_reply.id;

    // Reject Edit/Resend if they are already verified
    if ((buttonId === 'edit_flow_details' || buttonId.startsWith('resend_otp_')) && ticket?.status !== 'ONBOARDING') {
      return; 
    }

    if (buttonId === 'edit_flow_details') {
       await invalidateAllOTPs(customerPhone); 
       
       await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
        method: "POST", headers: { "Authorization": `Bearer ${metaToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp", recipient_type: "individual", to: customerPhone.replace("+", ""),
          type: "interactive",
          interactive: {
            type: "flow",
            header: { type: "text", text: "Update Your Details" },
            body: { text: "Please provide your correct details below." },
            footer: { text: "Secure Verification" },
            action: {
              name: "flow",
              parameters: {
                flow_message_version: "3", flow_token: `onboarding_retry_${Date.now()}`, flow_id: process.env.FLOW_ID, 
                flow_cta: "Submit Details", flow_action: "navigate", flow_action_payload: { screen: "ONBOARDING_SCREEN" }
              }
            }
          }
        })
      });
      return;
    }

    if (buttonId.startsWith('resend_otp_')) {
      const emailToResend = buttonId.replace('resend_otp_', '');
      const otpResponse = await handleOTPRequest(customerPhone, emailToResend, true);
      
      if (!otpResponse.success && otpResponse.error === "RATE_LIMIT") {
        await sendMetaText(customerPhone, "❌ You have requested too many codes. Please wait 15 minutes before trying again.");
        return;
      }

      const otpCode = otpResponse.code!;
      
      if (!otpResponse.reused) {
        sendZeptoMail({
          toEmail: emailToResend, toName: customerName,
          subject: 'Your LoraBiz Verification Code', htmlBody: templates.otpVerification(customerName, otpCode)
        }).catch(e => console.error("[SILENT EMAIL FAIL]", e));
      }

      await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
        method: "POST", headers: { "Authorization": `Bearer ${metaToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp", to: customerPhone.replace("+", ""), type: "interactive",
          interactive: {
            type: 'button',
            body: { text: `We have sent the 6-digit code to ${emailToResend}.\n\nPlease reply with the code to verify your session.` },
            action: { 
              buttons: [
                { type: 'reply', reply: { id: `resend_otp_${emailToResend}`, title: 'Resend OTP' } },
                { type: 'reply', reply: { id: `edit_flow_details`, title: 'Edit Details' } }
              ] 
            }
          }
        })
      });
      return;
    }

    if (buttonId === 'agent_yes') {
      const hoursStatus = checkBusinessHours();
      const handoverMsg = hoursStatus.isOnline ? "You have been placed in the queue. An agent will be with you shortly." : hoursStatus.message;
      
      // 🚀 NEW: GENERATE SUMMARY ON BUTTON HANDOVER 🚀
      const history = await databases.listDocuments(dbId, messagesCol, [Query.equal('ticketId', ticket!.$id), Query.orderAsc('$createdAt')]);
      const transcript = history.documents.map((m: any) => `${m.senderType}: ${m.content}`).join('\n');
      const summary = await summarizeChatForAgent(transcript);

      await databases.updateDocument(dbId, ticketsCol, ticket!.$id, { 
        status: 'PENDING_AGENT',
        aiSummary: summary // <-- Save summary to DB
      });
      await sendMetaText(customerPhone, handoverMsg);
      return;
    }
  }

  // ==========================================
  // FLOW SUBMISSION
  // ==========================================
  if (message.type === 'interactive' && message.interactive.type === 'nfm_reply') {
     try {
        const flowData = JSON.parse(message.interactive.nfm_reply.response_json);
        const customerEmail = flowData.customer_email;
        customerName = flowData.customer_name || customerName; // Temporary fallback

        const parsedTopic = (flowData.service_topic || '').includes('_') ? flowData.service_topic.split('_').slice(1).join(' ') : (flowData.service_topic || 'General Support');

        // 1. Anti-Enumeration Generic Message (Instantly sent to prevent guessing)
        await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
          method: "POST", headers: { "Authorization": `Bearer ${metaToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp", to: customerPhone.replace("+", ""), type: "interactive",
            interactive: {
              type: 'button',
              body: { text: `If a LoraBiz account is registered with *${customerEmail}*, we have sent a 6-digit verification code to it.\n\nPlease reply with the code. If you made a mistake, click below to edit your details.` },
              action: { 
                buttons: [
                  { type: 'reply', reply: { id: `resend_otp_${customerEmail}`, title: 'Resend OTP' } },
                  { type: 'reply', reply: { id: `edit_flow_details`, title: 'Edit Details' } } 
                ] 
              }
            }
          })
        });

        // 2. Silent Verification on Main App
        const mainAppUrl = process.env.MAIN_APP_URL?.replace(/\/$/, ""); 
        const verifyRes = await fetch(`${mainAppUrl}/api/internal/verify-user`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: customerEmail, secret: process.env.INTERNAL_API_SECRET })
        });
        const verifyData = await verifyRes.json();

        if (!verifyRes.ok || !verifyData.exists) return; // Silent Stop

        // 3. STRICT OVERRIDE: Replace typed name with Official DB Name
        if (verifyData.name) {
           customerName = verifyData.name;
        }

        // 4. Create/Update Ticket & Save System Message
        const systemMessage = `[System: Customer Onboarded]\nName: ${customerName}\nEmail: ${customerEmail}\nTopic: ${parsedTopic}\nDescription: ${flowData.issue_description}`;
        let ticketId = '';
        
        if (ticket) {
          ticketId = ticket.$id;
          await databases.updateDocument(dbId, ticketsCol, ticketId, { 
            status: 'ONBOARDING', 
            lastMessage: `[Flow Submitted] Topic: ${parsedTopic}`,
            lastActivityAt: new Date().toISOString(),
            warningSent: false
          });
        } else {
          const newTicket = await databases.createDocument(dbId, ticketsCol, ID.unique(), {
            customerPhone, sourceChannel: 'WHATSAPP', status: 'ONBOARDING', 
            lastMessage: `[Flow Submitted] Topic: ${parsedTopic}`,
            lastActivityAt: new Date().toISOString(), warningSent: false
          });
          ticketId = newTicket.$id;
        }

        await databases.createDocument(dbId, messagesCol, ID.unique(), {
          ticketId, senderType: 'SYSTEM', senderName: 'System', content: systemMessage
        });

        // 5. Generate & Send OTP using the Verified Name
        const otpResponse = await handleOTPRequest(customerPhone, customerEmail, false);
        if (!otpResponse.success) return; 

        sendZeptoMail({
          toEmail: customerEmail, toName: customerName,
          subject: 'Your LoraBiz Verification Code', htmlBody: templates.otpVerification(customerName, otpResponse.code!)
        }).catch(e => console.error("[SILENT EMAIL FAIL]", e));

        return;
     } catch (e) {
        console.error("[FLOW ERROR]", e);
        return;
     }
  }

  // ==========================================
  // TEXT & MEDIA PROCESSING (ONBOARDING)
  // ==========================================
  if (ticket?.status === 'ONBOARDING') {
     if (message.type === 'text' && /^\d{6}$/.test(message.text.body.trim())) {
        const result = await verifyOTP(customerPhone, message.text.body.trim());
        
        if (result.success) {
          await sendMetaText(customerPhone, `✅ Verification successful!\n\nYour account is verified for this current session. For security reasons, you will be required to verify again in future support sessions.`);
          await databases.updateDocument(dbId, ticketsCol, ticket.$id, { status: 'AI_HANDLING' });

          const history = await databases.listDocuments(dbId, messagesCol, [
            Query.equal('ticketId', ticket.$id), Query.orderAsc('$createdAt')
          ]);

          const aiContext = [...history.documents, {
            senderType: 'SYSTEM', senderName: 'System', 
            content: "SYSTEM DIRECTIVE: The user has just successfully verified their email. Look at the [System: Customer Onboarded] message above, and send a helpful, professional first response addressing their specific Topic and Description."
          }];

          const aiResponseText = await processTicketWithAI(ticket.$id, aiContext as any);

          await databases.createDocument(dbId, messagesCol, ID.unique(), {
            ticketId: ticket.$id, senderType: 'AI', senderName: 'Lora Assistant', content: aiResponseText
          });
          
          await sendMetaText(customerPhone, aiResponseText);
        } else {
          let errorMsg = `❌ Invalid code. Please try again.`;
          if (result.reason === 'EXPIRED') errorMsg = `❌ That code has expired. Please request a new one.`;
          if (result.reason === 'MAX_ATTEMPTS') errorMsg = `❌ Too many invalid attempts. Please request a new code.`;
          await sendMetaText(customerPhone, errorMsg);
        }
     } else {
        await sendMetaText(customerPhone, "Please complete your email verification first by entering the 6-digit code.");
     }
     return;
  }

  // ==========================================
  // FULL AI CHAT (POST-VERIFICATION)
  // ==========================================
  if (ticket && ticket.status === 'AI_HANDLING') {
      let content = message.text?.body || '';
      let attachmentUrl = null;

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
              const upload = await storage.createFile(bucketId, ID.unique(), InputFile.fromBuffer(Buffer.from(arrayBuffer), filename));
              attachmentUrl = `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/${bucketId}/files/${upload.$id}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;
            }
          } catch (mediaError) {
            content = '[Attachment Failed to Upload]';
          }
        }
      }

      await databases.createDocument(dbId, messagesCol, ID.unique(), {
        ticketId: ticket.$id, senderType: 'CUSTOMER', senderName: customerName, content, attachmentUrl
      });

      // Query limit 100 ensures AI remembers flow details
      const history = await databases.listDocuments(dbId, messagesCol, [
        Query.equal('ticketId', ticket.$id), Query.orderAsc('$createdAt'), Query.limit(100)
      ]);

      const aiResponseText = await processTicketWithAI(ticket.$id, history.documents);

      if (aiResponseText.includes('[DIRECT_TRANSFER]')) {
        
        // 🚀 NEW: GENERATE SUMMARY ON DIRECT TRANSFER 🚀
        const transcript = history.documents.map((m: any) => `${m.senderType}: ${m.content}`).join('\n');
        const summary = await summarizeChatForAgent(transcript);

        await databases.updateDocument(dbId, ticketsCol, ticket.$id, { 
          status: 'PENDING_AGENT',
          aiSummary: summary // <-- Save summary to DB
        });
        
        await databases.createDocument(dbId, messagesCol, ID.unique(), {
          ticketId: ticket.$id, senderType: 'SYSTEM', senderName: 'System', content: "[System: Customer explicitly requested human agent]"
        });

        const hoursStatus = checkBusinessHours();
        const handoverMsg = hoursStatus.isOnline ? "I am transferring you to a human agent now. Please hold on..." : hoursStatus.message;
        await sendMetaText(customerPhone, handoverMsg);
      } 
      else if (aiResponseText.includes('TRIGGER_HANDOVER')) {
        await databases.createDocument(dbId, messagesCol, ID.unique(), {
          ticketId: ticket.$id, senderType: 'AI', senderName: 'Lora Assistant', content: "[System: Offered human agent transfer to customer]"
        });
        
        await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
          method: "POST", headers: { "Authorization": `Bearer ${metaToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp", recipient_type: "individual", to: customerPhone.replace("+", ""),
            type: "interactive",
            interactive: {
              type: "button",
              body: { text: "I'm not entirely sure about that. Would you like me to connect you to an available human agent?" },
              action: { buttons: [ { type: "reply", reply: { id: "agent_yes", title: "Yes" } }, { type: "reply", reply: { id: "agent_no", title: "No" } } ] }
            }
          })
        });
      } 
      else {
        await databases.createDocument(dbId, messagesCol, ID.unique(), {
          ticketId: ticket.$id, senderType: 'AI', senderName: 'Lora Assistant', content: aiResponseText
        });
        await sendMetaText(customerPhone, aiResponseText);
      }
  }
}
