import { Client, Databases, Storage, Query, ID } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file'; 
import { processTicketWithAI } from '@/lib/ai';
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

// HELPER FUNCTION: To send simple WhatsApp text
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
      // Force them to the flow. Don't process AI or text.
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
  // BUTTON CLICKS (EDIT DETAILS, RESEND OTP, AGENT HANDOFF)
  // ==========================================
  if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
    const buttonId = message.interactive.button_reply.id;

    // Reject Edit/Resend if they are already verified (prevents scrolling up to old messages)
    if ((buttonId === 'edit_flow_details' || buttonId.startsWith('resend_otp_')) && ticket?.status !== 'ONBOARDING') {
      return; 
    }

    if (buttonId === 'edit_flow_details') {
       await invalidateAllOTPs(customerPhone); // Security: Kill old OTPs instantly
       
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
      
      // Only send ZeptoMail if it's a NEW code. If reused, save API limits.
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
      await databases.updateDocument(dbId, ticketsCol, ticket!.$id, { status: 'PENDING_AGENT' });
      await sendMetaText(customerPhone, handoverMsg);
      return;
    }
  }

  // ==========================================
  // FLOW SUBMISSION (NFM_REPLY)
  // ==========================================
  if (message.type === 'interactive' && message.interactive.type === 'nfm_reply') {
     try {
        const flowData = JSON.parse(message.interactive.nfm_reply.response_json);
        const customerEmail = flowData.customer_email;
        customerName = flowData.customer_name || customerName;

        const parsedTopic = (flowData.service_topic || '').includes('_') ? flowData.service_topic.split('_').slice(1).join(' ') : (flowData.service_topic || 'General Support');
        const systemMessage = `[System: Customer Onboarded]\nName: ${customerName}\nEmail: ${customerEmail}\nTopic: ${parsedTopic}\nDescription: ${flowData.issue_description}`;

        // 1. Create or Update Ticket to ONBOARDING
        let ticketId = '';
        if (ticket) {
          ticketId = ticket.$id;
          await databases.updateDocument(dbId, ticketsCol, ticketId, { status: 'ONBOARDING', lastMessage: `[Flow Submitted] Topic: ${parsedTopic}` });
        } else {
          const newTicket = await databases.createDocument(dbId, ticketsCol, ID.unique(), {
            customerPhone, sourceChannel: 'WHATSAPP', status: 'ONBOARDING', lastMessage: `[Flow Submitted] Topic: ${parsedTopic}`
          });
          ticketId = newTicket.$id;
        }

        // Save Flow details to DB so AI can read it later
        await databases.createDocument(dbId, messagesCol, ID.unique(), {
          ticketId, senderType: 'SYSTEM', senderName: 'System', content: systemMessage
        });

        // 2. Generic Message to prevent User Enumeration
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

        // 3. Silent Verification on Main App
        const mainAppUrl = process.env.MAIN_APP_URL?.replace(/\/$/, ""); 
        const verifyRes = await fetch(`${mainAppUrl}/api/internal/verify-user`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: customerEmail, secret: process.env.INTERNAL_API_SECRET })
        });
        const verifyData = await verifyRes.json();

        if (!verifyRes.ok || !verifyData.exists) return; // Silent stop

        // 4. Generate & Send Real OTP
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
  // TEXT & MEDIA PROCESSING
  // ==========================================
  if (ticket?.status === 'ONBOARDING') {
     // User is unverified. Protect AI tokens. ONLY check for 6 digits.
     if (message.type === 'text' && /^\d{6}$/.test(message.text.body.trim())) {
        const result = await verifyOTP(customerPhone, message.text.body.trim());
        
        if (result.success) {
          // 1. Session-Only Success Message
          await sendMetaText(customerPhone, `✅ Verification successful!\n\nYour account is verified for this current session. For security reasons, you will be required to verify again in future support sessions.`);
          
          // 2. Upgrade ticket to AI_HANDLING
          await databases.updateDocument(dbId, ticketsCol, ticket.$id, { status: 'AI_HANDLING' });

          // 3. Trigger Post-Verification AI Acknowledgment based on Flow Data
          const history = await databases.listDocuments(dbId, messagesCol, [
            Query.equal('ticketId', ticket.$id), Query.orderAsc('$createdAt')
          ]);

          // We pass a hidden system prompt to make the AI reply immediately to their flow issue
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
        // Any other text sent during Onboarding is politely blocked.
        await sendMetaText(customerPhone, "Please complete your email verification first by entering the 6-digit code.");
     }
     return;
  }

  // ==========================================
  // FULL AI CHAT (POST-VERIFICATION ONLY)
  // ==========================================
  if (ticket && ticket.status === 'AI_HANDLING') {
      let content = message.text?.body || '';

      if (message.type === 'image' || message.type === 'document') {
        content = '[Attachment Received]';
        // Add attachment upload logic here if needed
      }

      await databases.createDocument(dbId, messagesCol, ID.unique(), {
        ticketId: ticket.$id, senderType: 'CUSTOMER', senderName: customerName, content
      });

      const history = await databases.listDocuments(dbId, messagesCol, [
        Query.equal('ticketId', ticket.$id), Query.orderAsc('$createdAt')
      ]);

      const aiResponseText = await processTicketWithAI(ticket.$id, history.documents);

      if (aiResponseText.includes('TRIGGER_HANDOVER')) {
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
              body: { text: "I'm sorry, I don't have the exact information for that. Would you like me to connect you to an available agent?" },
              action: { buttons: [ { type: "reply", reply: { id: "agent_yes", title: "Yes" } }, { type: "reply", reply: { id: "agent_no", title: "No" } } ] }
            }
          })
        });
      } else {
        await databases.createDocument(dbId, messagesCol, ID.unique(), {
          ticketId: ticket.$id, senderType: 'AI', senderName: 'Lora Assistant', content: aiResponseText
        });
        await sendMetaText(customerPhone, aiResponseText);
      }
  }
}
