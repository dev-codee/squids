import { NextRequest, NextResponse } from "next/server";
import {
  createFAQ,
  updateFAQ,
  deleteFAQ,
  getNextFAQId,
} from "@/lib/db/faqs";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.advertiserId || !body.question || !body.answer) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const id = body.id ? Number(body.id) : await getNextFAQId();
    const faq = {
      id,
      advertiserId: Number(body.advertiserId),
      question: body.question,
      answer: body.answer,
    };

    const created = await createFAQ(faq);
    return NextResponse.json({ success: true, faq: created });
  } catch (error) {
    console.error("Error creating FAQ:", error);
    return NextResponse.json({ error: "Failed to create FAQ." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body.id ? Number(body.id) : null;
    if (!id) return NextResponse.json({ error: "ID is required." }, { status: 400 });

    const success = await updateFAQ(id, body);
    if (!success) return NextResponse.json({ error: "FAQ not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating FAQ:", error);
    return NextResponse.json({ error: "Failed to update FAQ." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID is required." }, { status: 400 });

    const success = await deleteFAQ(Number(id));
    if (!success) return NextResponse.json({ error: "FAQ not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting FAQ:", error);
    return NextResponse.json({ error: "Failed to delete FAQ." }, { status: 500 });
  }
}
