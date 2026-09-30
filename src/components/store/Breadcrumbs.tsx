import Link from "next/link";

interface Crumb {
  label: string;
  href?: string;
}

/**
 * Store-page breadcrumb trail. Plain server component (no client JS needed) —
 * also doubles as a BreadcrumbList signal for search engines when paired with
 * the page's own JSON-LD.
 */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-xs text-ink-soft">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={idx} className="flex items-center gap-1">
              {idx > 0 && <span className="text-ink-muted">/</span>}
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-brand-hover hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? "font-medium text-ink-soft" : ""}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
