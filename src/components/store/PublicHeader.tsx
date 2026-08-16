"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { countryFlag, countryName } from "@/lib/countries";

export default function PublicHeader({ country = "" }: { country?: string }) {
  const cc = (country || "").toUpperCase();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const q = searchParams.get("search") || "";
    setSearchQuery(q);
  }, [searchParams]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetCountry = (cc || "US").toLowerCase();
    const q = searchQuery.trim();
    if (q) {
      router.push(`/${targetCountry}?search=${encodeURIComponent(q)}`);
    } else {
      router.push(`/${targetCountry}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between gap-4 sm:px-6 lg:px-8">
        
        {/* Left side: Logo & Header Search Bar */}
        <div className="flex items-center gap-3 sm:gap-6 flex-1 min-w-0">
          {/* Logo */}
          <Link href={`/${cc.toLowerCase() || 'us'}`} className="flex items-center gap-2 flex-shrink-0" suppressHydrationWarning>
            <Image src="/logo.png" alt="Foxzil Logo" width={32} height={32} className="object-contain" priority />
            <span className="text-2xl font-black tracking-tight text-amber-500 hidden sm:inline">Foxzil</span>
          </Link>

          {/* Picodi-style Header Search Bar Pill */}
          <form onSubmit={handleSearchSubmit} className="relative w-full max-w-md flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search on Foxzil..."
              className="w-full rounded-full border border-gray-300 bg-white py-1.5 pl-4 pr-10 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
            />
            <button
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors"
              aria-label="Search"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>
          </form>
        </div>

        {/* Right side: Nav Links & Green Sign up/Explore button */}
        <div className="flex items-center gap-3 sm:gap-5 flex-shrink-0">
          <Link
            href={`/${cc.toLowerCase()}`}
            className="hidden md:inline-flex items-center text-sm font-medium text-gray-700 hover:text-amber-500 transition-colors"
          >
            All Stores
          </Link>

          {/* Country indicator */}
          {cc && (
            <span className="hidden lg:inline-flex items-center gap-1.5 text-sm font-medium text-gray-600">
              <span className="text-base leading-none">{countryFlag(cc)}</span>
              <span>{countryName(cc)}</span>
            </span>
          )}

          <Link
            href="/login"
            className="text-sm font-medium text-gray-700 hover:text-amber-500 transition-colors"
          >
            Sign in
          </Link>

          {/* Picodi-style Green Pill Button */}
          <Link
            href={`/${cc.toLowerCase()}`}
            className="rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-5 py-2 transition-colors shadow-sm flex items-center gap-1"
          >
            All Deals
          </Link>
        </div>
      </div>
    </header>
  );
}
