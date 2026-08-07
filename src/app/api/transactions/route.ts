import { NextRequest, NextResponse } from "next/server";
import {
  fetchTransactions,
  queryTransactions,
  toCsv,
  buildSummary,
  type TransactionQuery,
} from "@/lib/transactions";
import {
  getTransactionsFromDb,
  getAllTransactionsFromDb,
} from "@/lib/db/transactions";

/**
 * GET /api/transactions?startDate=&endDate=&status=&advertiserId=&search=&page=1&pageSize=20&sortBy=&sortDir=&format=
 *
 * Primary: reads from MongoDB (fast, no Awin rate-limit concerns).
 * Fallback: fetches directly from Awin if MongoDB is empty or unavailable.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const startDate = params.get("startDate");
  const endDate = params.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate query params are required." },
      { status: 400 },
    );
  }

  const query: TransactionQuery = {
    startDate,
    endDate,
    status: params.get("status") || undefined,
    advertiserId: params.get("advertiserId") || undefined,
    search: params.get("search") || undefined,
    page: params.get("page") ? Number(params.get("page")) : undefined,
    pageSize: params.get("pageSize")
      ? Number(params.get("pageSize"))
      : undefined,
    sortBy: params.get("sortBy") || undefined,
    sortDir: (params.get("sortDir") as "asc" | "desc") || undefined,
  };

  const isCsvExport = params.get("format") === "csv";

  try {
    // Try MongoDB first
    try {
      if (isCsvExport) {
        // CSV export: get all matching transactions (no pagination)
        const allTx = await getAllTransactionsFromDb({
          ...query,
          page: 1,
          pageSize: 100_000,
        });
        if (allTx) {
          const csv = toCsv(allTx);
          return new NextResponse(csv, {
            status: 200,
            headers: {
              "Content-Type": "text/csv",
              "Content-Disposition": `attachment; filename="transactions-${startDate}-to-${endDate}.csv"`,
            },
          });
        }
      } else {
        const dbResult = await getTransactionsFromDb(query);
        if (dbResult) {
          return NextResponse.json(dbResult);
        }
      }
    } catch (dbError) {
      console.warn(
        "[/api/transactions] MongoDB unavailable, falling back to Awin API:",
        dbError instanceof Error ? dbError.message : dbError,
      );
    }

    // Fallback: fetch from Awin API directly
    const all = await fetchTransactions(startDate, endDate);

    if (isCsvExport) {
      const filtered = queryTransactions(all, {
        ...query,
        page: 1,
        pageSize: 100_000,
      });
      const csv = toCsv(filtered.transactions);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="transactions-${startDate}-to-${endDate}.csv"`,
        },
      });
    }

    const result = queryTransactions(all, query);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Transactions API error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to load transactions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
