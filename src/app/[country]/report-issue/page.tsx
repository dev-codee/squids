import type { Metadata } from "next";
import { getDictionary } from "@/i18n";
import { getRegionConfig, getSiteUrl, REGION_CODES } from "@/lib/regions";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import ReportIssueForm from "@/components/dispute/ReportIssueForm";

interface PageProps {
  params: { country: string };
  searchParams?: {
    type?: string;
    product?: string;
    deal?: string;
    store?: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const lc = params.country.toLowerCase();
  const siteUrl = getSiteUrl();
  const path = `/${lc}/report-issue`;

  const hreflang: Record<string, string> = {};
  for (const code of REGION_CODES) {
    const r = getRegionConfig(code);
    hreflang[r.locale] = `${siteUrl}/${code.toLowerCase()}/report-issue`;
  }
  hreflang["x-default"] = `${siteUrl}/us/report-issue`;

  return {
    title: "Report an Issue or Inaccurate Information | Foxzil",
    description:
      "Submit a catalog dispute, incorrect product match, outdated price, or expired promotion for editorial review.",
    alternates: {
      canonical: `${siteUrl}${path}`,
      languages: hreflang,
    },
  };
}

export default async function ReportIssuePage({
  params,
  searchParams,
}: PageProps) {
  const lc = params.country.toLowerCase();
  const country = params.country.toUpperCase();
  const dict = await getDictionary(country);

  return (
    <div className="min-h-screen bg-canvas pb-20">
      <div className="mx-auto max-w-shell px-4 py-6 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: dict.header.home, href: `/${lc}` },
            { label: "Report an Issue" },
          ]}
        />

        <div className="mx-auto mt-6 max-w-3xl">
          {/* Header */}
          <div className="border-b border-line pb-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              Report an Issue or Inaccuracy
            </h1>
            <p className="mt-2 text-sm text-ink-soft leading-relaxed">
              Foxzil is committed to publishing strictly factual comparison totals, verified product variants, and tested voucher codes. If you detect an outdated price, a misidentified model, or an expired promotion, please report it below.
            </p>
          </div>

          {/* Form */}
          <div className="mt-8 rounded-card border border-line bg-white p-6 sm:p-8 shadow-card">
            <ReportIssueForm
              country={country}
              initialType={searchParams?.type}
              initialProductId={searchParams?.product}
              initialDealId={searchParams?.deal}
              initialStoreSlug={searchParams?.store}
            />
          </div>

          {/* Editorial Process & Commitments */}
          <div className="mt-10 rounded-card border border-line bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-ink">
              Our Correction & Resolution Commitment
            </h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-3 text-xs text-ink-soft">
              <div>
                <span className="font-semibold text-ink block mb-1">
                  1. Independent Review
                </span>
                Every submitted report is checked against raw merchant feed snapshots and destination checkout terms by a named editor.
              </div>
              <div>
                <span className="font-semibold text-ink block mb-1">
                  2. Immediate Quarantine
                </span>
                Confirmed discrepancies are immediately quarantined from public comparison ranking to protect shoppers from inaccurate claims.
              </div>
              <div>
                <span className="font-semibold text-ink block mb-1">
                  3. Audit Trail
                </span>
                All corrections, match splits, and rule adjustments are recorded with timestamped reviewer notes in our operations audit log.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
