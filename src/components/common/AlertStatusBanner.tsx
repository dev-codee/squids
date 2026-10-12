"use client";
import { useSearchParams } from "next/navigation";

const messages: Record<string, { error?: boolean; text: string }> = {
  confirmed: { text: "Your price alert is confirmed. We’ll email you when your target price is reached." },
  unsubscribed: { text: "You’ve unsubscribed from this price alert." },
  invalid: { error: true, text: "This price alert link is invalid. Use the complete link from your email or create a new alert." },
  expired: { error: true, text: "This price alert link is no longer valid. Please create a new alert from the product page." },
  error: { error: true, text: "We couldn’t update your price alert. Please try the link again in a moment." },
};
export default function AlertStatusBanner() {
  const flag = useSearchParams().get("alert");
  const message = flag ? messages[flag] : undefined;
  if (!message) return null;
  return <div role={message.error ? "alert" : "status"} className={`mx-auto my-4 max-w-shell rounded-xl border p-4 text-sm ${message.error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{message.text}</div>;
}
