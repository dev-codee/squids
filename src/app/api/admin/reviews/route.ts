import { NextRequest, NextResponse } from "next/server";
import {
  createReview,
  updateReview,
  deleteReview,
  getNextReviewId,
} from "@/lib/db/reviews";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.advertiserId || !body.author || !body.rating) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const id = body.id ? Number(body.id) : await getNextReviewId();
    const review = {
      id,
      advertiserId: Number(body.advertiserId),
      author: body.author,
      rating: Number(body.rating),
      date: body.date || new Date().toISOString(),
      title: body.title || "",
      comment: body.comment || "",
      verifiedBuyer: body.verifiedBuyer !== false,
    };

    const created = await createReview(review);
    return NextResponse.json({ success: true, review: created });
  } catch (error) {
    console.error("Error creating review:", error);
    return NextResponse.json({ error: "Failed to create review." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body.id ? Number(body.id) : null;
    if (!id) return NextResponse.json({ error: "ID is required." }, { status: 400 });

    const success = await updateReview(id, body);
    if (!success) return NextResponse.json({ error: "Review not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating review:", error);
    return NextResponse.json({ error: "Failed to update review." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID is required." }, { status: 400 });

    const success = await deleteReview(Number(id));
    if (!success) return NextResponse.json({ error: "Review not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting review:", error);
    return NextResponse.json({ error: "Failed to delete review." }, { status: 500 });
  }
}
