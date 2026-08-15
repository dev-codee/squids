"use client";

export interface Filters {
  search: string;
  region: string;
  relationship: string;
  category?: string;
}

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  regions: string[];
  relationships: string[];
  categories?: string[];
}

const selectClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-card outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

export default function FilterBar({
  filters,
  onChange,
  regions,
  relationships,
  categories = [],
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {/* magnifier */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search advertisers by name…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 shadow-card outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>

        {categories.length > 0 && (
          <select
            value={filters.category || ""}
            onChange={(e) => onChange({ ...filters, category: e.target.value })}
            className={selectClass}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        <select
          value={filters.relationship}
          onChange={(e) =>
            onChange({ ...filters, relationship: e.target.value })
          }
          className={selectClass}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {relationships.map((r) => (
            <option key={r} value={r} className="capitalize">
              {r}
            </option>
          ))}
        </select>

        <select
          value={filters.region}
          onChange={(e) => onChange({ ...filters, region: e.target.value })}
          className={selectClass}
          aria-label="Filter by region"
        >
          <option value="">All regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
  );
}

