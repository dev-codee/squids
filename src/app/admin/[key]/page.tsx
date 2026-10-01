import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminLoginSlug } from "@/lib/auth";
import LoginForm from "./login-form";

// Never cache: the gate depends on the runtime env var.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Gate",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

/**
 * Admin login lives at an unguessable path: `/admin/<ADMIN_LOGIN_SLUG>`.
 * Any other key (or a missing/incorrect slug) renders a 404, so the login page
 * is indistinguishable from a nonexistent route. It is never linked publicly.
 */
export default function AdminLoginPage({ params }: { params: { key: string } }) {
  if (params.key !== getAdminLoginSlug()) {
    notFound();
  }
  return <LoginForm />;
}
