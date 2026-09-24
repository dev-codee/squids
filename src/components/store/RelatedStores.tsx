import Link from "next/link";
import type { RelatedStoreItem } from "@/lib/storeData";

interface RelatedStoresProps {
  stores: RelatedStoreItem[];
  country: string;
}

/** Cross-links to other advertisers sharing a category with the current store. */
export default function RelatedStores({ stores, country }: RelatedStoresProps) {
  if (stores.length === 0) return null;

  return (
    <div className="bg-white p-5 rounded border border-gray-200">
      <h3 className="font-bold text-gray-900 mb-3">Similar Stores</h3>
      <div className="grid grid-cols-2 gap-2">
        {stores.map((store) => (
          <Link
            key={store.slug}
            href={`/${country}/${store.slug}`}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-gray-200 p-3 text-center transition hover:border-amber-300 hover:bg-amber-50/40"
          >
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md bg-gray-50">
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
                <span className="text-sm font-bold text-gray-400">
                  {store.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className="line-clamp-1 text-xs font-medium text-gray-700">{store.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
