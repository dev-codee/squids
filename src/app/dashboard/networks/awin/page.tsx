import TransactionsDashboard from "@/components/transactions/TransactionsDashboard";

/**
 * Networks → Awin: the live Awin dashboard, scoped to Awin transactions only.
 */
export default function AwinNetworkPage() {
  return (
    <TransactionsDashboard
      title="Awin — Dashboard"
      subtitle="Awin transactions, commissions and performance with date & month-wise reporting."
      backHref={{ href: "/dashboard/networks", label: "All Networks" }}
      badge={{ label: "Connected", className: "bg-emerald-100 text-emerald-700" }}
      network="awin"
    />
  );
}
