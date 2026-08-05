"use client";

import type { Transaction } from "@/lib/transactions";

interface TransactionTableProps {
  transactions: Transaction[];
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (column: string) => void;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-50 text-green-700 ring-green-600/20",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  declined: "bg-red-50 text-red-700 ring-red-600/20",
  deleted: "bg-gray-50 text-gray-600 ring-gray-500/20",
};

const columns = [
  { key: "transactionDate", label: "Date", sortable: true },
  { key: "advertiserName", label: "Advertiser", sortable: true },
  { key: "orderValue", label: "Order Value", sortable: true },
  { key: "commission", label: "Commission", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "clickDate", label: "Click Date", sortable: true },
];

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function TransactionTable({
  transactions,
  sortBy,
  sortDir,
  onSort,
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: TransactionTableProps) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-card">
      {/* Scrollable table wrapper */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 ${
                    col.sortable
                      ? "cursor-pointer select-none hover:text-gray-700"
                      : ""
                  }`}
                  onClick={() => col.sortable && onSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortBy === col.key && (
                      <span className="text-accent">
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {transactions.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-gray-500"
                >
                  No transactions found for this period.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="transition hover:bg-gray-50/50"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {formatDate(tx.transactionDate)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900 truncate max-w-[200px]">
                        {tx.advertiserName}
                      </span>
                      <span className="text-xs text-gray-400">
                        ID: {tx.advertiserId}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                    {formatCurrency(tx.orderValue, tx.orderCurrency)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-accent">
                    {formatCurrency(tx.commission, tx.commissionCurrency)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${
                        STATUS_STYLES[tx.status] ??
                        "bg-gray-50 text-gray-600 ring-gray-500/20"
                      }`}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                    {formatDate(tx.clickDate)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-500">
            Showing{" "}
            <span className="font-medium text-gray-700">{from}</span>–
            <span className="font-medium text-gray-700">{to}</span> of{" "}
            {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹
            </button>
            <span className="px-2 text-xs text-gray-500">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
