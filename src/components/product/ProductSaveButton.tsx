"use client";
import type { SavedItem } from "@/lib/savedItems";
import { useSavedItems } from "@/lib/savedItems";
import { useDictionary } from "@/i18n/DictionaryProvider";
import ProductIcon from "./ProductIcon";
export default function ProductSaveButton({ product, showLabel = false }: { product: Omit<SavedItem, "addedAt">; showLabel?: boolean }) {
  const { isSaved, toggle } = useSavedItems();
  const t = useDictionary().categoryV2;
  const saved = isSaved(product.id);
  const label = saved ? t.savedItemActive : t.savedItem;
  return <button type="button" onClick={() => toggle(product)} aria-pressed={saved} aria-label={`${label}: ${product.title}`} title={label} className={`inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-full border bg-white px-2.5 text-sm font-semibold transition ${saved ? "border-brand-border text-brand" : "border-line text-ink-soft hover:border-brand hover:text-brand"}`}><ProductIcon name="heart" fill={saved ? "currentColor" : "none"} className="h-[18px] w-[18px]" />{showLabel && <span className="pr-1">{label}</span>}</button>;
}
