import { auth } from '@clerk/nextjs/server';
import { Client, Users, Teams } from 'node-appwrite';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const adminClient = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_SECRET_KEY!);

    const users = new Users(adminClient);
    const teams = new Teams(adminClient);

    // 1. Ensure the Clerk user exists in Appwrite
    try {
      await users.get(userId);
    } catch {
      await users.create(userId, undefined, undefined, undefined, "Support Agent");
    }

    // 2. Ensure they are part of the 'agents' team for global database access
    try {
      await teams.createMembership('agents', [], undefined, userId);
    } catch (e) {
      // Ignored: User is likely already a member of the team
    }

    // 3. Generate a secure, temporary token for the client SDK
    const token = await users.createToken(userId);
    return NextResponse.json({ token: token.secret });
  } catch (error) {
    console.error("Token generation failed:", error);
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 });
  }
}
