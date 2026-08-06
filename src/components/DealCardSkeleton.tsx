export default function DealCardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-card"
        >
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="skeleton h-10 w-10 rounded-lg" />
            <div className="skeleton h-3 w-24 rounded" />
            <div className="ml-auto skeleton h-5 w-16 rounded-full" />
          </div>

          {/* Title + description */}
          <div className="mt-3 space-y-2">
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-3/4 rounded" />
            <div className="skeleton h-3 w-full rounded" />
          </div>

          {/* Code area */}
          <div className="mt-3 flex items-center gap-2">
            <div className="skeleton h-8 w-28 rounded-md" />
            <div className="skeleton h-8 w-8 rounded-md" />
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton h-7 w-20 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
