import ModuleScaffold from "@/components/admin/ModuleScaffold";

export const dynamic = "force-dynamic";

/**
 * Store categories management. Categories currently live as a per-advertiser
 * field; this module will centralise them (rename, merge, order, feature).
 */
export default function AdminCategoriesPage() {
  return (
    <ModuleScaffold
      title="Categories"
      description="Organise the store catalog into categories used across the affiliate storefront."
      badge={{ label: "Setup pending", className: "bg-amber-100 text-amber-700" }}
    >
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-gray-800">Category management coming here</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
          Create and curate categories (Electronics, Fashion, Travel…), assign stores to
          them, and control how they surface on the public storefront. Categories are
          currently set per-store on the Stores page.
        </p>
      </div>
    </ModuleScaffold>
  );
}
