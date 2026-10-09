import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export interface CommercialReportData {
  totalRevenue: number;
  approvedRevenue: number;
  pendingRevenue: number;
  declinedRevenue: number;
  approvedOrders: number;
  totalClicks: number;
  averageEpc: number; // Earnings Per Click = Approved Commission / Total Clicks
  averageOrderValue: number;
  reversalReasons: { reason: string; count: number; lostCommission: number }[];
  networkBreakdown: { network: string; revenue: number; orders: number }[];
  topMerchants: { name: string; revenue: number; orders: number }[];
}

/**
 * GET /api/admin/reports/commercial
 *
 * Computes approved commissions, EPC, reversal reasons, and merchant contributions.
 */
export async function GET() {
  try {
    const db = await getDb();
    const transactionsCol = db.collection("transactions");
    const clicksCol = db.collection("clicks");

    const [txDocs, clicksCount] = await Promise.all([
      transactionsCol.find({}).toArray(),
      clicksCol.countDocuments({}),
    ]);

    let approvedRev = 0;
    let pendingRev = 0;
    let declinedRev = 0;
    let approvedOrders = 0;
    let totalBasket = 0;

    const reversalMap = new Map<string, { count: number; lost: number }>();
    const networkMap = new Map<string, { revenue: number; orders: number }>();
    const merchantMap = new Map<string, { revenue: number; orders: number }>();

    for (const tx of txDocs) {
      const comm = Number(tx.commissionAmount || 0);
      const basket = Number(tx.orderValue || 0);
      const net = tx.network || "awin";
      const merch = tx.advertiserName || `Advertiser #${tx.advertiserId || "unknown"}`;

      if (tx.status === "approved") {
        approvedRev += comm;
        approvedOrders++;
        totalBasket += basket;

        // By network
        const netEntry = networkMap.get(net) || { revenue: 0, orders: 0 };
        netEntry.revenue += comm;
        netEntry.orders++;
        networkMap.set(net, netEntry);

        // By merchant
        const merchEntry = merchantMap.get(merch) || { revenue: 0, orders: 0 };
        merchEntry.revenue += comm;
        merchEntry.orders++;
        merchantMap.set(merch, merchEntry);
      } else if (tx.status === "pending") {
        pendingRev += comm;
      } else if (tx.status === "declined") {
        declinedRev += comm;
        const reason = tx.declineReason || "Unspecified / Cancelled order";
        const rev = reversalMap.get(reason) || { count: 0, lost: 0 };
        rev.count++;
        rev.lost += comm;
        reversalMap.set(reason, rev);
      }
    }

    const averageEpc = clicksCount > 0 ? approvedRev / clicksCount : 0;
    const averageOrderValue = approvedOrders > 0 ? totalBasket / approvedOrders : 0;

    const reversalReasons = Array.from(reversalMap.entries())
      .map(([reason, data]) => ({
        reason,
        count: data.count,
        lostCommission: Number(data.lost.toFixed(2)),
      }))
      .sort((a, b) => b.lostCommission - a.lostCommission);

    const networkBreakdown = Array.from(networkMap.entries())
      .map(([network, data]) => ({
        network,
        revenue: Number(data.revenue.toFixed(2)),
        orders: data.orders,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const topMerchants = Array.from(merchantMap.entries())
      .map(([name, data]) => ({
        name,
        revenue: Number(data.revenue.toFixed(2)),
        orders: data.orders,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const report: CommercialReportData = {
      totalRevenue: Number((approvedRev + pendingRev).toFixed(2)),
      approvedRevenue: Number(approvedRev.toFixed(2)),
      pendingRevenue: Number(pendingRev.toFixed(2)),
      declinedRevenue: Number(declinedRev.toFixed(2)),
      approvedOrders,
      totalClicks: clicksCount,
      averageEpc: Number(averageEpc.toFixed(4)),
      averageOrderValue: Number(averageOrderValue.toFixed(2)),
      reversalReasons,
      networkBreakdown,
      topMerchants,
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error("Commercial reports generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate commercial report" },
      { status: 500 },
    );
  }
}
