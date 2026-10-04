"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { countryFlag, countryName } from "@/lib/countries";
import { REGION_CODES, REGION_COOKIE, REGION_COOKIE_MAX_AGE } from "@/lib/regions";
import { useDictionary } from "@/i18n/DictionaryProvider";
import type { Advertiser } from "@/lib/awin";
import { storeSlug } from "@/lib/networks";
import { useSavedItems } from "@/lib/savedItems";
import type {
  UnifiedSearchResult,
  UnifiedSearchProductItem,
  UnifiedSearchStoreItem,
  UnifiedSearchCategoryItem,
} from "@/app/api/search/unified/route";
import { trackSearchSubmit } from "@/lib/gtm";

export default function PublicHeader({ country = "" }: { country?: string }) {
  const dict = useDictionary();
  const cc = (country || "").toUpperCase();
  const lc = cc.toLowerCase() || "us";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { items: savedItems } = useSavedItems();

  const [searchQuery, setSearchQuery] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  // Tracks whether the current value came from the user typing (vs. a URL sync),
  // so live-filtering only fires in response to real input.
  const userTypedRef = useRef(false);

  // Live autocomplete: matching stores, products, and categories
  const [unifiedResults, setUnifiedResults] = useState<UnifiedSearchResult | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const urlSearch = searchParams.get("search") || "";

  useEffect(() => {
    setSearchQuery(urlSearch);
  }, [urlSearch]);

  // Fetch unified search suggestions as the user types (debounced).
  useEffect(() => {
    if (!userTypedRef.current) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setUnifiedResults(null);
      setSuggestOpen(false);
      setSuggestLoading(false);
      return;
    }
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    setSuggestLoading(true);
    setSuggestOpen(true);
    suggestDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/unified?q=${encodeURIComponent(q)}&country=${encodeURIComponent(cc)}&limit=4`,
        );
        const json = await res.json();
        setUnifiedResults(json || null);
      } catch {
        setUnifiedResults(null);
      } finally {
        setSuggestLoading(false);
      }
    }, 250);
    return () => {
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    };
  }, [searchQuery, cc]);

  // Close the suggestions dropdown when clicking outside the search box.
  useEffect(() => {
    if (!suggestOpen) return;
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [suggestOpen]);

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
    setSuggestOpen(false);
    const q = searchQuery.trim();
    if (q) {
      trackSearchSubmit(q, "all");
      router.push(`/${lc}?search=${encodeURIComponent(q)}`);
    } else {
      router.push(`/${lc}`);
    }
  };

  const selectStore = (store: UnifiedSearchStoreItem) => {
    setSuggestOpen(false);
    userTypedRef.current = false;
    setSearchQuery(store.name);
    trackSearchSubmit(store.name, "store", 1);
    router.push(`/${lc}/${store.slug}`);
  };

  const selectProduct = (product: UnifiedSearchProductItem) => {
    setSuggestOpen(false);
    userTypedRef.current = false;
    trackSearchSubmit(product.title, "product", 1);
    router.push(`/${lc}/product/${product.id}`);
  };

  const selectCategory = (cat: UnifiedSearchCategoryItem) => {
    setSuggestOpen(false);
    userTypedRef.current = false;
    trackSearchSubmit(cat.name, "category", 1);
    router.push(`/${lc}/category/${cat.slug}`);
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
    { label: dict.header.home, href: `/${lc}` },
    { label: dict.header.stores, href: `/${lc}/stores` },
    { label: dict.header.topDeals, href: `/${lc}/deals` },
    { label: dict.header.categories, href: `/${lc}/categories` },
  ];

  const isActive = (href: string) =>
    href === `/${lc}` ? pathname === `/${lc}` : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white">
      {/* Top row: logo, search, account actions */}
      <div className="mx-auto flex h-[72px] max-w-shell items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href={`/${lc}`} className="flex items-center gap-2 flex-shrink-0" suppressHydrationWarning>
          <Image src="/logo.png" alt="Foxzil Logo" width={32} height={32} className="object-contain" priority />
          <span className="hidden text-xl font-extrabold tracking-tight text-ink sm:inline">foxzil<span className="text-brand">.</span></span>
        </Link>

        {/* Centered Header Search Bar Pill */}
        <div className="flex flex-1 justify-center px-2 min-w-0">
          <div ref={searchRef} className="relative w-full max-w-md">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  userTypedRef.current = true;
                  setSearchQuery(e.target.value);
                }}
                onFocus={() => {
                  if (unifiedResults) setSuggestOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSuggestOpen(false);
                }}
                autoComplete="off"
                placeholder={dict.header.searchPlaceholder}
                className="w-full rounded-card border border-line bg-canvas py-2.5 pl-4 pr-11 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15"
              />
              <button
                type="submit"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted transition-colors hover:text-brand"
                aria-label="Search"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </button>
            </form>

            {/* Live unified suggestions dropdown */}
            {suggestOpen && searchQuery.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-card border border-line bg-white shadow-card-hover divide-y divide-line">
                {suggestLoading && !unifiedResults ? (
                  <div className="px-4 py-3 text-sm text-ink-muted">Searching catalog…</div>
                ) : !unifiedResults ||
                  (unifiedResults.stores.length === 0 &&
                    unifiedResults.products.length === 0 &&
                    unifiedResults.categories.length === 0) ? (
                  <div className="px-4 py-3 text-sm text-ink-muted">
                    No matching stores, products, or categories found.
                  </div>
                ) : (
                  <>
                    {/* Products */}
                    {unifiedResults.products.length > 0 && (
                      <div className="py-2">
                        <span className="block px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                          Products
                        </span>
                        <ul>
                          {unifiedResults.products.map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                onClick={() => selectProduct(p)}
                                className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-brand-soft"
                              >
                                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-[7px] border border-line bg-canvas">
                                  {p.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={p.imageUrl}
                                      alt={p.title}
                                      className="h-full w-full object-contain"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <span className="text-xs font-bold text-ink-muted">
                                      {p.title.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-semibold text-ink">
                                    {p.title}
                                  </span>
                                  <span className="block text-[11px] text-ink-muted truncate">
                                    {[p.brand, p.size, p.category].filter(Boolean).join(" · ")}
                                  </span>
                                </span>
                                {typeof p.salePrice === "number" && p.salePrice > 0 && (
                                  <span className="text-xs font-mono font-bold text-ink flex-shrink-0">
                                    ${p.salePrice.toFixed(2)}
                                  </span>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Stores */}
                    {unifiedResults.stores.length > 0 && (
                      <div className="py-2">
                        <span className="block px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                          Stores & Retailers
                        </span>
                        <ul>
                          {unifiedResults.stores.map((s) => (
                            <li key={s.id}>
                              <button
                                type="button"
                                onClick={() => selectStore(s)}
                                className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-brand-soft"
                              >
                                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-[7px] border border-line bg-canvas">
                                  {s.logoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={s.logoUrl}
                                      alt={s.name}
                                      className="h-full w-full object-contain"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <span className="text-xs font-bold text-ink-muted">
                                      {s.name.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-semibold text-ink">
                                    {s.name}
                                  </span>
                                  {s.dealCount !== undefined && s.dealCount > 0 && (
                                    <span className="text-[11px] text-ink-muted">
                                      {s.dealCount} active offers
                                    </span>
                                  )}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Categories */}
                    {unifiedResults.categories.length > 0 && (
                      <div className="py-2">
                        <span className="block px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                          Categories
                        </span>
                        <div className="flex flex-wrap gap-1.5 px-4 py-1">
                          {unifiedResults.categories.map((c) => (
                            <button
                              key={c.slug}
                              type="button"
                              onClick={() => selectCategory(c)}
                              className="rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-soft transition hover:border-brand hover:text-brand hover:bg-brand-soft"
                            >
                              {c.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Footer: Search all */}
                    <button
                      type="button"
                      onClick={handleSearchSubmit}
                      className="w-full bg-canvas px-4 py-2.5 text-left text-xs font-semibold text-brand transition hover:bg-brand-soft"
                    >
                      Search all results for &ldquo;{searchQuery}&rdquo; →
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right side: Saved items, Country dropdown & Sign in */}
        <div className="flex items-center gap-2.5 sm:gap-4 flex-shrink-0">
          {/* Saved items bookmark */}
          <Link
            href={`/${lc}/saved`}
            className="relative inline-flex items-center justify-center rounded-[9px] border border-line p-2 text-ink-soft transition-colors hover:border-brand hover:text-brand hover:bg-canvas"
            title="Saved products"
            aria-label="Saved products"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            {savedItems.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white shadow-xs">
                {savedItems.length}
              </span>
            )}
          </Link>

          {/* Country flag dropdown */}
          <div className="relative" ref={countryRef}>
            <button
              type="button"
              onClick={() => setCountryOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-[9px] border border-line px-2.5 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:border-line-strong hover:bg-canvas"
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
                className="absolute right-0 mt-2 max-h-80 w-56 overflow-y-auto rounded-card border border-line bg-white py-1 shadow-card-hover"
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
                          ? "bg-brand-soft font-medium text-brand"
                          : "text-ink-soft hover:bg-canvas"
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
              the admin login — that lives at a secret, unguessable URL and is
              never referenced on public pages. Swap this for the real user
              sign-in route when it ships. */}
          <button
            type="button"
            title="User accounts coming soon"
            className="cursor-default text-sm font-medium text-ink-muted"
            aria-disabled="true"
          >
            {dict.header.signIn}
          </button>
        </div>
      </div>

      {/* Bottom row: centered primary navigation */}
      <nav className="border-t border-line bg-white">
        <div className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8">
          <ul className="scrollbar-none flex items-center justify-center gap-6 overflow-x-auto py-3 text-sm font-medium sm:gap-8">
            {navLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className={`whitespace-nowrap transition-colors ${
                    isActive(link.href)
                      ? "text-brand"
                      : "text-ink-soft hover:text-brand"
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
