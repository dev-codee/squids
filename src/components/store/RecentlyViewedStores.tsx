"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "recentlyViewedStores";
/** How many visits we keep in storage vs. how many chips we actually show. */
const MAX_STORED = 12;
const MAX_SHOWN = 8;

interface RecentStoreEntry {
  slug: string;
  name: string;
  logoUrl: string | null;
  country: string;
  viewedAt: number;
}

interface RecentlyViewedStoresProps {
  /** The store on the page that rendered this — recorded as a visit, and never shown in its own list. */
  current: { slug: string; name: string; logoUrl: string | null; country: string };
  className?: string;
}

function readStored(): RecentStoreEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(
          (e): e is RecentStoreEntry =>
            e && typeof e.slug === "string" && typeof e.name === "string",
        )
      : [];
  } catch {
    // Private-browsing / quota / disabled storage — recently-viewed is a nice-to-have, fail silently.
    return [];
  }
}

function writeStored(entries: RecentStoreEntry[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* ignore — see readStored */
  }
}

/**
 * Per-visitor "recently viewed stores" strip, entirely client-side (no account,
 * no server round-trip). Records the current store into localStorage on mount,
 * then renders the rest of the list (deduped by slug, most recent first).
 *
 * Rendered from a `null` initial state so the server-rendered markup and the
 * first client render both produce nothing — avoids a hydration mismatch,
 * since the list only exists in this browser's localStorage.
 */
export default function RecentlyViewedStores({ current, className = "" }: RecentlyViewedStoresProps) {
  const [others, setOthers] = useState<RecentStoreEntry[] | null>(null);

  useEffect(() => {
    const existing = readStored().filter((e) => e.slug !== current.slug);
    const updated = [{ ...current, viewedAt: Date.now() }, ...existing].slice(0, MAX_STORED);
    writeStored(updated);
    setOthers(existing.slice(0, MAX_SHOWN));
    // Recording is keyed on which store this instance was mounted for — re-running
    // if `current` changes (e.g. client-side nav to another store) is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.slug]);

  if (!others || others.length === 0) return null;

  return (
    <div className={`bg-white p-4 rounded border border-gray-200 ${className}`}>
      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
        Recently Viewed
      </h3>
      <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
        {others.map((entry) => (
          <Link
            key={entry.slug}
            href={`/${entry.country}/${entry.slug}`}
            title={entry.name}
            className="flex w-16 flex-shrink-0 flex-col items-center gap-1.5 text-center group"
          >
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white p-1.5 transition group-hover:border-amber-300">
              {entry.logoUrl ? (
                <img
                  src={entry.logoUrl}
                  alt={`${entry.name} logo`}
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <span className="text-sm font-bold text-gray-400">
                  {entry.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className="line-clamp-1 text-[11px] text-gray-600 group-hover:text-amber-600">
              {entry.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
