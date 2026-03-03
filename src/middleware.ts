import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/carriers(.*)",
  "/loads(.*)",
  "/events(.*)",
  "/alerts(.*)",
  "/settings(.*)",
  "/onboarding(.*)",
]);

const isPublicRoute = createRouteMatcher([
  "/tender(.*)",
  "/verify(.*)",
  "/driver(.*)",
  "/portal(.*)",
  "/login(.*)",
  "/signup(.*)",
  "/pricing(.*)",
  "/api/verification(.*)",
  "/api/webhooks(.*)",
  "/",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
