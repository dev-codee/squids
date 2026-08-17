import Link from "next/link";
import type { Advertiser } from "@/lib/awin";
import { countryName, normalizeCountryCode } from "@/lib/countries";

const RELATIONSHIP_STYLES: Record<string, string> = {
  joined: "bg-green-50 text-green-700 ring-green-600/20",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  notjoined: "bg-gray-50 text-gray-600 ring-gray-500/20",
};


function StatusBadge({ relationship }: { relationship: string | null }) {
  if (!relationship) return null;
  const style =
    RELATIONSHIP_STYLES[relationship.toLowerCase()] ??
    "bg-gray-50 text-gray-600 ring-gray-500/20";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${style}`}
    >
      {relationship}
    </span>
  );
}

interface AdvertiserCardProps {
  advertiser: Advertiser;
  /** 2-letter country code (lowercase) for building the detail link. */
  country?: string;
  /** Admin dashboard detail URL. */
  adminHref?: string;
}

export default function AdvertiserCard({
  advertiser,
  country,
  adminHref,
}: AdvertiserCardProps) {
  const content = (
    <div className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-card transition hover:border-gray-300 hover:shadow-card-hover cursor-pointer h-full justify-between">
      <div>
        <div className="flex items-start gap-4 pr-16">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
            {advertiser.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={advertiser.logoUrl}
                alt={`${advertiser.name} logo`}
                className="h-full w-full object-contain"
                loading="lazy"
              />
            ) : (
              <span className="text-lg font-semibold text-gray-400">
                {advertiser.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-gray-900 group-hover:text-accent transition">
              {advertiser.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-[11px] font-mono text-gray-400">#{advertiser.id}</p>
              <span className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.2 text-[10px] font-bold text-blue-700 uppercase tracking-wide border border-blue-100">
                {advertiser.network || "awin"}
              </span>
            </div>
          </div>
          <StatusBadge relationship={advertiser.relationship} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs border-t border-gray-100 pt-3">
          <div>
            <dt className="text-gray-400">Network</dt>
            <dd className="mt-0.5 font-bold uppercase text-blue-700">
              {advertiser.network || "awin"}
            </dd>
          </div>

          <div>
            <dt className="text-gray-400">Total Deals / Offers</dt>
            <dd className="mt-0.5 font-bold text-emerald-600">
              {advertiser.dealCount ?? 0} {advertiser.dealCount === 1 ? "offer" : "offers"}
            </dd>
          </div>

          {(advertiser.region || advertiser.countryCode) && (
            <div>
              <dt className="text-gray-400">Region</dt>
              <dd className="mt-0.5 font-medium text-gray-700">
                {(() => {
                  const norm = normalizeCountryCode(advertiser.countryCode || advertiser.region);
                  if (norm === "WW" || advertiser.region === "00" || advertiser.countryCode === "00") {
                    return "Worldwide";
                  }
                  const name = countryName(norm || advertiser.countryCode || advertiser.region);
                  return name ? `${name}${norm ? ` (${norm})` : ""}` : advertiser.region;
                })()}
              </dd>
            </div>
          )}

          {advertiser.commission && (
            <div>
              <dt className="text-gray-400">Commission</dt>
              <dd className="mt-0.5 font-medium text-gray-700">
                {advertiser.commission}
              </dd>
            </div>
          )}
          {advertiser.currencyCode && (
            <div>
              <dt className="text-gray-400">Currency</dt>
              <dd className="mt-0.5 font-medium text-gray-700">
                {advertiser.currencyCode}
              </dd>
            </div>
          )}
          {advertiser.status && (
            <div>
              <dt className="text-gray-400">Status</dt>
              <dd className="mt-0.5 font-medium capitalize text-gray-700">
                {advertiser.status}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* View deals prompt */}
      {(country || adminHref) && (
        <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-accent group-hover:text-accent-hover">
          View deals & promotions
          <span aria-hidden>→</span>
        </div>
      )}

      {/* External store link when not clickable as internal page */}
      {!country && !adminHref && advertiser.url && (
        <a
          href={advertiser.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover"
          onClick={(e) => e.stopPropagation()}
        >
          Visit advertiser
          <span aria-hidden>→</span>
        </a>
      )}
    </div>
  );

  if (adminHref) {
    return (
      <Link href={adminHref} className="block h-full">
        {content}
      </Link>
    );
  }

  // Public pages view
  if (country) {
    const slug = advertiser.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    return (
      <Link href={`/${country.toLowerCase()}/${slug}`} className="block h-full">
        <div className={`relative group flex flex-col items-center justify-between rounded-xl border bg-white p-3 shadow-sm transition cursor-pointer h-28 sm:h-32 ${
          advertiser.isFlagship 
            ? "border-amber-400 hover:border-amber-500 shadow-md hover:shadow-lg bg-amber-50/10" 
            : "border-gray-200 hover:border-amber-300 hover:shadow-md"
        }`}>
          {advertiser.isFlagship && (
            <div className="absolute -top-2.5 right-2 bg-gradient-to-r from-amber-400 to-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm z-10">
              FLAGSHIP
            </div>
          )}

          {/* 70% height for Store Logo / Image */}
          <div className="h-[68%] w-full flex items-center justify-center overflow-hidden pb-1">
            {advertiser.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={advertiser.logoUrl}
                alt={`${advertiser.name} logo`}
                className="max-h-full max-w-[90%] object-contain filter group-hover:scale-105 transition-transform"
                loading="lazy"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold text-base shadow-inner">
                {advertiser.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Store Name below the image */}
          <div className="h-[32%] w-full flex items-center justify-center border-t border-gray-100 pt-1 text-center">
            <span className="text-xs font-bold text-gray-800 truncate px-1 group-hover:text-amber-600 transition-colors">
              {advertiser.name}
            </span>
          </div>

          {advertiser.dealCount !== undefined && advertiser.dealCount > 0 && (
            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-white text-gray-600 text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm border border-gray-100 flex items-center gap-1 whitespace-nowrap group-hover:border-accent group-hover:text-accent transition-colors z-10">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400"></span>
              {advertiser.dealCount} active {advertiser.dealCount === 1 ? "offer" : "offers"}
            </div>
          )}
        </div>
      </Link>
    );
  }

  return content;
}
