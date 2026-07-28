import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// 1. Define public routes that should NOT require authentication
const isPublicRoute = createRouteMatcher([
  '/api/webhooks(.*)',             // Allow all inbound webhooks (Email, WhatsApp, etc.)
  '/api/support/email/outbound',    // Allow outbound email API calls
  '/sign-in(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // 2. Protect all routes EXCEPT those defined as public above
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/(.*?)\\.(?:html?|css|js(?!on)|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
