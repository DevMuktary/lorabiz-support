import { Client, Databases, Query, ID } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '')
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '')
  .setKey(process.env.APPWRITE_SECRET_KEY || '');

const databases = new Databases(client);
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'lorabiz_support';
const OTP_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_OTP_COLLECTION_ID || 'otps';

export async function generateAndSaveOTP(phoneNumber: string, email: string): Promise<string> {
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

  // Invalidate any existing OTPs for this phone number
  const existingOtps = await databases.listDocuments(DATABASE_ID, OTP_COLLECTION_ID, [
    Query.equal('phoneNumber', phoneNumber),
    Query.equal('status', 'PENDING')
  ]);

  for (const doc of existingOtps.documents) {
    await databases.updateDocument(DATABASE_ID, OTP_COLLECTION_ID, doc.$id, { status: 'INVALIDATED' });
  }

  // Save the new OTP securely
  await databases.createDocument(DATABASE_ID, OTP_COLLECTION_ID, ID.unique(), {
    phoneNumber,
    email,
    code: otpCode,
    expiresAt,
    status: 'PENDING',
    attempts: 0
  });

  return otpCode;
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

  // Success! Mark as verified.
  await databases.updateDocument(DATABASE_ID, OTP_COLLECTION_ID, record.$id, { status: 'VERIFIED' });
  return { success: true, email: record.email };
}
