import Link from "next/link";
import type { RelatedStoreItem } from "@/lib/storeData";

interface RelatedStoresProps {
  stores: RelatedStoreItem[];
  country: string;
  /** Section heading — the store page and the sidebar word it differently. */
  title?: string;
  /**
   * "sidebar" keeps four tiles on one row inside the narrow rail; the default
   * is the full-width band below the offers.
   */
  variant?: "default" | "sidebar";
}

/**
 * Cross-links to other stores.
 *
 * The list is assembled in `loadStoreData`: an editor's pinned picks first,
 * then stores sharing a category, then the region's flagship stores — so this
 * renders a full row even for a visitor who has opened nothing else.
 */
export default function RelatedStores({
  stores,
  country,
  title = "Similar stores",
  variant = "default",
}: RelatedStoresProps) {
  if (stores.length === 0) return null;

  const sidebar = variant === "sidebar";

  return (
    <div className={`rounded-card border border-line bg-white ${sidebar ? "p-4" : "p-5"}`}>
      <h2 className={`mb-3 font-bold text-ink ${sidebar ? "text-xs uppercase tracking-wide text-ink-soft" : "text-base"}`}>
        {title}
      </h2>
      <div className={`grid gap-2 ${sidebar ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4"}`}>
        {stores.map((store) => (
          <Link
            key={store.slug}
            href={`/${country}/${store.slug}`}
            className={`flex flex-col items-center gap-1.5 rounded-card border border-line text-center transition hover:border-brand-border hover:bg-brand-soft/50 ${sidebar ? "p-2" : "p-3"}`}
          >
            <div className={`flex items-center justify-center overflow-hidden rounded-md bg-canvas-sunk ${sidebar ? "h-8 w-8" : "h-9 w-9"}`}>
              {store.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={store.logoUrl}
                  alt={`${store.name} logo`}
                  className="max-h-full max-w-full object-contain"
                  loading="lazy"
                />
              ) : (
                <span className="text-sm font-bold text-ink-muted">
                  {store.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className={`line-clamp-1 font-medium text-ink ${sidebar ? "text-[11px]" : "text-xs"}`}>
              {store.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
