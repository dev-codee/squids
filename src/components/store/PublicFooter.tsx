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
    { label: dict.footer.methodology || "Methodology", href: `/${lc}/methodology` },
    { label: "Research", href: `/${lc}/research/delivered-cost-study` },
    { label: dict.header.stores, href: `/${lc}/stores` },
    { label: dict.header.categories, href: `/${lc}/categories` },
    { label: dict.footer.corrections || "Report Issue", href: `/${lc}/report-issue` },
    { label: dict.footer.privacy, href: `/${lc}/privacy` },
  ];

  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto max-w-shell px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <Link href={`/${lc}`} className="flex items-center gap-2" suppressHydrationWarning>
            <Image src="/logo.png" alt="Foxzil Logo" width={26} height={26} className="object-contain" />
            <span className="text-lg font-extrabold tracking-tight text-ink">
              foxzil<span className="text-brand">.</span>
            </span>
          </Link>

          <nav>
            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium">
              {links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-ink-soft transition-colors hover:text-brand"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Affiliate disclosure — required next to any outgoing offer link. */}
        <p className="mt-8 border-t border-line pt-6 text-center text-xs leading-relaxed text-ink-muted">
          {dict.footer.disclaimer}
        </p>

        <p className="mt-4 text-center text-xs text-ink-muted">
          &copy; {year} Foxzil. {dict.footer.rights}
        </p>
      </div>
    </footer>
  );
}
