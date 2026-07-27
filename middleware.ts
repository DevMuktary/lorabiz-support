import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Protect everything EXCEPT the public widget, webhooks, and support APIs
const isProtectedRoute = createRouteMatcher([
  '/((?!api/webhooks|api/support/chat|api/support/ticket/close|widget).*$)'
])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
