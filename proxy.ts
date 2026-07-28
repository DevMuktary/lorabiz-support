import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// 1. Define public routes (Removed /sign-up from here!)
const isPublicRoute = createRouteMatcher([
  '/api/webhooks(.*)',
  '/api/support/email/outbound',
  '/sign-in(.*)',
  '/api/cron(.*)',         // ALLOWS CRON JOB TO PASS
  '/api/internal(.*)',     // ALLOWS MAIN APP VERIFICATION TO PASS
  '/api/support/chat(.*)'  // ALLOWS WEB WIDGET TO PASS
]);

// 2. Explicitly target the sign-up route
const isSignUpRoute = createRouteMatcher(['/sign-up(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // A. Block sign-ups entirely and kick them back to sign-in
  if (isSignUpRoute(req)) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  // B. Protect all routes EXCEPT those defined as public above
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

// 3. FIX THE BUILD ERROR: Updated, Next.js-compliant Regex Matcher
export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
