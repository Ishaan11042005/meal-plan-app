// app/api/profile/change-plan/route.ts

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
// import { useAuth } from "@clerk/nextjs"; // Not needed on server
import { stripe } from "@/lib/stripe";
import { currentUser } from "@clerk/nextjs/server";
import { availablePlans, getPriceIdFromType, Plan } from "@/lib/plans"; // Ensure correct import

export async function POST(request: Request) {
  const clerkUser = await currentUser();

  if (!clerkUser || !clerkUser.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { newPlan } = await request.json();

  if (!newPlan) {
    return NextResponse.json(
      { error: "New plan is required." },
      { status: 400 }
    );
  }

  try {
    // Fetch the user's current subscription
    const { data, error } = await supabase
      .from("profiles")
      .select("stripe_subscription_id")
      .eq("user_id", clerkUser.id)
      .single();

    if (error || !data.stripe_subscription_id) {
      throw new Error("No active subscription found.");
    }

    const subscriptionId = data.stripe_subscription_id;

    // Retrieve the current subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const subscriptionItemId = subscription.items.data[0]?.id;

    if (!subscriptionItemId) {
      throw new Error("Subscription item not found.");
    }

    // Update the subscription in Stripe
    const updatedSubscription = await stripe.subscriptions.update(
      subscriptionId,
      {
        cancel_at_period_end: false,
        items: [
          {
            id: subscriptionItemId,
            price: getPriceIdFromType(newPlan),
          },
        ],
        proration_behavior: "create_prorations",
      }
    );
    // Update Supabase with the new subscription tier
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        subscription_tier: newPlan, // Or use plan.name or another identifier
        // If stripe_subscription_id is changing, update it here as well
        // stripe_subscription_id: updatedSubscription.id, // Uncomment if needed
        stripe_subscription_id: updatedSubscription.id,
      })
      .eq("user_id", clerkUser.id);

    if (updateError) {
      throw new Error(`Supabase Update Error: ${updateError.message}`);
    }

    return NextResponse.json({ subscription: updatedSubscription });
  } catch (error: any) {
    console.error("Error changing subscription plan:", error.message);
    return NextResponse.json(
      { error: error.message || "Failed to change subscription plan." },
      { status: 500 }
    );
  }
}
