/** Placeholder shown while the AI store-page content is being generated. */
export default function StoreAiSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading store details">
      {/* Intro card */}
      <div className="bg-white p-6 rounded border border-gray-200 animate-pulse">
        <div className="h-3.5 w-11/12 rounded bg-gray-200" />
        <div className="mt-2 h-3.5 w-10/12 rounded bg-gray-200" />
        <div className="mt-2 h-3.5 w-7/12 rounded bg-gray-200" />
      </div>

      {/* Trust panel */}
      <div className="bg-white p-6 rounded border border-gray-200 animate-pulse">
        <div className="h-4 w-40 rounded bg-gray-200" />
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-3 w-24 rounded bg-gray-200" />
              <div className="h-3 w-16 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>

      {/* Two-column (shipping/returns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white p-6 rounded border border-gray-200 animate-pulse">
            <div className="h-4 w-32 rounded bg-gray-200" />
            <div className="mt-4 space-y-2.5">
              {Array.from({ length: 4 }).map((__, j) => (
                <div key={j} className="h-3 w-full rounded bg-gray-200" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* FAQ block */}
      <div className="bg-white p-6 rounded border border-gray-200 animate-pulse">
        <div className="h-4 w-48 rounded bg-gray-200" />
        <div className="mt-4 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="h-3.5 w-1/2 rounded bg-gray-200" />
              <div className="mt-2 h-3 w-full rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
