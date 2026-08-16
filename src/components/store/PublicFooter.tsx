import Link from "next/link";
import Image from "next/image";

export default function PublicFooter({ country = "" }: { country?: string }) {
  const lc = (country || "").toLowerCase() || "us";
  const year = new Date().getFullYear();

  const links = [
    { label: "Home", href: `/${lc}` },
    { label: "About", href: `/${lc}/about` },
    { label: "Privacy Policy", href: `/${lc}/privacy` },
  ];

  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Brand + nav */}
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <Link href={`/${lc}`} className="flex items-center gap-2" suppressHydrationWarning>
            <Image src="/logo.png" alt="Foxzil Logo" width={28} height={28} className="object-contain" />
            <span className="text-xl font-black tracking-tight text-amber-500">Foxzil</span>
          </Link>

          <nav>
            <ul className="flex items-center gap-6 text-sm font-medium">
              {links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-gray-600 transition-colors hover:text-amber-500"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Affiliate disclaimer */}
        <p className="mt-8 border-t border-gray-100 pt-6 text-center text-xs leading-relaxed text-gray-500">
          Foxzil is a website that presents deals, discounts, and coupons; these deals or offers are
          made available via different affiliate networks. Foxzil or its staff is not involved when
          you make a purchase via these links. Foxzil earns commission through these links/deals only.
        </p>

        <p className="mt-4 text-center text-xs text-gray-400">
          &copy; {year} Foxzil. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
