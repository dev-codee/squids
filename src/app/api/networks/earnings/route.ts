import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

interface NetworkEarnings {
  network: string;
  totalCommission: number;
  pendingCommission: number;
  approvedCommission: number;
  transactionCount: number;
  pendingCount: number;
  approvedCount: number;
  declinedCount: number;
  currency: string;
}

/**
 * GET /api/networks/earnings
 *
 * Aggregates commission totals from the transactions collection, grouped by
 * network. Returns per-network and combined totals for the All Networks view.
 */
export async function GET() {
  try {
    const db = await getDb();
    const col = db.collection("transactions");

    // Check if there's any data
    const count = await col.estimatedDocumentCount();
    if (count === 0) {
      return NextResponse.json({
        combined: {
          totalCommission: 0,
          pendingCommission: 0,
          approvedCommission: 0,
          transactionCount: 0,
          pendingCount: 0,
          approvedCount: 0,
          declinedCount: 0,
          currency: "USD",
        },
        networks: [],
      });
    }

    const pipeline = [
      {
        $group: {
          _id: { $ifNull: ["$network", "awin"] },
          totalCommission: { $sum: "$commission" },
          pendingCommission: {
            $sum: {
              $cond: [{ $eq: ["$status", "pending"] }, "$commission", 0],
            },
          },
          approvedCommission: {
            $sum: {
              $cond: [{ $eq: ["$status", "approved"] }, "$commission", 0],
            },
          },
          transactionCount: { $sum: 1 },
          pendingCount: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          approvedCount: {
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
          },
          declinedCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$status", "declined"] },
                    { $eq: ["$status", "deleted"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          currency: { $first: "$commissionCurrency" },
        },
      },
      { $sort: { _id: 1 as const } },
    ];

    const results = await col.aggregate(pipeline).toArray();

    const networks: NetworkEarnings[] = results.map((r) => ({
      network: r._id as string,
      totalCommission: Math.round((r.totalCommission as number) * 100) / 100,
      pendingCommission: Math.round((r.pendingCommission as number) * 100) / 100,
      approvedCommission: Math.round((r.approvedCommission as number) * 100) / 100,
      transactionCount: r.transactionCount as number,
      pendingCount: r.pendingCount as number,
      approvedCount: r.approvedCount as number,
      declinedCount: r.declinedCount as number,
      currency: (r.currency as string) || "USD",
    }));

    // Combined totals
    const combined = {
      totalCommission: Math.round(
        networks.reduce((sum, n) => sum + n.totalCommission, 0) * 100,
      ) / 100,
      pendingCommission: Math.round(
        networks.reduce((sum, n) => sum + n.pendingCommission, 0) * 100,
      ) / 100,
      approvedCommission: Math.round(
        networks.reduce((sum, n) => sum + n.approvedCommission, 0) * 100,
      ) / 100,
      transactionCount: networks.reduce((sum, n) => sum + n.transactionCount, 0),
      pendingCount: networks.reduce((sum, n) => sum + n.pendingCount, 0),
      approvedCount: networks.reduce((sum, n) => sum + n.approvedCount, 0),
      declinedCount: networks.reduce((sum, n) => sum + n.declinedCount, 0),
      currency: networks[0]?.currency || "USD",
    };

    return NextResponse.json({ combined, networks });
  } catch (error) {
    console.error("[/api/networks/earnings] Error:", error);
    return NextResponse.json(
      { error: "Failed to load earnings data." },
      { status: 500 },
    );
  }
}
