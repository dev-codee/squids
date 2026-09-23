import type { Metadata } from "next";
import ManageSubscriptionClient from "@/components/store/ManageSubscriptionClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manage your store alerts",
  robots: { index: false, follow: false },
};

/**
 * Manage / confirm / unsubscribe landing page for follow-store alerts.
 * Reached via the links in alert emails (see src/lib/email.ts):
 *   ?token=...            → manage page (view/edit prefs)
 *   ?status=confirmed|unsubscribed|invalid  → banner after a redirect
 */
export default function SubscriptionsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const token = typeof searchParams.token === "string" ? searchParams.token : null;
  const status = typeof searchParams.status === "string" ? searchParams.status : null;

  return <ManageSubscriptionClient token={token} statusFlag={status} />;
}
