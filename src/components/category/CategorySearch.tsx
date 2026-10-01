"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDictionary } from "@/i18n/DictionaryProvider";

/** Category directory search. Debounced into the URL so results stay linkable. */
export default function CategorySearch() {
  const dict = useDictionary();
  const t = dict.categoryV2;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get("q") || "";
  const [value, setValue] = useState(urlQuery);
  const typedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setValue(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (!typedRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = value.trim();
      if (q === urlQuery) return;
      router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, {
        scroll: false,
      });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, urlQuery, pathname, router]);

  return (
    <div className="relative mt-5 max-w-md">
      <input
        type="search"
        value={value}
        onChange={(e) => {
          typedRef.current = true;
          setValue(e.target.value);
        }}
        placeholder={t.searchCategories}
        aria-label={t.searchCategories}
        className="w-full rounded-card border border-line bg-white py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/15"
      />
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </span>
    </div>
  );
}
