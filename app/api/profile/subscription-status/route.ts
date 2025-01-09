import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";

export async function GET() {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user profile via Prisma
    const profile = await prisma.profile.findUnique({
      where: { userId: clerkUser.id },
    });

    // If no profile found, return null
    if (!profile) {
      return NextResponse.json({ subscription: null });
    }

    return NextResponse.json({ subscription: profile });
  } catch (error: any) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription details." },
      { status: 500 }
    );
  }
}
