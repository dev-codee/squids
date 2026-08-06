import { redirect } from "next/navigation";
import DealsClient from "./DealsClient";

export const dynamic = "force-dynamic";

const CODE_RE = /^[A-Za-z]{2}$/;

/**
 * Public deals page at /{country}/deals.
 * Shows all active deals/vouchers for the visitor's detected region.
 */
export default function DealsPage({
  params,
}: {
  params: { country: string };
}) {
  const raw = params.country;

  if (!CODE_RE.test(raw)) {
    redirect("/");
  }

  if (raw !== raw.toLowerCase()) {
    redirect(`/${raw.toLowerCase()}/deals`);
  }

  return <DealsClient country={raw.toUpperCase()} />;
}
