import { NextRequest, NextResponse } from "next/server";
import {
  getDealByCompositeId,
  ensureDealAiContent,
  getDealsFromDb,
} from "@/lib/db/deals";
import { isAiConfigured } from "@/lib/ai/dealContent";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/deals/generate-content
 *
 * Generate (and cache) AI title/description for deals via Claude.
 *
 * Body:
 *   { id, network?, force? }         → one deal (force re-generates)
 *   { all: true, limit?, force? }    → up to `limit` deals missing AI copy
 *
 * Protected by the admin session middleware. Idempotent unless `force` is set —
 * deals that already have AI copy are skipped, so tokens aren't spent twice.
 */
export async function POST(request: NextRequest) {
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI is not configured. Set ANTHROPIC_API_KEY on the server." },
      { status: 400 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    /* empty body is fine for defaults */
  }

  const force = Boolean(body.force);

  try {
    // Single deal
    if (body.id !== undefined && body.id !== null && body.id !== "") {
      const id = Number(body.id);
      if (!Number.isFinite(id)) {
        return NextResponse.json({ error: "Invalid deal id." }, { status: 400 });
      }
      const network = body.network ? String(body.network) : "awin";
      const deal = await getDealByCompositeId(id, network);
      if (!deal) {
        return NextResponse.json({ error: "Deal not found." }, { status: 404 });
      }
      const updated = await ensureDealAiContent(deal, { force });
      return NextResponse.json({
        ok: true,
        deal: {
          id: updated.id,
          network: updated.network,
          aiTitle: updated.aiTitle,
          aiDescription: updated.aiDescription,
          aiStatus: updated.aiStatus,
          aiIssues: updated.aiIssues,
        },
      });
    }

    // Bulk: generate for deals that haven't been attempted yet
    const limit = Math.max(1, Math.min(Number(body.limit) || 25, 100));
    const page = await getDealsFromDb({ status: "all", type: "all", page: 1, pageSize: 500 });
    const candidates = (page?.deals ?? []).filter((d) => force || !d.aiGeneratedAt);

    const counts = { approved: 0, corrected: 0, review: 0, failed: 0 };
    for (const deal of candidates.slice(0, limit)) {
      const updated = await ensureDealAiContent(deal, { force });
      if (!updated.aiGeneratedAt && !deal.aiGeneratedAt) counts.failed += 1;
      else if (updated.aiStatus === "APPROVED") counts.approved += 1;
      else if (updated.aiStatus === "CORRECTED") counts.corrected += 1;
      else if (updated.aiStatus === "REVIEW") counts.review += 1;
    }

    return NextResponse.json({
      ok: true,
      processed: Math.min(limit, candidates.length),
      remaining: Math.max(0, candidates.length - limit),
      ...counts,
    });
  } catch (error) {
    console.error("Error generating deal AI content:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate AI content." },
      { status: 500 },
    );
  }
}
