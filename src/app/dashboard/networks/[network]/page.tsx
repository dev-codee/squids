import Link from "next/link";
import { notFound } from "next/navigation";
import { getNetwork, NETWORKS } from "@/lib/networks";
import ModuleScaffold from "@/components/admin/ModuleScaffold";

export const dynamic = "force-dynamic";

/** Pre-generate the scaffold network routes. Awin and Admitad have their own explicit routes. */
export function generateStaticParams() {
  return NETWORKS.filter((n) => n.slug !== "awin" && n.slug !== "admitad").map((n) => ({ network: n.slug }));
}

const KPIS = ["Earnings", "Clicks", "Conversions", "Conversion Rate"];

/**
 * Per-network dashboard scaffold: date/month report controls + KPI/report
 * placeholders. Wire the network's reporting API here to render live stats.
 */
export default function NetworkDashboardPage({
  params,
}: {
  params: { network: string };
}) {
  const network = getNetwork(params.network);
  if (!network) notFound();

  return (
    <ModuleScaffold
      title={`${network.name} — Dashboard`}
      description={network.description}
      backHref={{ href: "/dashboard/networks", label: "All Networks" }}
      badge={
        network.integrated
          ? { label: "Connected", className: "bg-emerald-100 text-emerald-700" }
          : { label: "API integration pending", className: "bg-amber-100 text-amber-700" }
      }
    >
      {/* Report controls (date range + month) */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-card">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className="block text-[11px] font-medium text-gray-500">From</label>
            <input type="date" disabled className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-400" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500">To</label>
            <input type="date" disabled className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-400" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500">Month</label>
            <input type="month" disabled className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-400" />
          </div>
          <div className="flex items-end">
            <button disabled className="w-full rounded-lg bg-gray-200 px-4 py-2 text-xs font-semibold text-gray-500">
              Run report
            </button>
          </div>
        </div>
      </div>

      {/* KPI placeholders */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((label) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-card">
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-300">—</p>
          </div>
        ))}
      </div>

      {/* Report table placeholder */}
      <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
        {network.integrated ? (
          <>
            <p className="text-sm font-semibold text-gray-800">{network.name} is connected</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
              Live transaction &amp; commission data is available on the main{" "}
              <Link href="/dashboard" className="font-medium text-accent hover:underline">
                Dashboard
              </Link>
              . Date &amp; month-wise reporting for this network will surface here.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-gray-800">API integration pending</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
              Connect the {network.name} reporting API to see store-level stats with
              date and month-wise earnings reports here.
            </p>
          </>
        )}
      </div>
    </ModuleScaffold>
  );
}
