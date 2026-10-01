import { NextRequest, NextResponse } from "next/server";
import { runNetworkMigration } from "@/lib/db/migrate-network";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/migrate-network
 *
 * One-shot migration endpoint: stamps `network: "awin"` on all existing
 * documents and replaces the legacy `{ id: 1 }` unique index with a
 * composite `{ network: 1, id: 1 }` unique index.
 *
 * Protected by admin credentials (same as other admin endpoints).
 * Safe to re-run — idempotent.
 */
export async function POST(request: NextRequest) {
  // Simple auth check — same mechanism as other admin routes
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const isAuthed =
    (secret && authHeader === `Bearer ${secret}`) ||
    (secret && request.nextUrl.searchParams.get("secret") === secret);

  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await runNetworkMigration();

    console.log("[migrate-network] Migration complete:", results);

    return NextResponse.json({
      ok: true,
      migratedAt: new Date().toISOString(),
      results,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[migrate-network] Migration failed:", error);
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
