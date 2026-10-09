import Link from "next/link";

/**
 * Shared shell for the homepage sections: a 1200px content column, a section
 * heading on the left and an optional "view all" link on the right.
 */
export default function HomeSection({
  title,
  action,
  actionHref,
  tone = "canvas",
  children,
}: {
  title: string;
  action?: string;
  actionHref?: string;
  /** Background tone — alternate between sections to separate them. */
  tone?: "canvas" | "white" | "sunk";
  children: React.ReactNode;
}) {
  const bg =
    tone === "white" ? "bg-white" : tone === "sunk" ? "bg-canvas-sunk" : "bg-canvas";

  return (
    <section className={`${bg} py-10 sm:py-14`}>
      <div className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-4 sm:mb-7">
          <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
            {title}
          </h2>
          {action && actionHref && (
            <Link
              href={actionHref}
              className="inline-flex flex-shrink-0 items-center gap-1 text-sm font-medium text-ink-soft transition-colors hover:text-brand"
            >
              {action} <span aria-hidden>→</span>
            </Link>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
