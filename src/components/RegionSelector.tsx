"use client";

import { useMemo } from "react";
import { countryFlag, countryName, normalizeCountryCode } from "@/lib/countries";

interface RegionSelectorProps {
  /** Currently selected country code, or "" for all regions. */
  value: string;
  /** Available country codes (from the advertiser facets). */
  countries: string[];
  onChange: (code: string) => void;
  /** True while the country is still being detected. */
  detecting?: boolean;
}

export default function RegionSelector({
  value,
  countries,
  onChange,
  detecting,
}: RegionSelectorProps) {
  const options = useMemo(() => {
    const set = new Set<string>();
    for (const c of countries) {
      const norm = normalizeCountryCode(c);
      if (norm) set.add(norm);
    }
    if (value) {
      const normValue = normalizeCountryCode(value);
      if (normValue) set.add(normValue);
    }
    return Array.from(set).sort((a, b) =>
      countryName(a).localeCompare(countryName(b)),
    );
  }, [countries, value]);


  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1.5 pl-3 pr-1.5 text-sm text-gray-600 shadow-card">
      {/* globe icon */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-gray-400"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </svg>

      <span className="text-gray-500">
        {detecting ? "Detecting your region…" : "Showing advertisers for"}
      </span>

      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={detecting}
          aria-label="Choose region"
          className="cursor-pointer appearance-none rounded-full bg-accent-soft py-1 pl-2.5 pr-7 text-sm font-medium text-accent outline-none transition hover:bg-indigo-100 focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
        >
          <option value="">🌐 All regions</option>
          {options.map((code) => (
            <option key={code} value={code}>
              {countryFlag(code)} {countryName(code)}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-accent">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </div>
    </div>
  );
}
