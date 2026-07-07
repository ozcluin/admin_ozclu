import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "src/lib/auth";
import { connectToDatabase } from "src/lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fullName } = await req.json();

    if (!fullName || typeof fullName !== "string" || fullName.trim().length < 1) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const trimmedName = fullName.trim();

    const { db } = await connectToDatabase();

    const userId = (session.user as any).id;

    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { $set: { fullName: trimmedName, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, fullName: trimmedName });
  } catch (error: any) {
    console.error("Error updating admin name:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update name" },
      { status: 500 }
    );
  }
}
