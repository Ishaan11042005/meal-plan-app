// app/middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-up(.*)",
  "/subscribe(.*)",
  "/api/checkout(.*)",
  "/api/stripe-webhook(.*)",
  "/api/check-subscription(.*)",
]);

const isMealPlanRoute = createRouteMatcher(["/mealplan(.*)"]);
const isProfileRoute = createRouteMatcher(["/profile(.*)"]);
const isSignUpRoute = createRouteMatcher(["/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const userAuth = await auth();
  const { userId } = userAuth;
  const { pathname, origin } = req.nextUrl;

  // 💡 Skip subscription logic in development
  const isDev = process.env.NODE_ENV !== "production";

  if (pathname === "/api/check-subscription") {
    return NextResponse.next();
  }

  if (!isPublicRoute(req) && !userId) {
    return NextResponse.redirect(new URL("/sign-up", origin));
  }

  if (isSignUpRoute(req) && userId) {
    return NextResponse.redirect(new URL("/mealplan", origin));
  }

  // ✅ Skip subscription check if in development
  if (!isDev && (isMealPlanRoute(req) || isProfileRoute(req)) && userId) {
    try {
      const checkSubRes = await fetch(
        `${origin}/api/check-subscription?userId=${userId}`,
        {
          method: "GET",
          headers: {
            cookie: req.headers.get("cookie") || "",
          },
        }
      );

      if (checkSubRes.ok) {
        const data = await checkSubRes.json();
        if (!data.subscriptionActive) {
          return NextResponse.redirect(new URL("/subscribe", origin));
        }
      } else {
        return NextResponse.redirect(new URL("/subscribe", origin));
      }
    } catch (error) {
      console.error("Error calling /api/check-subscription:", error);
      return NextResponse.redirect(new URL("/subscribe", origin));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
