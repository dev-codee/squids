import Link from "next/link";

/**
 * Consistent placeholder used by admin modules that are scaffolded ahead of
 * their data/API integration (Categories, per-network dashboards, etc.).
 */
export default function ModuleScaffold({
  title,
  description,
  badge,
  backHref,
  children,
}: {
  title: string;
  description: string;
  badge?: { label: string; className: string };
  backHref?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {backHref && (
        <Link
          href={backHref.href}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-accent"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          {backHref.label}
        </Link>
      )}

      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
            {badge && (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}>
                {badge.label}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
      </header>

      {children}
    </main>
  );
}
