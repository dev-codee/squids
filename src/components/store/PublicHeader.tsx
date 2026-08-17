"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { countryFlag, countryName } from "@/lib/countries";
import { REGION_CODES, REGION_COOKIE, REGION_COOKIE_MAX_AGE } from "@/lib/regions";

export default function PublicHeader({ country = "" }: { country?: string }) {
  const cc = (country || "").toUpperCase();
  const lc = cc.toLowerCase() || "us";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  // Tracks whether the current value came from the user typing (vs. a URL sync),
  // so live-filtering only fires in response to real input.
  const userTypedRef = useRef(false);

  const urlSearch = searchParams.get("search") || "";

  useEffect(() => {
    setSearchQuery(urlSearch);
  }, [urlSearch]);

  // Live-filter as the user types: debounce, then push the search term into the
  // URL. The home advertiser grid reacts to `?search=` and re-filters — no Enter
  // required. Typing from any page navigates to the country home with the query.
  useEffect(() => {
    if (!userTypedRef.current) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      const q = searchQuery.trim();
      if (q === urlSearch) return; // already reflected in the URL
      router.replace(q ? `/${lc}?search=${encodeURIComponent(q)}` : `/${lc}`);
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, urlSearch, lc, router]);

  // Close the country dropdown when clicking outside of it.
  useEffect(() => {
    if (!countryOpen) return;
    const onClick = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [countryOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const q = searchQuery.trim();
    router.push(q ? `/${lc}?search=${encodeURIComponent(q)}` : `/${lc}`);
  };

  const selectCountry = (code: string) => {
    const target = code.toLowerCase();
    document.cookie = `${REGION_COOKIE}=${code.toUpperCase()}; path=/; max-age=${REGION_COOKIE_MAX_AGE}`;
    setCountryOpen(false);
    router.push(`/${target}`);
  };

  // Region codes sorted by their human-friendly country name.
  const regions = [...REGION_CODES].sort((a, b) =>
    countryName(a).localeCompare(countryName(b)),
  );

  const navLinks = [
    { label: "Home", href: `/${lc}` },
    { label: "Stores", href: `/${lc}/stores` },
    { label: "Top Deals", href: `/${lc}/deals` },
    { label: "Categories", href: `/${lc}/categories` },
  ];

  const isActive = (href: string) =>
    href === `/${lc}` ? pathname === `/${lc}` : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      {/* Top row: logo, search, account actions */}
      <div className="mx-auto max-w-7xl px-4 h-20 flex items-center justify-between gap-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href={`/${lc}`} className="flex items-center gap-2 flex-shrink-0" suppressHydrationWarning>
          <Image src="/logo.png" alt="Foxzil Logo" width={32} height={32} className="object-contain" priority />
          <span className="text-2xl font-black tracking-tight text-amber-500 hidden sm:inline">Foxzil</span>
        </Link>

        {/* Centered Header Search Bar Pill */}
        <div className="flex flex-1 justify-center px-2 min-w-0">
          <form onSubmit={handleSearchSubmit} className="relative w-full max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                userTypedRef.current = true;
                setSearchQuery(e.target.value);
              }}
              placeholder="Search on Foxzil..."
              className="w-full rounded-full border border-gray-300 bg-white py-3 pl-5 pr-11 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
            />
            <button
              type="submit"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors"
              aria-label="Search"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>
          </form>
        </div>

        {/* Right side: Country dropdown & Sign in */}
        <div className="flex items-center gap-3 sm:gap-5 flex-shrink-0">
          {/* Country flag dropdown */}
          <div className="relative" ref={countryRef}>
            <button
              type="button"
              onClick={() => setCountryOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              aria-haspopup="listbox"
              aria-expanded={countryOpen}
            >
              <span className="text-base leading-none">{countryFlag(cc || "US")}</span>
              <span className="hidden lg:inline">{countryName(cc || "US")}</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform ${countryOpen ? "rotate-180" : ""}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {countryOpen && (
              <div
                role="listbox"
                className="absolute right-0 mt-2 max-h-80 w-56 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
              >
                {regions.map((code) => {
                  const selected = code === cc;
                  return (
                    <button
                      key={code}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => selectCountry(code)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                        selected
                          ? "bg-amber-50 text-amber-700 font-medium"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="text-base leading-none">{countryFlag(code)}</span>
                      <span className="flex-1 truncate">{countryName(code)}</span>
                      {selected && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* User accounts are coming soon. This intentionally does NOT link to
              the admin login (/login) — that URL stays unadvertised on public
              pages. Swap this for the real user sign-in route when it ships. */}
          <button
            type="button"
            title="User accounts coming soon"
            className="cursor-default text-sm font-medium text-gray-400"
            aria-disabled="true"
          >
            Sign in
          </button>
        </div>
      </div>

      {/* Bottom row: centered primary navigation */}
      <nav className="border-t border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ul className="flex items-center justify-center gap-6 sm:gap-10 py-2.5 text-sm font-medium">
            {navLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className={`transition-colors ${
                    isActive(link.href)
                      ? "text-amber-500"
                      : "text-gray-700 hover:text-amber-500"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  );
}
