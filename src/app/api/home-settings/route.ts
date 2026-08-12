import { NextResponse } from "next/server";
import { getHomeSettings } from "@/lib/db/homeSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getHomeSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("GET /api/home-settings error:", error);
    return NextResponse.json({ error: "Failed to load home settings" }, { status: 500 });
  }
}
