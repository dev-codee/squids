"use client";

import { useEffect, useState } from "react";
import type { RetailerOfferRecord, OfferStatus } from "@/lib/model/offer";

const STATUS_TABS: { label: string; value: OfferStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Current", value: "current" },
  { label: "Stale", value: "stale" },
  { label: "Quarantined", value: "quarantined" },
];

export default function OffersAdminPage() {
  const [status, setStatus] = useState<OfferStatus | "all">("all");
  const [offers, setOffers] = useState<RetailerOfferRecord[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Preview modal state
  const [previewOffer, setPreviewOffer] = useState<RetailerOfferRecord | null>(null);
  const [postcode, setPostcode] = useState("");
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/offers?status=${status}&limit=100`);
      const data = await res.json();
      setOffers(data.offers || []);
      setCounts(data.counts || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, [status]);

  const handleAction = async (id: string, action: "publish" | "quarantine" | "check", reason?: string) => {
    setActionLoading(id);
    try {
      const res = await fetch("/api/admin/offers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, reason }),
      });
      if (res.ok) {
        await fetchOffers();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePreviewCalc = async (offer: RetailerOfferRecord) => {
    setPreviewOffer(offer);
    setPreviewResult(null);
    setPreviewLoading(true);
    try {
      const price = offer.itemPrice.known ? offer.itemPrice.value : 0;
      const res = await fetch("/api/admin/offers/preview-calculation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantMarketId: offer.merchantMarketId,
          itemPrice: price,
          destination: { market: "US", postcode: postcode || null },
        }),
      });
      const data = await res.json();
      setPreviewResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Retailer Offers & Cost Editor</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Inspect standalone offers, verify checked timestamps, review drafts, and preview delivered totals.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchOffers}
          className="rounded-[9px] border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:border-brand hover:text-brand"
        >
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-line pb-3">
        {STATUS_TABS.map((tab) => {
          const active = status === tab.value;
          const count = tab.value === "all"
            ? Object.values(counts).reduce((a, b) => a + b, 0)
            : counts[tab.value] ?? 0;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatus(tab.value)}
              className={`rounded-[9px] border px-4 py-2 text-xs font-semibold transition ${
                active
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-white text-ink-soft hover:border-line-strong hover:text-ink"
              }`}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
        {loading ? (
          <div className="p-8 text-center text-sm text-ink-muted">Loading retailer offers...</div>
        ) : offers.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-muted">
            No offers found with status &ldquo;{status}&rdquo;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink">
              <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-5 py-3">Offer ID / Product</th>
                  <th className="px-5 py-3">Merchant Market</th>
                  <th className="px-5 py-3">Item Price</th>
                  <th className="px-5 py-3">Stock & Cond.</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Checked At</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {offers.map((offer) => {
                  const priceStr = offer.itemPrice.known
                    ? `${offer.currency} ${offer.itemPrice.value.toFixed(2)}`
                    : "Unknown";

                  return (
                    <tr key={offer.id} className="hover:bg-canvas/50">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-ink">Product #{offer.productId}</div>
                        <div className="font-mono text-[11px] text-ink-muted">{offer.id}</div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs">{offer.merchantMarketId}</td>
                      <td className="px-5 py-3.5 font-bold text-ink">{priceStr}</td>
                      <td className="px-5 py-3.5 text-xs text-ink-soft">
                        <span className={offer.stock === "in-stock" ? "text-emerald-700" : "text-amber-700"}>
                          {offer.stock}
                        </span>
                        {" · "}
                        <span className="capitalize">{offer.condition}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            offer.status === "current"
                              ? "bg-emerald-50 text-emerald-700"
                              : offer.status === "draft"
                              ? "bg-sky-50 text-sky-700"
                              : offer.status === "stale"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {offer.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-ink-soft">
                        {offer.checkedAt ? new Date(offer.checkedAt).toLocaleDateString() : "Never"}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-xs">
                          {offer.status === "draft" && (
                            <button
                              type="button"
                              disabled={actionLoading === offer.id}
                              onClick={() => handleAction(offer.id, "publish")}
                              className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 font-semibold text-emerald-800 hover:bg-emerald-100"
                            >
                              Publish
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={actionLoading === offer.id}
                            onClick={() => handleAction(offer.id, "check")}
                            className="rounded border border-line bg-white px-2 py-1 font-semibold text-ink hover:border-brand hover:text-brand"
                            title="Stamp verification timestamp"
                          >
                            Mark Checked
                          </button>
                          {offer.status !== "quarantined" && (
                            <button
                              type="button"
                              disabled={actionLoading === offer.id}
                              onClick={() => handleAction(offer.id, "quarantine", "Operator quarantined")}
                              className="rounded border border-red-200 bg-white px-2 py-1 font-semibold text-red-700 hover:bg-red-50"
                            >
                              Quarantine
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handlePreviewCalc(offer)}
                            className="rounded border border-line bg-canvas px-2 py-1 font-semibold text-ink-soft hover:text-brand"
                          >
                            Preview Total
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog">
          <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setPreviewOffer(null)} />
          <div className="relative w-full max-w-lg rounded-card border border-line bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-ink">Calculation Preview</h3>
            <p className="mt-1 font-mono text-xs text-ink-muted">
              {previewOffer.id} ({previewOffer.merchantMarketId})
            </p>

            <div className="mt-4 flex items-center gap-2">
              <input
                type="text"
                placeholder="Destination Postcode (optional)"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                className="w-full rounded-[9px] border border-line px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={() => handlePreviewCalc(previewOffer)}
                className="rounded-[9px] bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
              >
                Update
              </button>
            </div>

            {previewLoading ? (
              <div className="py-8 text-center text-sm text-ink-muted">Calculating...</div>
            ) : previewResult ? (
              <div className="mt-4 space-y-2 rounded-card bg-canvas p-4 text-xs">
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-muted">Delivery Rule Sourced:</span>
                  <span className="font-semibold text-ink">
                    {previewResult.deliveryRuleFound ? "Yes" : "No (Unknown)"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-muted">Item Price:</span>
                  <span className="font-semibold text-ink">
                    {previewResult.breakdown?.itemPrice?.known
                      ? `${previewResult.breakdown.currency} ${previewResult.breakdown.itemPrice.value}`
                      : "Unknown"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-muted">Delivery Charge:</span>
                  <span className="font-semibold text-ink">
                    {previewResult.breakdown?.delivery?.charge?.known
                      ? `${previewResult.breakdown.currency} ${previewResult.breakdown.delivery.charge.value}`
                      : "Unknown"}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-sm font-bold text-ink">
                  <span>Known Delivered Total:</span>
                  <span>
                    {previewResult.breakdown?.total?.known
                      ? `${previewResult.breakdown.currency} ${previewResult.breakdown.total.value}`
                      : "Unknown"}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="mt-5 text-right">
              <button
                type="button"
                onClick={() => setPreviewOffer(null)}
                className="rounded-[9px] border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-canvas"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
