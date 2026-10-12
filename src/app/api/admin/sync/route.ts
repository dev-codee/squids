import { NextRequest, NextResponse } from "next/server";
import { GET as syncAdvertisers } from "@/app/api/cron/sync-advertisers/route";
import { GET as syncDeals } from "@/app/api/cron/sync-deals/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Protected by admin middleware. The cron credential stays on the server. */
export async function POST(request: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "Sync is not configured. Set the server CRON_SECRET." }, { status: 503 });
  try {
    const run = async (path: string, handler: typeof syncAdvertisers) => {
      const response = await handler(new NextRequest(new URL(path, request.url), {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }));
      const data = await response.json();
      const failed = Object.values(data.results ?? {}).some(result => result && typeof result === "object" && "error" in result);
      return response.ok && data.ok === true && !failed;
    };
    const advertisers = await run("/api/cron/sync-advertisers", syncAdvertisers);
    const deals = await run("/api/cron/sync-deals", syncDeals);
    return NextResponse.json({ ok: advertisers && deals, message: advertisers && deals ? "Stores and deals synced successfully." : "Sync finished with errors. Review the activity logs for failed networks." }, { status: advertisers && deals ? 200 : 502 });
  } catch {
    return NextResponse.json({ error: "Sync could not finish. Review the activity logs before retrying." }, { status: 500 });
  }
}
