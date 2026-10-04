import { NextResponse } from "next/server";
import {
  validateCorrectionInput,
  type DisputeType,
  type CorrectionStatus,
} from "@/lib/model/correction";
import {
  createCorrection,
  getCorrections,
  updateCorrectionStatus,
  getCorrectionStats,
} from "@/lib/db/corrections";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = validateCorrectionInput(body);

    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", errors: validation.errors },
        { status: 400 },
      );
    }

    const ticket = await createCorrection(body);

    return NextResponse.json(
      {
        success: true,
        ticketId: ticket.id,
        message: "Your correction report has been received and queued for investigation.",
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[api/corrections] Failed to create correction:", error);
    return NextResponse.json(
      { error: "Failed to submit correction report" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") as CorrectionStatus) || undefined;
    const disputeType = (searchParams.get("disputeType") as DisputeType) || undefined;
    const country = searchParams.get("country") || undefined;
    const limit = Number(searchParams.get("limit") || "25");
    const offset = Number(searchParams.get("offset") || "0");

    const [result, stats] = await Promise.all([
      getCorrections({ status, disputeType, country, limit, offset }),
      getCorrectionStats(),
    ]);

    return NextResponse.json({
      items: result.items,
      total: result.total,
      stats,
    });
  } catch (error: any) {
    console.error("[api/corrections] Failed to list corrections:", error);
    return NextResponse.json(
      { error: "Failed to retrieve corrections" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, status, resolutionNotes, reviewedBy } = body;

    if (!id || !status || !reviewedBy) {
      return NextResponse.json(
        { error: "Missing required fields: id, status, reviewedBy" },
        { status: 400 },
      );
    }

    const updated = await updateCorrectionStatus(id, {
      status,
      resolutionNotes,
      reviewedBy,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Correction ticket not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      ticket: updated,
    });
  } catch (error: any) {
    console.error("[api/corrections] Failed to update correction:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update correction ticket" },
      { status: 400 },
    );
  }
}
