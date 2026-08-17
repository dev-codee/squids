import { NextRequest, NextResponse } from "next/server";
import {
  getAdvertiserByIdFromDb,
  ensureAdvertiserStorePage,
} from "@/lib/db/advertisers";
import { getDealsFromDb } from "@/lib/db/deals";
import { getRegionConfig } from "@/lib/regions";
import { isAiConfigured } from "@/lib/ai/storeContent";
import { SUPPORTED_LOCALES, localeForCountry, languageNameForLocale, type SupportedLocale } from "@/lib/ai/languageNames";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/advertisers/generate-store-page
 *
 * Generate (and cache) AI store-page content for one advertiser via Claude.
 * Body: { id, network?, country?, locale?, language?, allLanguages?, force? }.
 * `force` regenerates existing content.
 * Protected by the admin session middleware.
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
    /* defaults */
  }

  const id = Number(body.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Valid advertiser id is required." }, { status: 400 });
  }
  const network = body.network ? String(body.network) : undefined;
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

  const region = getRegionConfig(body.country ? String(body.country) : "US");

  try {
    let advertiser = await getAdvertiserByIdFromDb(id, network);
    if (!advertiser) {
      return NextResponse.json({ error: "Advertiser not found." }, { status: 404 });
    }

    const dealsResult = await getDealsFromDb({
      advertiserId: id,
      status: "all",
      type: "all",
      page: 1,
      pageSize: 100,
      network,
    });

    for (const loc of targetLocales) {
      advertiser = await ensureAdvertiserStorePage(
        advertiser,
        dealsResult?.deals ?? [],
        {
          country: region.country,
          currency: region.currency,
          locale: loc,
          language: languageNameForLocale(loc),
        },
        { force, locale: loc },
      );
    }

    const primaryLoc = targetLocales[0] || "en";
    const storePage =
      advertiser.aiStorePageByLang?.[primaryLoc] ??
      (primaryLoc === "en" ? advertiser.aiStorePage : null) ??
      null;

    return NextResponse.json({
      ok: true,
      generated: Boolean(storePage),
      storePage,
      aiStorePageByLang: advertiser.aiStorePageByLang,
      aiStorePageAtByLang: advertiser.aiStorePageAtByLang,
      locales: targetLocales,
    });
  } catch (error) {
    console.error("Error generating store page:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate store page." },
      { status: 500 },
    );
  }
}
