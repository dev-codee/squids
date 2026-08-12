"use client";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

/** Build a compact page list with ellipses, e.g. 1 … 4 5 [6] 7 8 … 20 */
function pageItems(page: number, totalPages: number): (number | "…")[] {
  const items = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const sorted = Array.from(items)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const result: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("…");
    result.push(p);
    prev = p;
  }
  return result;
}

const btnBase =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40";

export default function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">

      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button
          className={`${btnBase} border-gray-200 bg-white text-gray-600 hover:bg-gray-50`}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          ‹
        </button>

        {pageItems(page, totalPages).map((item, i) =>
          item === "…" ? (
            <span
              key={`gap-${i}`}
              className="inline-flex h-9 min-w-9 items-center justify-center text-sm text-gray-400"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              onClick={() => onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
              className={`${btnBase} ${
                item === page
                  ? "border-accent bg-accent text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {item}
            </button>
          ),
        )}

        <button
          className={`${btnBase} border-gray-200 bg-white text-gray-600 hover:bg-gray-50`}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          ›
        </button>
      </nav>
    </div>
  );
}
