import Link from "next/link";
import type { Advertiser } from "@/lib/awin";

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
        <div className="flex items-start gap-4">
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
            <p className="text-[11px] font-mono text-gray-400">#{advertiser.id}</p>
          </div>
          <StatusBadge relationship={advertiser.relationship} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {advertiser.region && (
            <div>
              <dt className="text-gray-400">Region</dt>
              <dd className="mt-0.5 font-medium text-gray-700">
                {advertiser.region}
                {advertiser.countryCode ? ` (${advertiser.countryCode})` : ""}
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
      <Link href={`/${slug}`} className="block h-full">
        <div className="group flex flex-col items-center justify-center rounded border border-gray-200 bg-white p-4 shadow-sm hover:border-amber-300 hover:shadow-md transition cursor-pointer h-24 sm:h-28">
          {advertiser.logoUrl ? (
            <img
              src={advertiser.logoUrl}
              alt={`${advertiser.name} logo`}
              className="h-10 w-full object-contain filter group-hover:scale-105 transition-transform"
              loading="lazy"
            />
          ) : (
            <span className="text-center text-sm font-bold text-gray-800 line-clamp-2 w-full">
              {advertiser.name}
            </span>
          )}
        </div>
      </Link>
    );
  }

  return content;
}
