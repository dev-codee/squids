"use client";

export interface DealsFilters {
  search: string;
  type: string;   // "all" | "voucher" | "deal" | "promotion"
  status: string;  // "all" | "active" | "expiringSoon"
}

interface DealsFilterBarProps {
  filters: DealsFilters;
  onChange: (filters: DealsFilters) => void;
}

const selectClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-card outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

export default function DealsFilterBar({
  filters,
  onChange,
}: DealsFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search deals by name or advertiser…"
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 shadow-card outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>

      <select
        value={filters.type}
        onChange={(e) => onChange({ ...filters, type: e.target.value })}
        className={selectClass}
        aria-label="Filter by type"
      >
        <option value="all">All types</option>
        <option value="voucher">Vouchers</option>
        <option value="deal">Deals</option>
        <option value="promotion">Promotions</option>
      </select>

      <select
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value })}
        className={selectClass}
        aria-label="Filter by status"
      >
        <option value="active">Active</option>
        <option value="expiringSoon">Expiring soon</option>
        <option value="all">All statuses</option>
      </select>
    </div>
  );
}
