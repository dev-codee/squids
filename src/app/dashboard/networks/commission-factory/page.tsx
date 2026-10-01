import TransactionsDashboard from "@/components/transactions/TransactionsDashboard";

/**
 * Networks → Commission Factory: live transaction dashboard filtered to CF data.
 */
export default function CommissionFactoryNetworkPage() {
  return (
    <TransactionsDashboard
      title="Commission Factory — Dashboard"
      subtitle="Commission Factory transactions, commissions and performance with date & month-wise reporting."
      backHref={{ href: "/dashboard/networks", label: "All Networks" }}
      badge={{ label: "Connected", className: "bg-emerald-100 text-emerald-700" }}
      network="commission-factory"
    />
  );
}
