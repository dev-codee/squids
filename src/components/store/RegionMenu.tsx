"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { countryFlag, countryName } from "@/lib/countries";
import { REGION_CODES, REGION_COOKIE, REGION_COOKIE_MAX_AGE } from "@/lib/regions";

/**
 * Region switcher for the public header. Shows the visitor's current region as
 * a flag and lets them jump to any other region (`/us`, `/de`, `/pk`, …) to see
 * that region's advertisers. Options are the storefront regions plus every
 * country that actually has advertisers (from the advertiser facets).
 */
export default function RegionMenu({ current }: { current: string }) {
  const router = useRouter();
  const cur = (current || "").toUpperCase();

  const [open, setOpen] = useState(false);
  const [countries, setCountries] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Pull the set of countries that have advertisers (facets are computed from
  // the full dataset, independent of the current filters).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/advertisers?pageSize=1&relationship=joined&requireDeals=true")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && Array.isArray(j?.facets?.countries)) {
          setCountries(j.facets.countries as string[]);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const options = useMemo(() => {
    const set = new Set<string>([
      ...REGION_CODES,
      ...countries.map((c) => c.toUpperCase()),
    ]);
    if (cur) set.add(cur);
    let list = Array.from(set);
    const q = filter.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          countryName(c).toLowerCase().includes(q) || c.toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => countryName(a).localeCompare(countryName(b)));
  }, [countries, cur, filter]);

  function choose(code: string) {
    setOpen(false);
    setFilter("");
    // Remember the explicit choice so the root `/` redirect honours it later.
    document.cookie = `${REGION_COOKIE}=${code.toUpperCase()}; path=/; max-age=${REGION_COOKIE_MAX_AGE}; samesite=lax`;
    if (code.toLowerCase() !== current.toLowerCase()) {
      router.push(`/${code.toLowerCase()}`);
    }
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Choose your region"
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white py-1.5 pl-2.5 pr-2 text-sm text-gray-700 transition hover:border-amber-400 hover:bg-amber-50/40 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
      >
        <span className="text-lg leading-none">{countryFlag(cur)}</span>
        <span className="hidden max-w-[9rem] truncate font-medium sm:inline">
          {countryName(cur) || "Region"}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`text-gray-400 transition ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              autoFocus
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search regions…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/20"
            />
          </div>
          <ul role="listbox" className="max-h-72 overflow-y-auto p-1">
            {options.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-gray-400">
                No regions found
              </li>
            ) : (
              options.map((code) => {
                const active = code === cur;
                return (
                  <li key={code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => choose(code)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                        active
                          ? "bg-amber-50 font-semibold text-amber-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="text-lg leading-none">{countryFlag(code)}</span>
                      <span className="flex-1 truncate">{countryName(code)}</span>
                      {active && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-500">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
