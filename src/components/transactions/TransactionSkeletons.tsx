"use client";

export function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-card"
        >
          <div className="skeleton h-8 w-8 rounded-lg" />
          <div className="skeleton mt-3 h-6 w-16 rounded" />
          <div className="skeleton mt-2 h-3 w-24 rounded" />
        </div>
      ))}
    </div>
  );
}

export function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Line chart placeholder (larger) */}
      <div className="col-span-1 rounded-xl border border-gray-200 bg-white p-4 shadow-card lg:col-span-2">
        <div className="skeleton mb-3 h-4 w-40 rounded" />
        <div className="skeleton h-64 w-full rounded-lg" />
      </div>
      {/* Pie chart placeholder */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-card">
        <div className="skeleton mb-3 h-4 w-32 rounded" />
        <div className="skeleton mx-auto h-56 w-56 rounded-full" />
      </div>
      {/* Bar chart placeholder */}
      <div className="col-span-1 rounded-xl border border-gray-200 bg-white p-4 shadow-card lg:col-span-3">
        <div className="skeleton mb-3 h-4 w-48 rounded" />
        <div className="skeleton h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-card">
      {/* Header row */}
      <div className="flex gap-4 border-b border-gray-100 px-4 py-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-4 flex-1 rounded" />
        ))}
      </div>
      {/* Body rows */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 border-b border-gray-50 px-4 py-4"
        >
          {Array.from({ length: 6 }).map((_, j) => (
            <div key={j} className="skeleton h-4 flex-1 rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}
