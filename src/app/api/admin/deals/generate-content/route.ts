import { NextRequest, NextResponse } from "next/server";
import {
  getDealByCompositeId,
  ensureDealAiContent,
  getDealsFromDb,
} from "@/lib/db/deals";
import { isAiConfigured } from "@/lib/ai/dealContent";
import { SUPPORTED_LOCALES, localeForCountry, type SupportedLocale } from "@/lib/ai/languageNames";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/deals/generate-content
 *
 * Generate (and cache) AI title/description for deals via Claude.
 *
 * Body:
 *   { id, network?, force?, locale?, country?, allLanguages? } → one deal
 *   { all: true, limit?, force?, locale?, country?, allLanguages? } → up to `limit` deals
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
  const allLanguages = Boolean(body.allLanguages || body.allLocales);

  // Determine target locales
  let targetLocales: SupportedLocale[] = [];
  if (allLanguages) {
    targetLocales = [...SUPPORTED_LOCALES];
  } else if (body.locale && typeof body.locale === "string") {
    const loc = body.locale.toLowerCase().split("-")[0];
    targetLocales = [SUPPORTED_LOCALES.includes(loc as SupportedLocale) ? (loc as SupportedLocale) : "en"];
  } else if (body.country && typeof body.country === "string") {
    targetLocales = [localeForCountry(body.country)];
  } else {
    targetLocales = ["en"];
  }

  try {
    // Single deal
    if (body.id !== undefined && body.id !== null && body.id !== "") {
      const id = Number(body.id);
      if (!Number.isFinite(id)) {
        return NextResponse.json({ error: "Invalid deal id." }, { status: 400 });
      }
      const network = body.network ? String(body.network) : "awin";
      let deal = await getDealByCompositeId(id, network);
      if (!deal) {
        return NextResponse.json({ error: "Deal not found." }, { status: 404 });
      }

      for (const loc of targetLocales) {
        deal = await ensureDealAiContent(deal, { force, locale: loc });
      }

      return NextResponse.json({
        ok: true,
        deal: {
          id: deal.id,
          network: deal.network,
          aiTitle: deal.aiTitle,
          aiDescription: deal.aiDescription,
          aiStatus: deal.aiStatus,
          aiIssues: deal.aiIssues,
          aiTitleByLang: deal.aiTitleByLang,
          aiDescriptionByLang: deal.aiDescriptionByLang,
          aiStatusByLang: deal.aiStatusByLang,
          aiGeneratedAtByLang: deal.aiGeneratedAtByLang,
        },
      });
    }

    // Bulk: generate for deals that haven't been attempted yet
    const limit = Math.max(1, Math.min(Number(body.limit) || 25, 100));
    const page = await getDealsFromDb({ status: "all", type: "all", page: 1, pageSize: 500 });
    const candidates = (page?.deals ?? []).filter((d) => {
      if (force) return true;
      if (allLanguages) {
        return SUPPORTED_LOCALES.some((loc) => !d.aiGeneratedAtByLang?.[loc]);
      }
      const primaryLoc = targetLocales[0] || "en";
      return !d.aiGeneratedAtByLang?.[primaryLoc] && !(primaryLoc === "en" && d.aiGeneratedAt);
    });

    const counts = { approved: 0, corrected: 0, review: 0, failed: 0 };
    for (const deal of candidates.slice(0, limit)) {
      let currentDeal = deal;
      for (const loc of targetLocales) {
        currentDeal = await ensureDealAiContent(currentDeal, { force, locale: loc });
      }
      const primaryLoc = targetLocales[0] || "en";
      const status = currentDeal.aiStatusByLang?.[primaryLoc] || currentDeal.aiStatus;
      const genAt = currentDeal.aiGeneratedAtByLang?.[primaryLoc] || currentDeal.aiGeneratedAt;

      if (!genAt) counts.failed += 1;
      else if (status === "APPROVED") counts.approved += 1;
      else if (status === "CORRECTED") counts.corrected += 1;
      else if (status === "REVIEW") counts.review += 1;
    }

    return NextResponse.json({
      ok: true,
      processed: Math.min(limit, candidates.length),
      remaining: Math.max(0, candidates.length - limit),
      locales: targetLocales,
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
