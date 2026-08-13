import TransactionsDashboard from "@/components/transactions/TransactionsDashboard";

/**
 * Networks → Awin: the live Awin dashboard. Awin is the only integrated network
 * today, so it gets the real transaction analytics; the other networks render a
 * scaffold under the shared /dashboard/networks/[network] route until connected.
 */
export default function AwinNetworkPage() {
  return (
    <TransactionsDashboard
      title="Awin — Dashboard"
      subtitle="Awin transactions, commissions and performance with date & month-wise reporting."
      backHref={{ href: "/dashboard/networks", label: "All Networks" }}
      badge={{ label: "Connected", className: "bg-emerald-100 text-emerald-700" }}
    />
  );
}
