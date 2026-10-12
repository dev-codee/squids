"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center" role="alert">
    <h1 className="text-3xl font-bold text-ink">This page couldn’t load</h1>
    <p className="mt-4 text-ink-soft">Please try again. If the problem continues, return to the homepage and browse another section.</p>
    <div className="mt-8 flex gap-3"><button onClick={reset} className="rounded-lg bg-brand px-5 py-3 font-semibold text-white">Try again</button><Link href="/" className="rounded-lg border border-line px-5 py-3 font-semibold text-ink">Go to homepage</Link></div>
  </main>;
}
