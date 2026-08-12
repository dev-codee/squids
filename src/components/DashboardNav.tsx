"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const navItems = [
  {
    label: "Advertisers",
    href: "/dashboard/advertisers",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
  {
    label: "Deals & Offers",
    href: "/dashboard/deals",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
  },

  {
    label: "Products",
    href: "/dashboard/products",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <path d="M7 7h.01" />
      </svg>
    ),
  },
  {
    label: "Content",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    subItems: [
      {
        label: "Reviews",
        href: "/dashboard/reviews",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ),
      },
      {
        label: "FAQs",
        href: "/dashboard/faqs",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
      },
      {
        label: "Guides",
        href: "/dashboard/guides",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Home Settings",
    href: "/dashboard/home-settings",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: "Transactions",
    href: "/dashboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
];

export default function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <nav className="border-b border-gray-200 bg-white relative z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: branding + nav */}
        <div className="flex items-center gap-6">
          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 py-3"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </div>
            <span className="hidden text-sm font-semibold text-gray-800 sm:inline">
              Awin Dashboard
            </span>
          </Link>

          {/* Nav tabs */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              if (item.subItems) {
                const isActive = item.subItems.some((sub) => pathname === sub.href);
                return (
                  <div key={item.label} className="relative group">
                    <button
                      className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition ${
                        isActive
                          ? "border-accent text-accent"
                          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                      }`}
                    >
                      {item.icon}
                      {item.label}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    <div className="absolute left-0 top-full hidden w-48 flex-col rounded-lg border border-gray-200 bg-white p-2 shadow-lg group-hover:flex">
                      {item.subItems.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                            pathname === sub.href
                              ? "bg-accent-soft text-accent"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          }`}
                        >
                          {sub.icon}
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              }

              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href!}
                  className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition ${
                    isActive
                      ? "border-accent text-accent"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right: admin + logout */}
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-lg bg-accent-soft px-3 py-1.5 sm:flex">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
              A
            </div>
            <span className="text-xs font-medium text-accent">Admin</span>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-card transition hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </nav>
  );
}
