"use client";

import { useEffect, useState } from "react";

type Notice = { message: string; tone: "success" | "error" };
export function notify(message: string, tone: Notice["tone"] = "success") {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<Notice>("foxzil-notice", { detail: { message, tone } }));
}

/** Shared, dismissible action feedback, announced to assistive technology. */
export default function ActionFeedback() {
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    const receive = (event: Event) => setNotice((event as CustomEvent<Notice>).detail);
    window.addEventListener("foxzil-notice", receive);
    return () => window.removeEventListener("foxzil-notice", receive);
  }, []);
  useEffect(() => {
    if (!notice || notice.tone === "error") return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  return <div className={`fixed inset-x-4 bottom-6 z-[100] mx-auto flex max-w-lg items-start gap-4 rounded-xl border p-4 shadow-lg ${notice.tone === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
    <p role={notice.tone === "error" ? "alert" : "status"} className="min-w-0 flex-1 text-sm font-medium">{notice.message}</p>
    <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message" className="shrink-0 rounded px-2 font-bold focus-visible:outline focus-visible:outline-2">×</button>
  </div>;
}
