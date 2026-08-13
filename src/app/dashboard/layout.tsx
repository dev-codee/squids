import AdminSidebar from "@/components/admin/AdminSidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar />
      {/* Offset by the fixed sidebar width on desktop. */}
      <div className="lg:pl-60">{children}</div>
    </div>
  );
}
