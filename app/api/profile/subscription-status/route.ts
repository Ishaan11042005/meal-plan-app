// app/api/profile/subscription/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { currentUser } from "@clerk/nextjs/server";
// import { user } from "@clerk/nextjs/server";

export async function GET() {
  const clerkUser = await currentUser();

  if (!clerkUser.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", clerkUser.id)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ subscription: null });
    }

    return NextResponse.json({ subscription: data });
  } catch (error: any) {
    console.error("Error fetching subscription:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch subscription details." },
      { status: 500 }
    );
  }
}
