import Link from "next/link";
import { headers } from "next/headers";
import { getRegionConfig } from "@/lib/regions";
export default function NotFound() {
  const country = getRegionConfig(headers().get("x-region-country")).country.toLowerCase();
  return <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
    <p className="text-sm font-semibold text-brand">404 · Page not found</p>
    <h1 className="mt-3 text-3xl font-bold text-ink">We couldn’t find that page</h1>
    <p className="mt-4 text-ink-soft">The link may be outdated, or this item may no longer be available in your region.</p>
    <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href={`/${country}/products`} className="rounded-lg bg-brand px-5 py-3 font-semibold text-white">Browse products</Link><Link href={`/${country}/stores`} className="rounded-lg border border-line px-5 py-3 font-semibold text-ink">Find a store</Link><Link href={`/${country}`} className="rounded-lg border border-line px-5 py-3 font-semibold text-ink">Go to homepage</Link></div>
  </main>;
}
