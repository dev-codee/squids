export default function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: 35 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col items-center justify-center rounded border border-gray-200 bg-white p-4 shadow-sm h-24 sm:h-28"
        >
          <div className="skeleton h-10 w-3/4 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
