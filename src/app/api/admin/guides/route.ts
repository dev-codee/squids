import { NextRequest, NextResponse } from "next/server";
import {
  createGuide,
  updateGuide,
  deleteGuide,
  getNextGuideId,
} from "@/lib/db/buyingGuides";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.advertiserId || !body.title) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const id = body.id ? Number(body.id) : await getNextGuideId();
    const guide = {
      id,
      advertiserId: Number(body.advertiserId),
      title: body.title,
      readTime: body.readTime || "5 min read",
      summary: body.summary || "",
      category: body.category || "General",
      author: body.author || "Editorial Team",
      date: body.date || new Date().toISOString(),
    };

    const created = await createGuide(guide);
    return NextResponse.json({ success: true, guide: created });
  } catch (error) {
    console.error("Error creating guide:", error);
    return NextResponse.json({ error: "Failed to create guide." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body.id ? Number(body.id) : null;
    if (!id) return NextResponse.json({ error: "ID is required." }, { status: 400 });

    const success = await updateGuide(id, body);
    if (!success) return NextResponse.json({ error: "Guide not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating guide:", error);
    return NextResponse.json({ error: "Failed to update guide." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID is required." }, { status: 400 });

    const success = await deleteGuide(Number(id));
    if (!success) return NextResponse.json({ error: "Guide not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting guide:", error);
    return NextResponse.json({ error: "Failed to delete guide." }, { status: 500 });
  }
}
