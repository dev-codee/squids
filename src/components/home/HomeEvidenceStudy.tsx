import Link from "next/link";

interface HomeEvidenceStudyProps {
  country: string;
}

export default function HomeEvidenceStudy({ country }: HomeEvidenceStudyProps) {
  const lc = country.toLowerCase();

  return (
    <section className="bg-canvas py-10 sm:py-12">
      <div className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-card border border-brand-border bg-gradient-to-br from-brand-soft via-white to-brand-soft/40 p-6 sm:p-10 shadow-card">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-brand px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                  Empirical Research Study
                </span>
                <span className="text-xs font-semibold text-ink-muted">
                  Protocol §15 · Verified Observation Window
                </span>
              </div>

              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                The Delivered Cost Index 2026
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-ink-soft sm:text-base">
                In <strong>40% of observed retail orders</strong>, the merchant advertising the lowest headline item price did not deliver the lowest total cost at checkout.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs text-ink-soft">
                <div className="rounded-[9px] border border-line bg-white/90 p-3 shadow-xs">
                  <span className="font-bold text-ink block">Barcode Matched</span>
                  Verified GTIN-13 SKUs across consumer electronics, home, and fashion.
                </div>
                <div className="rounded-[9px] border border-line bg-white/90 p-3 shadow-xs">
                  <span className="font-bold text-ink block">Shipping Thresholds</span>
                  Reveals how sub-£50 orders incur hidden flat fees up to £6.99.
                </div>
                <div className="rounded-[9px] border border-line bg-white/90 p-3 shadow-xs">
                  <span className="font-bold text-ink block">Tested Promos</span>
                  65% of aggregators&apos; coupon codes failed single-item minimum spends.
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 flex-shrink-0">
              <Link
                href={`/${lc}/research/delivered-cost-study`}
                className="inline-flex items-center justify-center rounded-[9px] bg-brand px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover"
              >
                Read Empirical Study →
              </Link>
              <Link
                href={`/${lc}/methodology`}
                className="inline-flex items-center justify-center rounded-[9px] border border-line-strong bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand"
              >
                View Our Methodology
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
