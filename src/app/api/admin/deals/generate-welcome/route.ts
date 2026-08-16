import { NextResponse } from "next/server";
import { generateWelcomeDeals } from "@/lib/db/deals";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/deals/generate-welcome
 *
 * Manually (re)generate generic "welcome" deals for every joined advertiser that
 * has no real deal yet, so those stores surface on the public pages. Idempotent:
 * existing welcome deals are left untouched, and redundant/orphaned ones are
 * cleaned up. Protected by the admin session middleware.
 */
export async function POST() {
  try {
    const result = await generateWelcomeDeals();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error generating welcome deals:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate welcome deals." },
      { status: 500 },
    );
  }
}
