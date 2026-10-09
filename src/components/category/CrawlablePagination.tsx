import Link from "next/link";

/**
 * Server-rendered pagination.
 *
 * Every page is a real <a href>, so crawlers and keyboard users can walk the
 * listing without JavaScript and without infinite scroll.
 */
export default function CrawlablePagination({
  page,
  totalPages,
  buildHref,
  previousLabel,
  nextLabel,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
  previousLabel: string;
  nextLabel: string;
}) {
  if (totalPages <= 1) return null;

  // Compact window: first, last, current and its neighbours.
  const wanted = new Set([1, totalPages, page - 1, page, page + 1]);
  const pages = Array.from(wanted)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const items: (number | "gap")[] = [];
  let prev = 0;
  for (const p of pages) {
    if (prev && p - prev > 1) items.push("gap");
    items.push(p);
    prev = p;
  }

  const base =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-[9px] border px-3 text-sm font-medium transition";

  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={buildHref(page - 1)} rel="prev" className={`${base} border-line bg-white text-ink-soft hover:border-line-strong hover:text-ink`}>
          ‹ {previousLabel}
        </Link>
      ) : (
        <span className={`${base} border-line bg-white text-ink-muted opacity-50`} aria-disabled="true">
          ‹ {previousLabel}
        </span>
      )}

      {items.map((item, i) =>
        item === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-ink-muted" aria-hidden>
            …
          </span>
        ) : item === page ? (
          <span
            key={item}
            aria-current="page"
            className={`${base} border-brand bg-brand text-white`}
          >
            {item}
          </span>
        ) : (
          <Link
            key={item}
            href={buildHref(item)}
            className={`${base} border-line bg-white text-ink-soft hover:border-line-strong hover:text-ink`}
          >
            {item}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link href={buildHref(page + 1)} rel="next" className={`${base} border-line bg-white text-ink-soft hover:border-line-strong hover:text-ink`}>
          {nextLabel} ›
        </Link>
      ) : (
        <span className={`${base} border-line bg-white text-ink-muted opacity-50`} aria-disabled="true">
          {nextLabel} ›
        </span>
      )}
    </nav>
  );
}
