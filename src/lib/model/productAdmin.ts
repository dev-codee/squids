import type { Product } from "../products";

export class ProductInputError extends Error {}
export function adminObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProductInputError("A JSON object is required.");
  return value as Record<string, unknown>;
}
export function adminText(value: unknown, label: string, max = 500, required = false): string {
  if (value === undefined || value === null) value = "";
  if (typeof value !== "string" || value.length > max) throw new ProductInputError(`${label} must be text, at most ${max} characters.`);
  const text = value.trim();
  if (required && !text) throw new ProductInputError(`${label} is required.`);
  return text;
}
export function adminNumber(value: unknown, label: string, options: { integer?: boolean; max?: number; min?: number; required?: boolean } = {}): number | null {
  if (value === null || value === undefined || value === "") {
    if (options.required) throw new ProductInputError(`${label} is required.`);
    return null;
  }
  if ((typeof value !== "string" && typeof value !== "number") || (typeof value === "string" && !value.trim())) throw new ProductInputError(`${label} must be a number.`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < (options.min ?? 0) || n > (options.max ?? Number.MAX_SAFE_INTEGER) || (options.integer && !Number.isSafeInteger(n))) throw new ProductInputError(`${label} is outside the allowed range.`);
  return n;
}
export function adminId(value: unknown): number {
  return adminNumber(value, "Product ID", { integer: true, min: 1, required: true })!;
}
export function adminUrl(value: unknown, label: string, local = false): string | null {
  const text = adminText(value, label, 2048);
  if (!text) return null;
  if (local && /^\/(?!\/)[a-zA-Z0-9_./% -]+$/.test(text) && !text.includes("..")) return text;
  try { const url = new URL(text); if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) return text; } catch {}
  throw new ProductInputError(`${label} must be an HTTP(S) URL${local ? " or a local /path" : ""}.`);
}
export function productFields(body: Record<string, unknown>, partial = false): Partial<Product> {
  const out: Partial<Product> = {};
  const strings = ["title", "category", "brand", "mpn", "gtin", "size", "colour", "flavour", "regionalSpec", "description"] as const;
  for (const key of strings) {
    if (partial && body[key] === undefined) continue;
    const value = adminText(body[key], key, key === "description" ? 10000 : 500, key === "title");
    if (key === "title") out.title = value;
    else out[key] = value || null;
  }
  if (out.gtin && !/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(out.gtin)) throw new ProductInputError("GTIN must contain 8, 12, 13 or 14 digits.");
  for (const key of ["salePrice", "originalPrice", "discountPercentage", "rating", "reviewsCount", "packCount"] as const) {
    if (partial && body[key] === undefined) continue;
    out[key] = adminNumber(body[key], key, { max: key === "rating" ? 5 : key === "discountPercentage" ? 100 : undefined, integer: key === "reviewsCount" || key === "packCount", min: key === "packCount" ? 1 : 0 });
  }
  for (const key of ["imageUrl", "trackingUrl"] as const) if (!partial || body[key] !== undefined) out[key] = adminUrl(body[key], key, key === "imageUrl");
  if (!partial || body.inStock !== undefined) {
    if (body.inStock !== undefined && typeof body.inStock !== "boolean") throw new ProductInputError("Stock must be true or false.");
    out.inStock = body.inStock !== false;
  }
  if (!partial || body.condition !== undefined) {
    const condition = body.condition || "unknown";
    if (!["new", "used", "refurbished", "unknown"].includes(String(condition))) throw new ProductInputError("Select a valid condition.");
    out.condition = condition as Product["condition"];
  }
  if (!partial || body.specifications !== undefined) {
    const rows = body.specifications ?? [];
    if (!Array.isArray(rows) || rows.length > 50) throw new ProductInputError("Use at most 50 specification rows.");
    out.specifications = rows.map(row => {
      const item = adminObject(row);
      return { label: adminText(item.label, "Specification name", 100, true), value: adminText(item.value, "Specification value", 1000, true) };
    });
  }
  return out;
}
