import TransactionsDashboard from "@/components/transactions/TransactionsDashboard";

/**
 * Networks → Admitad: live transaction dashboard filtered to Admitad data.
 * Reuses the shared TransactionsDashboard with the `network` prop.
 */
export default function AdmitadNetworkPage() {
  return (
    <TransactionsDashboard
      title="Admitad — Dashboard"
      subtitle="Admitad (Mitgo) transactions, commissions and performance with date & month-wise reporting."
      backHref={{ href: "/dashboard/networks", label: "All Networks" }}
      badge={{ label: "Connected", className: "bg-emerald-100 text-emerald-700" }}
      network="admitad"
    />
  );
}
