// app/api/profile/unsubscribe/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@clerk/nextjs";
import { stripe } from "@/lib/stripe";
import { currentUser } from "@clerk/nextjs/server";

export async function POST() {
  const clerkUser = await currentUser();

  if (!clerkUser.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Cancel the subscription in Stripe
    const canceledSubscription = await stripe.subscriptions.update(
      subscriptionId,
      {
        cancel_at_period_end: true, // Set to false to cancel immediately
      }
    );

    // Update Supabase with the new subscription tier
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        subscription_tier: null, // Or use plan.name or another identifier
        // If stripe_subscription_id is changing, update it here as well
        // stripe_subscription_id: updatedSubscription.id, // Uncomment if needed
        stripe_subscription_id: null,
        subscription_active: false,
      })
      .eq("user_id", clerkUser.id);

    if (updateError) {
      throw new Error(`Supabase Update Error: ${updateError.message}`);
    }

    return NextResponse.json({ subscription: canceledSubscription });
  } catch (error: any) {
    console.error("Error unsubscribing:", error.message);
    return NextResponse.json(
      { error: error.message || "Failed to unsubscribe." },
      { status: 500 }
    );
  }
}
