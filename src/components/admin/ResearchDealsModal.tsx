"use client";

import { useEffect, useState } from "react";

interface AdvertiserOption {
  id: number;
  name: string;
  url?: string;
  displayUrl?: string;
  network?: string;
}

interface ResearchDealsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ResearchDealsModal({
  isOpen,
  onClose,
  onSuccess,
}: ResearchDealsModalProps) {
  const [advertisers, setAdvertisers] = useState<AdvertiserOption[]>([]);
  const [loadingAdvertisers, setLoadingAdvertisers] = useState(false);

  const [selectedAdvertiserId, setSelectedAdvertiserId] = useState<string>("");
  const [customStoreName, setCustomStoreName] = useState("");
  const [customDomain, setCustomDomain] = useState("");

  const [isResearching, setIsResearching] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function loadAdvertisers() {
      setLoadingAdvertisers(true);
      try {
        const res = await fetch("/api/advertisers?pageSize=100");
        const json = await res.json();
        if (json.advertisers) {
          setAdvertisers(json.advertisers);
        }
      } catch (err) {
        console.error("Failed to fetch advertisers:", err);
      } finally {
        setLoadingAdvertisers(false);
      }
    }

    loadAdvertisers();
  }, [isOpen]);

  // Sync selected advertiser info to fields
  function handleSelectAdvertiser(advIdStr: string) {
    setSelectedAdvertiserId(advIdStr);
    if (!advIdStr) {
      setCustomStoreName("");
      setCustomDomain("");
      return;
    }
    const found = advertisers.find((a) => String(a.id) === advIdStr);
    if (found) {
      setCustomStoreName(found.name);
      let domain = found.displayUrl || "";
      if (!domain && found.url) {
        try {
          domain = new URL(found.url).hostname.replace(/^www\./, "");
        } catch {}
      }
      setCustomDomain(domain);
    }
  }

  async function handleStartResearch() {
    if (!customStoreName.trim()) {
      setErrorMessage("Please select or enter a store name.");
      return;
    }

    setIsResearching(true);
    setResultMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/admin/deals/trigger-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advertiserId: selectedAdvertiserId ? Number(selectedAdvertiserId) : undefined,
          storeName: customStoreName.trim(),
          domain: customDomain.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Research failed.");

      setResultMessage(data.message || "Research complete! Check discovered coupons.");
      onSuccess();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error executing research.");
    } finally {
      setIsResearching(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                AI / n8n Coupon Researcher
              </h2>
              <p className="text-xs text-gray-500">
                Live web search across RetailMeNot, CouponCabin, Slickdeals &amp; feeds
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Select Existing Store (Optional)
            </label>
            <select
              value={selectedAdvertiserId}
              onChange={(e) => handleSelectAdvertiser(e.target.value)}
              disabled={loadingAdvertisers || isResearching}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
            >
              <option value="">-- Choose a joined advertiser or enter custom --</option>
              {advertisers.map((adv) => (
                <option key={adv.id} value={adv.id}>
                  {adv.name} (#{adv.id})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Store / Brand Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customStoreName}
                onChange={(e) => setCustomStoreName(e.target.value)}
                disabled={isResearching}
                placeholder="e.g. Nike, Sephora, NordVPN"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Website Domain (Optional)
              </label>
              <input
                type="text"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                disabled={isResearching}
                placeholder="e.g. nike.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3 text-xs text-purple-800 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <span>💡</span> How it works:
            </p>
            <p className="text-purple-700 leading-relaxed text-[11px]">
              The system queries live web search across top coupon aggregators (RetailMeNot, CouponCabin, Dealspotr) and official merchant sites. Codes are verified, deduplicated against existing database offers, and staged in your Discovered Deals queue.
            </p>
          </div>

          {resultMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-start gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <div>{resultMessage}</div>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
              <span className="text-red-600 font-bold">✕</span>
              <div>{errorMessage}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4 bg-gray-50/50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={isResearching}
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleStartResearch}
            disabled={isResearching || !customStoreName.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50 transition"
          >
            {isResearching ? (
              <>
                <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                </svg>
                <span>Searching Live Web...</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span>Find Deals Now</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
