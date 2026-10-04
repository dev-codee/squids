"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/gtm";
import { DISPUTE_TYPES, type DisputeType } from "@/lib/model/correction";

interface ReportIssueFormProps {
  country: string;
  initialType?: string;
  initialProductId?: string;
  initialDealId?: string;
  initialStoreSlug?: string;
}

const DISPUTE_LABELS: Record<DisputeType, { title: string; desc: string }> = {
  wrong_match: {
    title: "Incorrect Product Match",
    desc: "A retailer listing shown in a comparison is not the exact same product variant or condition.",
  },
  wrong_price: {
    title: "Inaccurate or Outdated Price",
    desc: "The listed price, delivery charge, or total payable does not match checkout.",
  },
  expired_deal: {
    title: "Expired Deal or Voucher",
    desc: "A discount code or promotional offer is no longer valid or accepted by the store.",
  },
  broken_link: {
    title: "Broken Retailer Link",
    desc: "Clicking a retailer link resulted in a 404 error, redirect loop, or wrong landing page.",
  },
  merchant_info: {
    title: "Merchant Information Error",
    desc: "Store policies, delivery terms, or merchant credentials are misstated.",
  },
  other: {
    title: "Other Catalog Feedback",
    desc: "Any other suggestion or data correction to help improve Foxzil accuracy.",
  },
};

export default function ReportIssueForm({
  country,
  initialType,
  initialProductId,
  initialDealId,
  initialStoreSlug,
}: ReportIssueFormProps) {
  const [disputeType, setDisputeType] = useState<DisputeType>(
    (DISPUTE_TYPES.includes(initialType as DisputeType)
      ? initialType
      : "wrong_match") as DisputeType,
  );
  const [productId, setProductId] = useState(initialProductId || "");
  const [dealId, setDealId] = useState(initialDealId || "");
  const [storeSlug, setStoreSlug] = useState(initialStoreSlug || "");
  const [description, setDescription] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTicketId, setSuccessTicketId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (description.trim().length < 10) {
      setError("Please describe the issue in at least 10 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const pageUrl = typeof window !== "undefined" ? window.location.href : undefined;
      const res = await fetch("/api/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: country.toUpperCase(),
          disputeType,
          productId: productId.trim() || undefined,
          dealId: dealId.trim() || undefined,
          storeSlug: storeSlug.trim() || undefined,
          pageUrl,
          description: description.trim(),
          reporterEmail: reporterEmail.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.errors?.[0] || "Failed to submit report");
      }

      setSuccessTicketId(data.ticketId);

      // Emit correction_submit event to GTM
      trackEvent("correction_submit", {
        page_type: "utility",
        market: country.toUpperCase(),
        dispute_type: disputeType,
        product_id: productId || undefined,
        ticket_id: data.ticketId,
      });
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (successTicketId) {
    return (
      <div className="rounded-card border border-emerald-300 bg-emerald-50 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-emerald-900">
              Report Submitted Successfully
            </h3>
            <p className="text-xs text-emerald-700">
              Ticket ID: <span className="font-mono font-semibold">{successTicketId}</span>
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-emerald-800 leading-relaxed">
          Thank you for helping us maintain accurate catalog data. Our editorial and quality team reviews every flagged listing against merchant source feeds and terms. If you supplied your email address, you will receive an update once investigated.
        </p>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => {
              setSuccessTicketId(null);
              setDescription("");
            }}
            className="rounded-[9px] border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50"
          >
            Submit Another Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-card border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
          {error}
        </div>
      )}

      {/* Dispute Type Selection */}
      <div>
        <label className="block text-sm font-bold text-ink">
          What type of issue are you reporting?
        </label>
        <p className="mt-0.5 text-xs text-ink-muted">
          Select the category that best matches your observation.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {DISPUTE_TYPES.map((type) => {
            const info = DISPUTE_LABELS[type];
            const isSelected = disputeType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setDisputeType(type)}
                className={`flex flex-col items-start rounded-card border p-3.5 text-left transition-colors ${
                  isSelected
                    ? "border-brand bg-brand-soft ring-1 ring-brand"
                    : "border-line bg-white hover:border-line-strong hover:bg-canvas"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className={`text-sm font-semibold ${isSelected ? "text-brand" : "text-ink"}`}>
                    {info.title}
                  </span>
                  {isSelected && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand text-white">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </div>
                <span className="mt-1 text-xs text-ink-muted leading-normal">
                  {info.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Context Details */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="productId" className="block text-xs font-semibold text-ink-soft">
            Product ID (Optional)
          </label>
          <input
            id="productId"
            type="text"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder="e.g. 10421"
            className="mt-1 w-full rounded-[9px] border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <div>
          <label htmlFor="dealId" className="block text-xs font-semibold text-ink-soft">
            Deal or Voucher ID (Optional)
          </label>
          <input
            id="dealId"
            type="text"
            value={dealId}
            onChange={(e) => setDealId(e.target.value)}
            placeholder="e.g. awin_deal_521"
            className="mt-1 w-full rounded-[9px] border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <div>
          <label htmlFor="storeSlug" className="block text-xs font-semibold text-ink-soft">
            Store Name or Slug (Optional)
          </label>
          <input
            id="storeSlug"
            type="text"
            value={storeSlug}
            onChange={(e) => setStoreSlug(e.target.value)}
            placeholder="e.g. nike"
            className="mt-1 w-full rounded-[9px] border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-bold text-ink">
          Description of the Discrepancy <span className="text-rose-500">*</span>
        </label>
        <p className="mt-0.5 text-xs text-ink-muted">
          Please explain what is incorrect (e.g. different model number, higher shipping fee at checkout, expired discount code).
        </p>
        <textarea
          id="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          minLength={10}
          maxLength={2000}
          placeholder="Please describe what you observed, including the retailer name and checkout details if relevant..."
          className="mt-1.5 w-full rounded-card border border-line bg-white p-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
        <div className="mt-1 flex justify-between text-xs text-ink-muted">
          <span>Minimum 10 characters</span>
          <span>{description.length} / 2000</span>
        </div>
      </div>

      {/* Email for updates */}
      <div>
        <label htmlFor="reporterEmail" className="block text-sm font-bold text-ink">
          Your Email (Optional)
        </label>
        <p className="mt-0.5 text-xs text-ink-muted">
          Only used to notify you when the correction has been investigated. We never share your email.
        </p>
        <input
          id="reporterEmail"
          type="email"
          value={reporterEmail}
          onChange={(e) => setReporterEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1.5 w-full max-w-md rounded-[9px] border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      {/* Submit button */}
      <div>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-[9px] bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50"
        >
          {submitting ? "Submitting Report…" : "Submit Report"}
        </button>
      </div>
    </form>
  );
}
