/** Placeholder shown while the AI store content is being generated (sidebar). */
export default function StoreAiSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading store details">
      {/* Intro card */}
      <div className="bg-white p-5 rounded border border-gray-200 animate-pulse">
        <div className="h-3 w-11/12 rounded bg-gray-200" />
        <div className="mt-2 h-3 w-10/12 rounded bg-gray-200" />
        <div className="mt-2 h-3 w-7/12 rounded bg-gray-200" />
      </div>

      {/* Trust panel */}
      <div className="bg-white p-5 rounded border border-gray-200 animate-pulse">
        <div className="h-4 w-32 rounded bg-gray-200" />
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-3 w-24 rounded bg-gray-200" />
              <div className="h-3 w-14 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>

      {/* Info card */}
      <div className="bg-white p-5 rounded border border-gray-200 animate-pulse">
        <div className="h-4 w-28 rounded bg-gray-200" />
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-3 w-full rounded bg-gray-200" />
          ))}
        </div>
      </div>

      {/* FAQ block */}
      <div className="bg-white p-5 rounded border border-gray-200 animate-pulse">
        <div className="h-4 w-40 rounded bg-gray-200" />
        <div className="mt-4 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-1/2 rounded bg-gray-200" />
              <div className="mt-2 h-3 w-full rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
