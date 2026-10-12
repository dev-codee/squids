"use client";
import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/products";
import type { Advertiser } from "@/lib/awin";
import { merchantProductRegions } from "@/lib/model/productAssignment";
import ProductManagementPanel from "./ProductManagementPanel";
import ProductImage from "@/components/product/ProductImage";

export type ProductCopyKind = "variant" | "offer";
type Props = { isOpen: boolean; onClose: () => void; onSaved: (product: Product, warning?: string) => void; product: Product | null; copyKind?: ProductCopyKind; onSelect: (product: Product, copyKind?: ProductCopyKind) => void };
const control = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand disabled:bg-slate-100";
const textFields = ["title", "category", "description", "brand", "mpn", "gtin", "size", "colour", "flavour", "regionalSpec", "imageUrl", "trackingUrl", "currency", "salePrice", "originalPrice", "discountPercentage", "rating", "reviewsCount", "packCount"] as const;
function initial(product: Product | null, copyKind?: ProductCopyKind) {
  const data: Record<string, string> = Object.fromEntries(textFields.map(k => [k, product?.[k] == null ? "" : String(product[k])]));
  if (copyKind === "variant") data.gtin = "";
  return { ...data, id: copyKind ? "" : product ? String(product.id) : "", advertiserId: copyKind === "offer" ? "" : product ? String(product.advertiserId) : "", network: copyKind === "offer" ? "" : product?.network || "", regionCodes: product?.regionCodes?.join(", ") || "", condition: product?.condition || "unknown", demoRetailerName: product?.demo?.retailerName || "" };
}
export default function ProductModal({ isOpen, onClose, onSaved, product, copyKind, onSelect }: Props) {
  const editing = Boolean(product && !copyKind);
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<Record<string, string>>(() => initial(product, copyKind));
  const [specs, setSpecs] = useState<{ label: string; value: string }[]>([]);
  const [stock, setStock] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("details");
  const [search, setSearch] = useState(""), [results, setResults] = useState<Advertiser[]>([]), [searching, setSearching] = useState(false);
  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  useEffect(() => {
    setForm(initial(product, copyKind)); setSpecs(product?.specifications?.map(s => ({ ...s })) || []); setStock(product?.inStock ?? true); setError(""); setTab("details"); setResults([]);
    setSearch(product && copyKind !== "offer" ? product.demo?.retailerName || `${product.network} · #${product.advertiserId}` : "");
  }, [product, copyKind, isOpen]);
  useEffect(() => { if (isOpen && !dialog.current?.open) dialog.current?.showModal(); else if (!isOpen) dialog.current?.close(); }, [isOpen]);
  useEffect(() => {
    if (!isOpen || form.advertiserId || search.trim().length < 2) { setResults([]); setSearching(false); return; }
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try { const response = await fetch(`/api/admin/advertisers?search=${encodeURIComponent(search)}&pageSize=8`, { signal: abort.signal }); const json = await response.json(); if (!response.ok) throw Error(json.error || "Retailer search failed."); setResults(json.advertisers || []); }
      catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "Retailer search failed."); }
      finally { if (!abort.signal.aborted) setSearching(false); }
    }, 300);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [search, form.advertiserId, isOpen]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const payload = { ...form, id: form.id ? Number(form.id) : undefined, advertiserId: Number(form.advertiserId), regionCodes: form.regionCodes.split(",").map(s => s.trim().toUpperCase()).filter(Boolean), inStock: stock, specifications: specs, ...(copyKind && { copyFrom: product?.id, copyKind }) };
      const response = await fetch("/api/admin/products", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await response.json(); if (!response.ok) throw Error(json.error || "Product could not be saved.");
      onSaved(json.product, json.warning);
    } catch (e) { setError(e instanceof Error ? e.message : "Product could not be saved."); }
    finally { setSaving(false); }
  }
  const field = (name: string, label: string, type = "text", required = false, hint?: string) => <label key={name} className="block text-xs font-semibold text-slate-700">{label}{required && " *"}<input name={name} type={type} required={required} value={form[name] || ""} onChange={e => update(name, e.target.value)} className={control} {...(type === "number" ? { min: name === "packCount" || name === "id" ? 1 : 0, step: ["packCount", "reviewsCount", "id"].includes(name) ? "1" : "0.01" } : {})} />{hint && <span className="mt-1 block text-xs font-normal leading-relaxed text-slate-500">{hint}</span>}</label>;
  const management = ["related", "delivery", "history"].includes(tab);
  return <dialog ref={dialog} onCancel={e => { e.preventDefault(); if (!saving) onClose(); }} className="max-h-[92vh] w-[min(960px,96vw)] rounded-2xl bg-white p-0 text-ink shadow-2xl backdrop:bg-black/50">
    <header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-7"><div><h2 className="text-lg font-bold">{copyKind === "variant" ? "Add product variant" : copyKind === "offer" ? "Add retailer offer" : editing ? `Manage product #${product?.id}` : "Add product"}</h2><p className="mt-1 text-xs text-slate-500">{editing ? product?.title : "Save the listing, then manage delivery and price history."}</p></div><button type="button" disabled={saving} onClick={onClose} aria-label="Close product editor" className="rounded-lg border border-slate-200 px-3 py-1.5 text-lg disabled:opacity-50">×</button></header>
    <nav aria-label="Product editor sections" className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-5 py-2">{[["details", "Details"], ["identity", "Identity & variants"], ["pricing", "Price & links"], ["related", "Variants & offers"], ["delivery", "Delivery"], ["history", "Price history"]].map(([key, label]) => <button type="button" key={key} disabled={!editing && ["related", "delivery", "history"].includes(key)} onClick={() => setTab(key)} aria-pressed={tab === key} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40 ${tab === key ? "bg-ink text-white" : "text-slate-600 hover:bg-slate-200"}`}>{label}</button>)}</nav>
    {product?.demo && <p className="mx-5 mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Review fixture: keep the [DEMO] title prefix. Demo delivery and history remain separate from real retailer data.</p>}
    {copyKind && <p className="mx-5 mt-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-900">{copyKind === "offer" ? "Choose a different retailer and set its price, stock and tracking link. The identity fields are copied to connect this offer to the same product." : "Keep the brand and model. Change the size, colour, flavour or pack count, then update the title, price and image."}</p>}
    {error && <p role="alert" className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {management && product ? <ProductManagementPanel key={`${product.id}:${tab}`} product={product} section={tab} onSelect={onSelect} /> : <form noValidate onSubmit={save} className="space-y-5 p-5 sm:p-7">
      <div hidden={tab !== "details"} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold">Product ID<input type="number" min="1" step="1" value={form.id} disabled={editing} onChange={e => update("id", e.target.value)} placeholder="Assigned automatically" className={control} /></label>
          <div className="relative"><label className="text-xs font-semibold">Retailer *<input required value={search} onChange={e => { setSearch(e.target.value); setForm(prev => ({ ...prev, advertiserId: "", network: "" })); }} placeholder="Search and select a retailer" className={control} /></label><p className="mt-1 text-xs text-slate-500">{searching ? "Searching…" : form.advertiserId ? `Selected: ${form.network} · #${form.advertiserId}` : "Select a result before saving."}</p>{results.length > 0 && <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-white shadow-lg">{results.map(adv => <button type="button" key={`${adv.network}:${adv.id}`} className="block w-full border-b p-3 text-left text-xs hover:bg-slate-50" onClick={() => { setForm(prev => ({ ...prev, advertiserId: String(adv.id), network: adv.network, regionCodes: prev.regionCodes || merchantProductRegions(adv).join(", "), currency: prev.currency || adv.currencyCode || "", demoRetailerName: product?.demo ? `${adv.name} · Demo offer` : "" })); setSearch(adv.name); setResults([]); }}><strong>{adv.name}</strong><span className="mt-1 block text-slate-500">{adv.network} · #{adv.id}</span></button>)}</div>}</div>
        </div>
        {field("title", "Product title", "text", true)}
        <div className="grid gap-4 sm:grid-cols-2">{field("category", "Category")}{field("regionCodes", "Country codes", "text", true, "Comma-separated supported markets, e.g. AU, NZ.")}</div>
        <label className="block text-xs font-semibold">Description<textarea name="description" rows={4} maxLength={10000} value={form.description} onChange={e => update("description", e.target.value)} className={control} /></label>
        <div className="grid items-start gap-4 sm:grid-cols-[1fr_120px]">{field("imageUrl", "Product image URL", "text", false, "An https:// URL or an existing local /image path.")}<ProductImage src={form.imageUrl} title={form.title || "Image preview"} className="h-28 w-full rounded-lg border border-slate-200 p-2" /></div>
        <fieldset><legend className="text-sm font-semibold">Specifications</legend><p className="mt-1 text-xs text-slate-500">Add the details shoppers should see on the product page.</p><div className="mt-3 space-y-2">{specs.map((spec, i) => <div key={i} className="flex gap-2"><input aria-label={`Specification ${i + 1} name`} placeholder="Name" required value={spec.label} onChange={e => setSpecs(rows => rows.map((r, n) => n === i ? { ...r, label: e.target.value } : r))} className={control + " !w-1/3"} /><input aria-label={`Specification ${i + 1} value`} placeholder="Value" required value={spec.value} onChange={e => setSpecs(rows => rows.map((r, n) => n === i ? { ...r, value: e.target.value } : r))} className={control} /><button type="button" aria-label={`Remove specification ${i + 1}`} onClick={() => setSpecs(rows => rows.filter((_, n) => n !== i))} className="px-2 text-red-700">×</button></div>)}</div><button type="button" disabled={specs.length >= 50} onClick={() => setSpecs(rows => [...rows, { label: "", value: "" }])} className="mt-3 rounded-lg border px-3 py-2 text-xs font-semibold">+ Add specification</button></fieldset>
      </div>
      <div hidden={tab !== "identity"} className="space-y-4"><p className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">Brand and model group variants. Size, colour, flavour, pack and condition keep different items separate. Matching identifiers connect the same item across retailers.</p><div className="grid gap-4 sm:grid-cols-2">{field("brand", "Brand")}{field("mpn", "Model / manufacturer part number")}{field("gtin", "GTIN / EAN / UPC", "text", false, "8, 12, 13 or 14 digits; leave blank if unknown.")}{field("size", "Size / capacity")}{field("colour", "Colour")}{field("flavour", "Flavour")}{field("packCount", "Units in pack", "number")}<label className="text-xs font-semibold">Condition<select value={form.condition} onChange={e => update("condition", e.target.value)} className={control}>{["unknown", "new", "refurbished", "used"].map(v => <option key={v}>{v}</option>)}</select></label>{field("regionalSpec", "Regional specification")}</div></div>
      <div hidden={tab !== "pricing"} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">{field("salePrice", "Current item price", "number", false, "Blank means unknown. Zero is a real zero price.")}{field("currency", "Price currency", "text", true, "Three letters, e.g. AUD, USD, EUR.")}</div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={stock} onChange={e => setStock(e.target.checked)} className="h-4 w-4 accent-brand" />In stock</label>{field("trackingUrl", "Retailer / affiliate tracking URL", "url")}{product?.demo && field("demoRetailerName", "Demo retailer display name", "text", true)}<p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Saving a new or changed price records a dated observation. Delivery costs are managed in the Delivery tab after saving.</p><details className="rounded-lg border p-4"><summary className="cursor-pointer text-xs font-semibold">Legacy internal reference fields</summary><p className="my-3 text-xs text-slate-500">These unsourced reference fields do not appear as public discounts or customer ratings.</p><div className="grid gap-4 sm:grid-cols-2">{field("originalPrice", "Reference price", "number")}{field("discountPercentage", "Reference discount %", "number")}{field("rating", "Reference rating (0–5)", "number")}{field("reviewsCount", "Reference review count", "number")}</div></details></div>
      <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t bg-white py-4"><button type="button" disabled={saving} onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Close</button><button type="submit" disabled={saving || !form.advertiserId} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : editing ? "Save product" : "Create product"}</button></footer>
    </form>}
  </dialog>;
}
