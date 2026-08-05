import { NextRequest, NextResponse } from "next/server";
import {
  fetchTransactions,
  queryTransactions,
  toCsv,
  type TransactionQuery,
} from "@/lib/transactions";

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

  try {
    // Fetch all transactions in the date range (auto-chunks if > 31 days).
    const all = await fetchTransactions(startDate, endDate);

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

    // CSV export mode
    if (params.get("format") === "csv") {
      // For CSV, apply filters but no pagination (export all matching)
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
