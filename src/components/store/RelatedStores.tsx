import Link from "next/link";
import type { RelatedStoreItem } from "@/lib/storeData";

interface RelatedStoresProps {
  stores: RelatedStoreItem[];
  country: string;
  /** Section heading — the store page and the sidebar word it differently. */
  title?: string;
}

/** Cross-links to other advertisers sharing a category with the current store. */
export default function RelatedStores({ stores, country, title = "Similar stores" }: RelatedStoresProps) {
  if (stores.length === 0) return null;

  return (
    <div className="rounded-card border border-line bg-white p-5">
      <h2 className="mb-3 text-base font-bold text-ink">{title}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stores.map((store) => (
          <Link
            key={store.slug}
            href={`/${country}/${store.slug}`}
            className="flex flex-col items-center gap-1.5 rounded-card border border-line p-3 text-center transition hover:border-brand-border hover:bg-brand-soft/50"
          >
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md bg-canvas-sunk">
              {store.logoUrl ? (
                <img
                  src={store.logoUrl}
                  alt={`${store.name} logo`}
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <span className="text-sm font-bold text-ink-muted">
                  {store.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className="line-clamp-1 text-xs font-medium text-ink">{store.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
