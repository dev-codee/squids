import PublicHeader from "@/components/store/PublicHeader";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicHeader />
      {children}
    </>
  );
}
