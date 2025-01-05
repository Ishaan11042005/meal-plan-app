// src/middleware.ts or app/middleware.ts

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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
  const url = req.nextUrl.clone();

  // 2.a) If route is NOT public and user not signed in → sign in
  if (!isPublicRoute(req) && !userId) {
    return NextResponse.redirect(new URL("/sign-up", req.url));
  }

  if (isSignUpRoute(req) && userId) {
    return NextResponse.redirect(new URL("/mealplan", req.url));
  }

  // 2.b) If route is /mealplan, check subscription in Supabase
  if (isMealPlanRoute(req) || isProfileRoute(req)) {
    // Query the 'profiles' table for user’s subscription status
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("subscription_active")
      .eq("user_id", userId)
      .single();

    if (profileError && profileError.code !== "PGRST116") {
      // PGRST116: Row not found
      console.error("Supabase Select Error:", profileError.message);
      // Optionally handle the error
      return NextResponse.redirect(new URL("/subscribe", req.url));
    }

    // If no profile or subscription not active → redirect to /subscribe
    if (!profile?.subscription_active) {
      return NextResponse.redirect(new URL("/subscribe", req.url));
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
