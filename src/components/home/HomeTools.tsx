"use client";

import Link from "next/link";
import { useDictionary } from "@/i18n/DictionaryProvider";
import HomeSection from "./HomeSection";

/**
 * "Tools for your next purchase".
 *
 * Only the alert card is live today — it points at the store index, where the
 * "Follow this store" control sets up offer alerts. Saved products has no
 * backing feature yet, so it renders as a non-interactive "coming soon" card
 * rather than a link that goes nowhere.
 */
export default function HomeTools({ country }: { country: string }) {
  const dict = useDictionary();
  const t = dict.homeV2;
  const lc = country.toLowerCase();

  const tools = [
    {
      title: t.toolSave,
      body: t.toolSaveDesc,
      href: null as string | null,
      icon: <BookmarkIcon />,
    },
    {
      title: t.toolAlert,
      body: t.toolAlertDesc,
      href: `/${lc}/stores`,
      icon: <BellIcon />,
    },
  ];

  return (
    <HomeSection title={t.toolsTitle} tone="canvas">
      <div className="grid gap-4 sm:grid-cols-2">
        {tools.map((tool) => {
          const inner = (
            <>
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[9px] bg-brand-soft text-brand">
                {tool.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold text-ink">
                    {tool.title}
                  </span>
                  {!tool.href && (
                    <span className="rounded-full border border-line bg-canvas px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      {t.comingSoon}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
                  {tool.body}
                </span>
              </span>
              {tool.href && (
                <span className="self-center text-ink-muted" aria-hidden>
                  →
                </span>
              )}
            </>
          );

          const base =
            "flex items-start gap-4 rounded-card border border-line bg-brand-soft/60 p-5";

          return tool.href ? (
            <Link
              key={tool.title}
              href={tool.href}
              className={`${base} transition hover:border-brand-border hover:shadow-card`}
            >
              {inner}
            </Link>
          ) : (
            <div key={tool.title} className={base}>
              {inner}
            </div>
          );
        })}
      </div>
    </HomeSection>
  );
}

function BookmarkIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
