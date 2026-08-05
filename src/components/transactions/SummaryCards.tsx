"use client";

import type { TransactionSummary } from "@/lib/transactions";

interface SummaryCardsProps {
  summary: TransactionSummary;
}

const cards = [
  {
    key: "totalCommission",
    label: "Total Commission",
    format: (s: TransactionSummary) =>
      `${s.currency} ${s.totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    color: "text-accent bg-accent-soft",
  },
  {
    key: "totalTransactions",
    label: "Total Transactions",
    format: (s: TransactionSummary) => s.totalTransactions.toLocaleString(),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    color: "text-blue-600 bg-blue-50",
  },
  {
    key: "pending",
    label: "Pending",
    format: (s: TransactionSummary) => s.pendingCount.toLocaleString(),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    color: "text-amber-600 bg-amber-50",
  },
  {
    key: "approved",
    label: "Approved",
    format: (s: TransactionSummary) => s.approvedCount.toLocaleString(),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    color: "text-green-600 bg-green-50",
  },
  {
    key: "declined",
    label: "Declined",
    format: (s: TransactionSummary) => s.declinedCount.toLocaleString(),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    color: "text-red-600 bg-red-50",
  },
  {
    key: "avgOrderValue",
    label: "Avg Order Value",
    format: (s: TransactionSummary) =>
      `${s.currency} ${s.avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    color: "text-purple-600 bg-purple-50",
  },
] as const;

export default function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <div
          key={card.key}
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-card transition hover:shadow-card-hover"
        >
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.color}`}
            >
              {card.icon}
            </div>
          </div>
          <p className="mt-3 text-lg font-semibold tracking-tight text-gray-900">
            {card.format(summary)}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
