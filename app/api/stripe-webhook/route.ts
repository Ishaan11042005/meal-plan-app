// // app/api/webhooks/route.ts

// import { NextRequest, NextResponse } from "next/server";
// import Stripe from "stripe";
// import { supabase } from "@/lib/supabase"; // Ensure this path is correct

// // Initialize Stripe with the secret key and specify the API version
// const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// // Disable default body parsing to handle raw body for Stripe webhooks
// export const config = {
//   runtime: "edge", // Use Edge Runtime for better performance
//   api: {
//     bodyParser: false,
//   },
// };

// // Main handler for Stripe webhooks
// export async function POST(request: NextRequest) {
//   let event: Stripe.Event;
//   console.log("JHHHH");
//   try {
//     // Obtain the raw body as a string
//     const rawBody = await request.text();
//     const sig = request.headers.get("stripe-signature");

//     if (!sig) {
//       console.error("Missing Stripe signature.");
//       return NextResponse.json(
//         { error: "Missing Stripe signature." },
//         { status: 400 }
//       );
//     }

//     // Construct the Stripe event
//     event = stripe.webhooks.constructEvent(rawBody, sig, stripeWebhookSecret);
//     console.log(`✅ Received event: ${event.type}`);
//   } catch (err: any) {
//     console.error(`⚠️  Webhook signature verification failed: ${err.message}`);
//     return NextResponse.json(
//       { error: `Webhook Error: ${err.message}` },
//       { status: 400 }
//     );
//   }

//   // Handle the event
//   try {
//     switch (event.type) {
//       case "checkout.session.completed":
//         const session = event.data.object as Stripe.Checkout.Session;
//         await handleCheckoutSessionCompleted(session);
//         break;
//       case "invoice.payment_failed":
//         const invoice = event.data.object as Stripe.Invoice;
//         await handleInvoicePaymentFailed(invoice);
//         break;
//       case "customer.subscription.deleted":
//         const subscription = event.data.object as Stripe.Subscription;
//         await handleSubscriptionDeleted(subscription);
//         break;
//       // Add more event types as needed
//       default:
//         console.log(`Unhandled event type ${event.type}`);
//     }

//     // Acknowledge receipt of the event
//     return NextResponse.json({ received: true }, { status: 200 });
//   } catch (err: any) {
//     console.error(`Error handling event ${event.type}:`, err.message);
//     return NextResponse.json(
//       { error: `Webhook Error: ${err.message}` },
//       { status: 400 }
//     );
//   }
// }

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase"; // Ensure this path is correct
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  const body = await req.text();

  const signature = req.headers.get("stripe-signature");

  let data;
  let eventType;
  let event;

  // verify Stripe event is legit
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed. ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  data = event.data;
  eventType = event.type;

  try {
    switch (eventType) {
      case "checkout.session.completed":
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      case "invoice.payment_failed":
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      case "customer.subscription.deleted":
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      // Add more event types as needed
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (e) {
    console.error("stripe error: " + e.message + " | EVENT TYPE: " + eventType);
  }

  return NextResponse.json({});
}

// Handler for successful checkout sessions
const handleCheckoutSessionCompleted = async (
  session: Stripe.Checkout.Session
) => {
  const userId = session.metadata?.clerkUserId;
  console.log("Handling checkout.session.completed for user:", userId);

  if (!userId) {
    console.error("No userId found in session metadata.");
    return;
  }

  // Retrieve subscription ID from the session
  const subscriptionId = session.subscription as string;

  if (!subscriptionId) {
    console.error("No subscription ID found in session.");
    return;
  }

  // Update Supabase with subscription details
  const { error } = await supabase
    .from("profiles")
    .update({
      stripe_subscription_id: subscriptionId,
      subscription_active: true,
      subscription_tier: session.metadata.planType,
    })
    .eq("user_id", userId);

  if (error) {
    console.error("Supabase Update Error:", error.message);
  } else {
    console.log(`Subscription activated for user: ${userId}`);
  }
};

// Handler for failed invoice payments
const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice) => {
  const subscriptionId = invoice.subscription as string;
  console.log(
    "Handling invoice.payment_failed for subscription:",
    subscriptionId
  );

  if (!subscriptionId) {
    console.error("No subscription ID found in invoice.");
    return;
  }

  // Retrieve userId from subscription ID
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (error || !data) {
    console.error("Supabase Query Error:", error?.message || "No data found.");
    return;
  }

  const userId = data.user_id;

  // Update Supabase with payment failure
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      subscription_status: "past_due",
      subscription_active: false,
    })
    .eq("user_id", userId);

  if (updateError) {
    console.error("Supabase Update Error:", updateError.message);
  } else {
    console.log(`Subscription payment failed for user: ${userId}`);
  }
};

// Handler for subscription deletions (e.g., cancellations)
const handleSubscriptionDeleted = async (subscription: Stripe.Subscription) => {
  const subscriptionId = subscription.id;
  console.log(
    "Handling customer.subscription.deleted for subscription:",
    subscriptionId
  );

  // Retrieve userId from subscription ID
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (error || !data) {
    console.error("Supabase Query Error:", error?.message || "No data found.");
    return;
  }

  const userId = data.user_id;

  // Update Supabase with subscription cancellation
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      subscription_status: "canceled",
      subscription_active: false,
    })
    .eq("user_id", userId);

  if (updateError) {
    console.error("Supabase Update Error:", updateError.message);
  } else {
    console.log(`Subscription canceled for user: ${userId}`);
  }
};
