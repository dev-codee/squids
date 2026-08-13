"use client";

import Link from "next/link";
import Image from "next/image";
import { countryFlag, countryName } from "@/lib/countries";

export default function PublicHeader({ country = "" }: { country?: string }) {
  const cc = (country || "").toUpperCase();

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between sm:px-6 lg:px-8">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2" suppressHydrationWarning>
          <Image src="/logo.png" alt="Foxzil Logo" width={32} height={32} className="object-contain" priority />
          <span className="text-2xl font-black tracking-tight text-amber-500">Foxzil</span>
        </Link>

        {/* Region stores tab — lists all advertisers in the current region */}
        <Link
          href={`/${cc.toLowerCase()}`}
          className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 transition hover:border-amber-400 hover:bg-amber-50/40"
        >
          <span className="text-lg leading-none">{countryFlag(cc)}</span>
          <span>All Stores</span>
          {cc && (
            <span className="hidden text-gray-400 sm:inline">· {countryName(cc)}</span>
          )}
        </Link>
      </div>
    </header>
  );
}
