import { NextRequest, NextResponse } from "next/server";
import {
  getMatchReviews,
  ruleOnMatch,
  countPendingMatchReviews,
  type MatchReviewStatus,
} from "@/lib/db/match-reviews";
import { getProductById } from "@/lib/db/products";

export const dynamic = "force-dynamic";

const STATUSES: MatchReviewStatus[] = [
  "pending",
  "approved",
  "rejected",
  "split-variant",
  "needs-data",
];

/**
 * The review queue, with both products' identity fields resolved so a reviewer
 * can compare them side by side without opening two other screens.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const statusParam = sp.get("status");
    const status =
      statusParam && STATUSES.includes(statusParam as MatchReviewStatus)
        ? (statusParam as MatchReviewStatus)
        : undefined;

    const paged = await getMatchReviews({
      status,
      page: Number(sp.get("page")) || 1,
      pageSize: Number(sp.get("pageSize")) || 25,
    });

    const items = await Promise.all(
      paged.items.map(async (item) => {
        const [source, candidate] = await Promise.all([
          getProductById(item.sourceProductId).catch(() => null),
          getProductById(item.candidateProductId).catch(() => null),
        ]);
        return { ...item, source, candidate };
      }),
    );

    return NextResponse.json({
      ...paged,
      items,
      pending: await countPendingMatchReviews().catch(() => 0),
    });
  } catch (error) {
    console.error("Error loading match reviews:", error);
    return NextResponse.json({ error: "Failed to load the queue." }, { status: 500 });
  }
}

/**
 * Record a decision.
 *
 * An approval must name its reviewer: a manual exact-match claim with nobody
 * behind it is exactly what `isPublishableExactMatch` refuses to publish, so it
 * is refused here rather than written and silently ignored later.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pairId = String(body.pairId ?? "");
    const status = String(body.status ?? "") as MatchReviewStatus;
    const reviewedBy = String(body.reviewedBy ?? "").trim();

    if (!pairId) {
      return NextResponse.json({ error: "pairId is required." }, { status: 400 });
    }
    if (!STATUSES.includes(status) || status === "pending") {
      return NextResponse.json({ error: "A decision is required." }, { status: 400 });
    }
    if (status === "approved" && !reviewedBy) {
      return NextResponse.json(
        { error: "An approved match must name its reviewer." },
        { status: 400 },
      );
    }

    const ok = await ruleOnMatch({
      pairId,
      status,
      reviewedBy: reviewedBy || "unattributed",
      notes: body.notes ? String(body.notes) : null,
    });
    if (!ok) {
      return NextResponse.json({ error: "Pair not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error ruling on a match:", error);
    const message = error instanceof Error ? error.message : "Failed to save.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
