import TransactionsDashboard from "@/components/transactions/TransactionsDashboard";

/**
 * Networks → Kwanko: live transaction dashboard filtered to Kwanko data.
 */
export default function KwankoNetworkPage() {
  return (
    <TransactionsDashboard
      title="Kwanko — Dashboard"
      subtitle="Kwanko transactions, commissions and performance with date & month-wise reporting."
      backHref={{ href: "/dashboard/networks", label: "All Networks" }}
      badge={{ label: "Connected", className: "bg-emerald-100 text-emerald-700" }}
      network="kwanko"
    />
  );
}
