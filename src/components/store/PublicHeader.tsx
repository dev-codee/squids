"use client";

import Link from "next/link";
import Image from "next/image";
import RegionMenu from "@/components/store/RegionMenu";

export default function PublicHeader({ country = "" }: { country?: string }) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between sm:px-6 lg:px-8">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2" suppressHydrationWarning>
          <Image src="/logo.png" alt="Foxzil Logo" width={32} height={32} className="object-contain" priority />
          <span className="text-2xl font-black tracking-tight text-amber-500">Foxzil</span>
        </Link>

        {/* Region switcher */}
        <RegionMenu current={country} />
      </div>
    </header>
  );
}
