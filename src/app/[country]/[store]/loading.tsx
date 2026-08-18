// Instant loading UI shown by Next.js the moment a user clicks through to a
// store page, while the server fetches store data. Mirrors the real layout so
// the transition feels fast instead of "stuck". Replaced by page.tsx output
// as soon as the data resolves.
export default function StorePageLoading() {
  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-16">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar skeleton */}
          <div className="lg:col-span-3 space-y-6">
            <div className="rounded border border-gray-200 bg-white p-6 shadow-sm animate-pulse">
              <div className="mx-auto h-20 w-20 rounded-lg bg-gray-200" />
              <div className="mx-auto mt-4 h-5 w-32 rounded bg-gray-200" />
              <div className="mx-auto mt-2 h-3 w-24 rounded bg-gray-100" />
              <div className="mt-6 space-y-2">
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="h-3 w-5/6 rounded bg-gray-100" />
                <div className="h-3 w-4/6 rounded bg-gray-100" />
              </div>
            </div>
          </div>

          {/* Main content skeleton */}
          <div className="lg:col-span-9 space-y-8">
            {/* Header */}
            <div className="rounded border border-gray-200 bg-white p-6 shadow-sm animate-pulse">
              <div className="h-7 w-2/3 rounded bg-gray-200" />
              <div className="mt-3 h-4 w-full rounded bg-gray-100" />
              <div className="mt-2 h-4 w-4/5 rounded bg-gray-100" />
            </div>

            {/* Coupon cards */}
            <div className="space-y-4">
              <div className="h-5 w-48 rounded bg-gray-200 animate-pulse" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded border border-gray-200 bg-white p-5 shadow-sm animate-pulse"
                >
                  <div className="h-14 w-14 flex-shrink-0 rounded-lg bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-gray-200" />
                    <div className="h-3 w-1/2 rounded bg-gray-100" />
                  </div>
                  <div className="h-10 w-24 flex-shrink-0 rounded bg-gray-200" />
                </div>
              ))}
            </div>

            {/* Deal grid */}
            <div className="space-y-4">
              <div className="h-5 w-40 rounded bg-gray-200 animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded border border-gray-200 bg-white p-4 shadow-sm animate-pulse"
                  >
                    <div className="h-28 w-full rounded bg-gray-200" />
                    <div className="mt-3 h-4 w-3/4 rounded bg-gray-200" />
                    <div className="mt-2 h-3 w-1/2 rounded bg-gray-100" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
