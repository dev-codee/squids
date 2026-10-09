import { NextRequest, NextResponse } from "next/server";
import { closeNoResponse, sendFollowups, sendInitialRequests } from "@/lib/ppc/outreach";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Same allow-list as the other cron routes (Vercel Cron header or CRON_SECRET). */
function isAuthorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const querySecret = request.nextUrl.searchParams.get("secret");
  return querySecret === secret;
}

type Task = "send" | "followup" | "sweep" | "all";

function parseTask(value: string | null): Task {
  if (value === "followup" || value === "sweep" || value === "all") return value;
  return "send";
}

/**
 * GET /api/cron/ppc-outreach?task=send|followup|sweep|all
 *
 * Runs the PPC permission outreach jobs. Scheduled separately per task (see
 * `vercel.json` and `scripts/cron/run-ppc.sh`), following the same one-route,
 * one-param shape as `/api/cron/notify-subscribers?tier=`.
 *
 *   send      daily   — initial permission request for READY records
 *   followup  hourly  — the single follow-up once the window has passed
 *   sweep     daily   — close unanswered follow-ups as NO_RESPONSE
 *   all       —         all three in order; handy for manual runs
 *
 * `&dryRun=1` redirects every send to PPC_TEST_EMAIL instead of the merchant.
 * `&limit=n` caps how many records one invocation processes.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const task = parseTask(params.get("task"));
  const dryRun = params.get("dryRun") === "1" || params.get("dryRun") === "true";
  const limitParam = Number(params.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(100, limitParam) : undefined;

  try {
    // The per-job results carry the *effective* dry-run state, which is also on
    // when PPC_DRY_RUN is set in the environment. Only echo what was requested.
    const payload: Record<string, unknown> = { success: true, task, dryRunRequested: dryRun };

    if (task === "send" || task === "all") {
      payload.requests = await sendInitialRequests({ dryRun, limit });
    }
    if (task === "followup" || task === "all") {
      payload.followups = await sendFollowups({ dryRun, limit });
    }
    if (task === "sweep" || task === "all") {
      payload.sweep = await closeNoResponse();
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error(`[cron/ppc-outreach] task=${task} failed:`, error);
    return NextResponse.json(
      { success: false, task, error: (error as Error).message },
      { status: 500 },
    );
  }
}
