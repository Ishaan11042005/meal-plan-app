// app/api/create-profile/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getAuth, currentUser } from "@clerk/nextjs/server";

export async function POST(request: NextRequest) {
  console.log(process.env.STRIPE_WEBHOOK_SECRET);
  try {
    // Retrieve user information from Clerk
    // This requires using Clerk's server-side SDK
    // Ensure you have installed @clerk/nextjs
    const clerkUser = await currentUser();

    if (!clerkUser) {
      return NextResponse.json(
        { error: "User not found in Clerk." },
        { status: 404 }
      );
    }

    const email = clerkUser.emailAddresses?.[0]?.emailAddress || "";

    if (!email) {
      return NextResponse.json(
        { error: "User does not have an email address." },
        { status: 400 }
      );
    }

    // Check if the profile already exists
    const { data: existingProfile, error: selectError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", clerkUser.id)
      .single();

    if (selectError && selectError.code !== "PGRST116") {
      // PGRST116: Row not found
      console.error("Supabase Select Error:", selectError.message);
      return NextResponse.json(
        { error: "Failed to check existing profile." },
        { status: 500 }
      );
    }

    if (existingProfile) {
      // Profile already exists, no action needed
      return NextResponse.json(
        { message: "Profile already exists." },
        { status: 200 }
      );
    }

    // Create a new profile with default subscription fields
    const { error: insertError } = await supabase.from("profiles").insert([
      {
        user_id: clerkUser.id, // Clerk user ID
        email: email, // User's email
        // subscription_active defaults to FALSE
        // stripe_subscription_id and subscription_tier default to NULL
      },
    ]);

    if (insertError) {
      console.error("Supabase Insert Error:", insertError.message);
      return NextResponse.json(
        { error: "Failed to create profile." },
        { status: 500 }
      );
    }

    console.log(`Supabase profile created for user: ${clerkUser.id}`);

    return NextResponse.json(
      { message: "Profile created successfully." },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error in create-profile API:", error.message);
    return NextResponse.json(
      { error: "Internal Server Error." },
      { status: 500 }
    );
  }
}
