"use client";

import { useEffect, useRef, useState } from "react";
import type { Advertiser } from "@/lib/awin";
import type { PpcBrandInAdText, PpcPermission } from "@/lib/ppc";

interface PpcPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Existing record to edit, or null to create one. */
  permission: PpcPermission | null;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

/**
 * Create or edit a PPC permission record.
 *
 * Only contact and requested-scope fields are editable here. Status and the send
 * timestamps belong to the outreach jobs and the approve/refuse actions on the
 * detail page — there is deliberately no way to fake "already sent" from a form.
 */
export default function PpcPermissionModal({
  isOpen,
  onClose,
  onSaved,
  permission,
}: PpcPermissionModalProps) {
  const isEditing = Boolean(permission);

  const emptyForm = {
    merchantId: "",
    network: "awin",
    merchantName: "",
    publisherId: "",
    contactName: "",
    contactEmail: "",
    country: "",
    landingPage: "",
    keywordsScope: "",
    brandInAdText: "unanswered" as PpcBrandInAdText,
    notes: "",
    isTest: false,
  };

  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [advSearch, setAdvSearch] = useState("");
  const [advResults, setAdvResults] = useState<Advertiser[]>([]);
  const [showAdvDropdown, setShowAdvDropdown] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (permission) {
      setFormData({
        merchantId: String(permission.merchantId),
        network: permission.network,
        merchantName: permission.merchantName,
        publisherId: permission.publisherId ?? "",
        contactName: permission.contactName ?? "",
        contactEmail: permission.contactEmail ?? "",
        country: permission.country ?? "",
        landingPage: permission.landingPage ?? "",
        keywordsScope: permission.keywordsScope ?? "",
        brandInAdText: permission.brandInAdText,
        notes: permission.notes ?? "",
        isTest: permission.isTest,
      });
      setAdvSearch(permission.merchantName);
    } else {
      setFormData(emptyForm);
      setAdvSearch("");
    }
    setError(null);
    setAdvResults([]);
    setShowAdvDropdown(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission, isOpen]);

  useEffect(() => {
    // Merchant is fixed once a record exists — it is half of the unique key.
    if (isEditing) return;
    if (advSearch.trim().length < 2) {
      setAdvResults([]);
      setShowAdvDropdown(false);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/advertisers?search=${encodeURIComponent(advSearch)}&pageSize=6`);
        const data = await res.json();
        setAdvResults(data.advertisers || []);
        setShowAdvDropdown(true);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [advSearch, isEditing]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/ppc-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert",
          merchantId: Number(formData.merchantId),
          network: formData.network,
          merchantName: formData.merchantName || undefined,
          publisherId: formData.publisherId || null,
          contactName: formData.contactName || null,
          contactEmail: formData.contactEmail || null,
          country: formData.country || null,
          landingPage: formData.landingPage || null,
          keywordsScope: formData.keywordsScope || null,
          brandInAdText: formData.brandInAdText,
          notes: formData.notes || null,
          isTest: formData.isTest,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save the permission record.");

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl transition-all">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? `Edit permission — ${permission?.merchantName}` : "Add PPC permission record"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {isEditing ? (
              <div className="sm:col-span-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <strong className="text-gray-900">{permission?.merchantName}</strong> · id{" "}
                {permission?.merchantId} · {permission?.network}
                <span className="block text-gray-500">
                  Merchant and network are the record&apos;s unique key and can&apos;t be changed.
                </span>
              </div>
            ) : (
              <>
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-700">Search store *</label>
                  <input
                    type="text"
                    required
                    value={advSearch}
                    onChange={(e) => {
                      setAdvSearch(e.target.value);
                      if (formData.merchantId) setFormData({ ...formData, merchantId: "" });
                    }}
                    placeholder="e.g. Nike"
                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                      formData.merchantId
                        ? "border-emerald-500 bg-emerald-50 ring-emerald-500"
                        : "border-gray-300 focus:border-accent focus:ring-accent"
                    }`}
                  />
                  {formData.merchantId && (
                    <span className="absolute right-3 top-8 text-xs font-bold text-emerald-600">
                      ✓ ID: {formData.merchantId}
                    </span>
                  )}
                  {showAdvDropdown && advResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                      {advResults.map((adv) => (
                        <div
                          key={`${adv.network}-${adv.id}`}
                          className="cursor-pointer border-b border-gray-100 px-4 py-2 hover:bg-gray-50"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              merchantId: String(adv.id),
                              network: adv.network || "awin",
                              merchantName: adv.name,
                              // Seed the scope fields from what we already know
                              // about the store, so the form is mostly filled.
                              country: formData.country || adv.countryCode || "",
                              keywordsScope:
                                formData.keywordsScope ||
                                `${adv.name}, ${adv.name} coupon, ${adv.name} voucher code, ${adv.name} discount code`,
                            });
                            setAdvSearch(adv.name);
                            setShowAdvDropdown(false);
                          }}
                        >
                          <p className="text-sm font-semibold text-gray-900">{adv.name}</p>
                          <p className="text-[11px] text-gray-500">
                            {adv.network} · id {adv.id} · {adv.countryCode ?? "—"} · {adv.relationship ?? "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700">Network *</label>
                  <input
                    type="text"
                    required
                    value={formData.network}
                    onChange={(e) => setFormData({ ...formData, network: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700">Contact name</label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                placeholder="Programme contact"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Contact email</label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                placeholder="affiliates@merchant.com"
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-gray-500">
                Nothing is sent until this and the landing page are both valid.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Market (ISO-2)</label>
              <input
                type="text"
                maxLength={2}
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value.toUpperCase() })}
                placeholder="DE"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Our publisher ID</label>
              <input
                type="text"
                value={formData.publisherId}
                onChange={(e) => setFormData({ ...formData, publisherId: e.target.value })}
                placeholder="Quoted in the email so they can find us"
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">Landing page *</label>
              <input
                type="url"
                value={formData.landingPage}
                onChange={(e) => setFormData({ ...formData, landingPage: e.target.value })}
                placeholder="https://www.foxzil.com/de/nike"
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">Keywords we want to bid on</label>
              <textarea
                rows={2}
                value={formData.keywordsScope}
                onChange={(e) => setFormData({ ...formData, keywordsScope: e.target.value })}
                placeholder="nike, nike coupon, nike voucher code"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Brand name in ad copy</label>
              <select
                value={formData.brandInAdText}
                onChange={(e) =>
                  setFormData({ ...formData, brandInAdText: e.target.value as PpcBrandInAdText })
                }
                className={inputClass}
              >
                <option value="unanswered">Unanswered</option>
                <option value="allowed">Allowed</option>
                <option value="prohibited">Prohibited</option>
              </select>
              <p className="mt-1 text-[11px] text-gray-500">
                Leave as unanswered until the merchant confirms in writing.
              </p>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={formData.isTest}
                  onChange={(e) => setFormData({ ...formData, isTest: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                />
                Dry-run record
              </label>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">Internal notes</label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          {formData.isTest && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Dry-run records always send to <code>PPC_TEST_EMAIL</code>, never to the contact
              address above — even in production.
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !formData.merchantId}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-hover disabled:opacity-50"
            >
              {submitting ? "Saving…" : isEditing ? "Save changes" : "Create record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
