import type { DeliveryRule } from "./delivery";
/** A keyword alone never establishes free shipping. */
export function deliveryKind(rule?: DeliveryRule | null, market?: string): "free" | "conditional" | "paid" | "unknown" {
  if (!rule || (market && (rule.zone?.market || "").toUpperCase() !== market.toUpperCase()) || !rule.sourceUrl || !rule.charge?.known) return "unknown";
  if (rule.freeThreshold?.known && rule.freeThreshold.value > 0) return "conditional";
  if ((rule.zone.regions?.length ?? 0) || (rule.zone.postcodePrefixes?.length ?? 0) || (rule.restrictions?.length ?? 0)) return "conditional";
  return rule.charge.value === 0 ? "free" : rule.charge.value > 0 ? "paid" : "unknown";
}
