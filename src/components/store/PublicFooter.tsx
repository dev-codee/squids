import Link from "next/link";
import Image from "next/image";
import type { Dictionary } from "@/i18n";

export default function PublicFooter({
  country = "",
  dict,
}: {
  country?: string;
  dict: Dictionary;
}) {
  const lc = (country || "").toLowerCase() || "us";
  const year = new Date().getFullYear();

  const links = [
    { label: dict.footer.home, href: `/${lc}` },
    { label: dict.footer.about, href: `/${lc}/about` },
    { label: dict.footer.privacy, href: `/${lc}/privacy` },
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
          {dict.footer.disclaimer}
        </p>

        <p className="mt-4 text-center text-xs text-gray-400">
          &copy; {year} Foxzil. {dict.footer.rights}
        </p>
      </div>
    </footer>
  );
}
