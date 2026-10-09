import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = {
  title: "Delivered cost research",
  description: "Research findings will be published when reviewed source observations are available.",
  robots: { index: false, follow: true },
};
export default function ResearchPage({ params }: { params: { country: string } }) {
  return <main className="mx-auto max-w-shell px-4 py-10">
    <h1 className="text-3xl font-bold text-ink">Delivered cost research</h1>
    <p className="mt-4 text-ink-soft">No reviewed research dataset is available for publication yet. We will publish findings only with source observations, validated product identifiers and reproducible calculations.</p>
    <Link className="mt-6 inline-block text-brand underline" href={`/${params.country.toLowerCase()}/stores`}>Browse store offers</Link>
  </main>;
}
