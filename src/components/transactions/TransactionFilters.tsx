"use client";

interface TransactionFiltersProps {
  startDate: string;
  endDate: string;
  status: string;
  advertiserId: string;
  search: string;
  statuses: string[];
  advertisers: { id: number; name: string }[];
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onAdvertiserChange: (v: string) => void;
  onSearchChange: (v: string) => void;
  onExportCsv: () => void;
  loading?: boolean;
}

const inputClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-card outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

const selectClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-card outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

export default function TransactionFilters({
  startDate,
  endDate,
  status,
  advertiserId,
  search,
  statuses,
  advertisers,
  onStartDateChange,
  onEndDateChange,
  onStatusChange,
  onAdvertiserChange,
  onSearchChange,
  onExportCsv,
  loading,
}: TransactionFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by advertiser or transaction ID…"
            className={`w-full pl-9 pr-3 ${inputClass}`}
          />
        </div>

        {/* Status filter */}
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className={selectClass}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>

        {/* Advertiser filter */}
        <select
          value={advertiserId}
          onChange={(e) => onAdvertiserChange(e.target.value)}
          className={`max-w-[200px] truncate ${selectClass}`}
          aria-label="Filter by advertiser"
        >
          <option value="">All advertisers</option>
          {advertisers.map((a) => (
            <option key={a.id} value={String(a.id)}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Date range */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className={inputClass}
          />
          <label className="text-xs font-medium text-gray-500">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Export CSV */}
        <button
          onClick={onExportCsv}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-card transition hover:bg-gray-50 disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </button>
      </div>
    </div>
  );
}
