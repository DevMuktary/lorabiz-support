import { Client, Databases, Query, ID } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '')
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '')
  .setKey(process.env.APPWRITE_SECRET_KEY || '');

const databases = new Databases(client);
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'lorabiz_support';
const OTP_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_OTP_COLLECTION_ID || 'otps';

export async function handleOTPRequest(phoneNumber: string, email: string, isResend: boolean = false) {
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  
  // 1. RATE LIMIT CHECK: Max 3 requests per 15 minutes
  const recentOtps = await databases.listDocuments(DATABASE_ID, OTP_COLLECTION_ID, [
    Query.equal('phoneNumber', phoneNumber),
    Query.greaterThan('$createdAt', fifteenMinsAgo)
  ]);

  if (recentOtps.total >= 3) {
    return { success: false, error: "RATE_LIMIT" };
  }

  // 2. IF RESEND: Check for existing unexpired OTP to reuse
  if (isResend) {
    const existingActive = await databases.listDocuments(DATABASE_ID, OTP_COLLECTION_ID, [
      Query.equal('phoneNumber', phoneNumber),
      Query.equal('status', 'PENDING'),
      Query.orderDesc('$createdAt'),
      Query.limit(1)
    ]);

    if (existingActive.total > 0) {
      const existingOtp = existingActive.documents[0];
      if (new Date(existingOtp.expiresAt) > new Date()) {
        return { success: true, code: existingOtp.code, reused: true };
      }
    }
  }

  // 3. GENERATE NEW OTP (If first time, or old one expired)
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); 

  await invalidateAllOTPs(phoneNumber); // Clear old ones

  await databases.createDocument(DATABASE_ID, OTP_COLLECTION_ID, ID.unique(), {
    phoneNumber, email, code: otpCode, expiresAt, status: 'PENDING', attempts: 0
  });

  return { success: true, code: otpCode, reused: false };
}

export async function invalidateAllOTPs(phoneNumber: string) {
  const existingOtps = await databases.listDocuments(DATABASE_ID, OTP_COLLECTION_ID, [
    Query.equal('phoneNumber', phoneNumber),
    Query.equal('status', 'PENDING')
  ]);

  for (const doc of existingOtps.documents) {
    await databases.updateDocument(DATABASE_ID, OTP_COLLECTION_ID, doc.$id, { status: 'INVALIDATED' });
  }
}

export async function verifyOTP(phoneNumber: string, submittedCode: string) {
  const records = await databases.listDocuments(DATABASE_ID, OTP_COLLECTION_ID, [
    Query.equal('phoneNumber', phoneNumber),
    Query.equal('status', 'PENDING'),
    Query.orderDesc('$createdAt'),
    Query.limit(1)
  ]);

  if (records.total === 0) return { success: false, reason: 'NO_OTP_FOUND' };
  const record = records.documents[0];

  if (new Date(record.expiresAt) < new Date()) {
    await databases.updateDocument(DATABASE_ID, OTP_COLLECTION_ID, record.$id, { status: 'EXPIRED' });
    return { success: false, reason: 'EXPIRED' };
  }

  if (record.attempts >= 3) {
    await databases.updateDocument(DATABASE_ID, OTP_COLLECTION_ID, record.$id, { status: 'MAX_ATTEMPTS' });
    return { success: false, reason: 'MAX_ATTEMPTS' };
  }

  if (record.code !== submittedCode) {
    await databases.updateDocument(DATABASE_ID, OTP_COLLECTION_ID, record.$id, { attempts: record.attempts + 1 });
    return { success: false, reason: 'INVALID_CODE' };
  }

  await databases.updateDocument(DATABASE_ID, OTP_COLLECTION_ID, record.$id, { status: 'VERIFIED' });
  return { success: true, email: record.email };
}
