import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { CLICKS_COLLECTION, ClickDoc } from "@/lib/db/clicks";

export const dynamic = "force-dynamic";

interface ConversionExportRow {
  gclid: string;
  conversionName: string;
  conversionTime: string;
  conversionValue: number;
  conversionCurrency: string;
  orderId: string;
  merchantName: string;
  network: string;
}

/**
 * Format date for Google Ads Offline Conversions: "yyyy-mm-dd hh:mm:ss"
 */
function formatGoogleAdsTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  } catch {
    return dateStr;
  }
}

/**
 * GET /api/admin/conversions/export-google-ads
 *
 * Matches affiliate network transactions to recorded Foxzil clicks via subId,
 * retrieves the visitor's Google Click ID (gclid), and produces a Google Ads
 * Offline Conversion Import file (CSV or JSON).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const format = searchParams.get("format") || "csv";
    const conversionName = searchParams.get("conversionName") || "Affiliate Sale";
    const status = searchParams.get("status") || "approved";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const timeZone = searchParams.get("tz") || "+1000"; // Default to AU (+10:00)

    const db = await getDb();

    // 1. Query transactions that have a subId recorded
    const txFilter: Record<string, any> = {
      subId: { $exists: true, $ne: null },
    };

    if (status !== "all") {
      txFilter.status = status;
    }

    if (startDate || endDate) {
      txFilter.transactionDate = {};
      if (startDate) txFilter.transactionDate.$gte = startDate;
      if (endDate) txFilter.transactionDate.$lte = endDate;
    }

    const transactions = await db
      .collection("transactions")
      .find(txFilter)
      .sort({ transactionDate: -1 })
      .limit(1000)
      .toArray();

    if (transactions.length === 0) {
      if (format === "json") {
        return NextResponse.json({ rows: [], message: "No transactions with subId found." });
      }
      const csv = `Parameters:TimeZone=${timeZone}\nGoogle Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency,Order ID\n`;
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="google-ads-conversions-${Date.now()}.csv"`,
        },
      });
    }

    // 2. Fetch corresponding clicks by subId (clickId)
    const subIds = transactions.map((t) => t.subId).filter(Boolean);
    const clicks = await db
      .collection<ClickDoc>(CLICKS_COLLECTION)
      .find({ clickId: { $in: subIds } })
      .toArray();

    const clickMap = new Map<string, ClickDoc>();
    for (const c of clicks) {
      clickMap.set(c.clickId, c);
    }

    // 3. Build matched conversion rows
    const rows: ConversionExportRow[] = [];
    for (const tx of transactions) {
      const click = clickMap.get(tx.subId);
      // Only include if a Google Ads click ID (gclid) was captured
      if (click?.gclid) {
        rows.push({
          gclid: click.gclid,
          conversionName,
          conversionTime: formatGoogleAdsTime(tx.transactionDate),
          conversionValue: Number(tx.commission) || 0,
          conversionCurrency: tx.commissionCurrency || "AUD",
          orderId: `${tx.network || "aff"}-${tx.id}`,
          merchantName: tx.advertiserName || click.storeName || "Unknown",
          network: tx.network || "unknown",
        });
      }
    }

    if (format === "json") {
      return NextResponse.json({
        totalTransactions: transactions.length,
        matchedConversions: rows.length,
        rows,
      });
    }

    // 4. Generate Google Ads Offline Conversion CSV template
    const header = `Parameters:TimeZone=${timeZone}\nGoogle Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency,Order ID\n`;
    const csvRows = rows.map(
      (r) =>
        `"${r.gclid}","${r.conversionName}","${r.conversionTime}",${r.conversionValue},"${r.conversionCurrency}","${r.orderId}"`
    );

    const csvContent = header + csvRows.join("\n") + "\n";

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="google-ads-conversions-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error("[export-google-ads] Failed to generate conversion export:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
