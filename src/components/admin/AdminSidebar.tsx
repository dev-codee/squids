"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { NETWORKS } from "@/lib/networks";

/** A single leaf link in the sidebar. */
interface NavLeaf {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

/** A titled group of links (e.g. "Affiliate Store"). */
interface NavGroup {
  title: string;
  items: NavLeaf[];
}

const icon = (path: React.ReactNode) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {path}
  </svg>
);

// Top-level (ungrouped) links.
const topLinks: NavLeaf[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: icon(
      <>
        <rect x="3" y="3" width="7" height="9" />
        <rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" />
        <rect x="3" y="16" width="7" height="5" />
      </>,
    ),
  },
];

const groups: NavGroup[] = [
  {
    title: "Affiliate Store",
    items: [
      {
        label: "Categories",
        href: "/dashboard/categories",
        icon: icon(
          <>
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </>,
        ),
      },
      {
        label: "Deals",
        href: "/dashboard/deals",
        icon: icon(
          <>
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </>,
        ),
      },
      {
        label: "Coupons",
        href: "/dashboard/coupons",
        icon: icon(
          <>
            <path d="M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V11a2 2 0 0 0 0-4z" />
            <line x1="12" y1="7" x2="12" y2="17" strokeDasharray="2 2" />
          </>,
        ),
      },
      {
        label: "Products",
        href: "/dashboard/products",
        icon: icon(
          <>
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <path d="M7 7h.01" />
          </>,
        ),
      },
      {
        label: "Stores",
        href: "/dashboard/advertisers",
        icon: icon(
          <>
            <path d="M3 9l1-5h16l1 5" />
            <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
            <path d="M9 22V12h6v10" />
          </>,
        ),
      },
    ],
  },
  {
    title: "Networks",
    items: [
      {
        label: "All Earnings",
        href: "/dashboard/networks",
        icon: icon(
          <>
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </>,
        ),
      },
      ...NETWORKS.map((n) => ({
        label: n.name,
        href: `/dashboard/networks/${n.slug}`,
        icon: icon(
          <>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </>,
        ),
      })),
    ],
  },
  {
    title: "Content",
    items: [
      {
        label: "Reviews",
        href: "/dashboard/reviews",
        icon: icon(
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
        ),
      },
      {
        label: "FAQs",
        href: "/dashboard/faqs",
        icon: icon(
          <>
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </>,
        ),
      },
      {
        label: "Guides",
        href: "/dashboard/guides",
        icon: icon(
          <>
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </>,
        ),
      },
    ],
  },
  {
    title: "Settings",
    items: [
      {
        label: "Home Settings",
        href: "/dashboard/home-settings",
        icon: icon(
          <>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </>,
        ),
      },
      {
        label: "Activity Logs",
        href: "/dashboard/activity-logs",
        icon: icon(
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        ),
      },
    ],
  },
];

/** Active when the path equals the href, or is a nested route beneath it. */
function useIsActive() {
  const pathname = usePathname();
  return (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  };
}

export default function AdminSidebar() {
  const router = useRouter();
  const isActive = useIsActive();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      // Return to the public home — the admin login lives at a secret URL that
      // we intentionally don't reference from the client bundle.
      router.push("/");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  const leafClass = (href: string) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive(href)
        ? "bg-accent-soft text-accent"
        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
    }`;

  const nav = (
    <nav className="flex h-full flex-col">
      {/* Brand */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2 px-4 py-4"
        onClick={() => setMobileOpen(false)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-gray-800">Admin Panel</span>
      </Link>

      {/* Scrollable nav */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="space-y-1">
          {topLinks.map((leaf) => (
            <Link
              key={leaf.href}
              href={leaf.href}
              className={leafClass(leaf.href)}
              onClick={() => setMobileOpen(false)}
            >
              {leaf.icon}
              {leaf.label}
            </Link>
          ))}
        </div>

        {groups.map((group) => (
          <div key={group.title} className="mt-5">
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map((leaf) => (
                <Link
                  key={leaf.href}
                  href={leaf.href}
                  className={leafClass(leaf.href)}
                  onClick={() => setMobileOpen(false)}
                >
                  {leaf.icon}
                  {leaf.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer: admin badge + logout */}
      <div className="border-t border-gray-100 p-3">
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
            A
          </div>
          <span className="text-xs font-medium text-accent">Admin</span>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile top bar with hamburger */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
        <span className="text-sm font-semibold text-gray-800">Admin Panel</span>
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100"
          aria-label="Open menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {/* Desktop fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-gray-200 bg-white lg:block">
        {nav}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-3 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
              aria-label="Close menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
