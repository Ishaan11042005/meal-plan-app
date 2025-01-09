// src/middleware.ts or app/middleware.ts

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client/edge";

const prisma = new PrismaClient();

// 1. Define your "public" routes that do NOT require authentication
const isPublicRoute = createRouteMatcher([
  "/", // homepage
  "/sign-up(.*)",
  "/subscribe(.*)", // subscription flow
  "/api/checkout(.*)", // Stripe checkout
  "/api/stripe-webhook(.*)",
  // Exclude profile routes to make them protected
]);

// 2. Define a route group for Meal Plan. We want to check subscription on these
const isMealPlanRoute = createRouteMatcher(["/mealplan(.*)"]);

// 3. Define a route group for Profile Routes (Protected but may not require subscription)
const isProfileRoute = createRouteMatcher(["/profile(.*)"]);

const isSignUpRoute = createRouteMatcher(["/sign-up(.*)"]);

/**
 * Clerk middleware logic:
 * - If route is not "public" & user isn't signed in → redirect to /sign-in
 * - If route is a Meal Plan route & user doesn't have active subscription → redirect to /subscribe
 * - If route is a Profile route & user isn't signed in → redirect to /
 */
export default clerkMiddleware(async (auth, req) => {
  const userAuth = await auth();
  const { userId } = userAuth;
  const url = req.url;

  // 2.a) If route is NOT public and user not signed in → sign in
  if (!isPublicRoute(req) && !userId) {
    return NextResponse.redirect(new URL("/sign-up", url));
  }

  // If already signed in and they visit /sign-up, redirect them to mealplan (or wherever)
  if (isSignUpRoute(req) && userId) {
    return NextResponse.redirect(new URL("/mealplan", url));
  }

  // 2.b) If route is /mealplan or /profile, check subscription in Prisma
  if (isMealPlanRoute(req) || isProfileRoute(req)) {
    try {
      const profile = await prisma.profile.findUnique({
        where: { userId: userId },
        select: { subscriptionActive: true },
      });

      console.log("pedroooo", profile);

      // If no profile found or subscription is not active → redirect to /subscribe
      if (!profile?.subscriptionActive) {
        return NextResponse.redirect(new URL("/subscribe", url));
      }
    } catch (error: any) {
      console.error("Prisma Select Error:", error?.message || error);
      return NextResponse.redirect(new URL("/subscribe", url));
    }
  }

  // 2.c) If route is /profile, ensure user is signed in (already handled above)
  // Additional checks for profile routes can be added here if necessary

  // Otherwise, do nothing special → allow the request
  return NextResponse.next();
});

// 4. Next.js route matching config
export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
