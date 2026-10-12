import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createProduct, updateProduct, deleteProduct, getNextProductId, getProductById } from "@/lib/db/products";
import { getDb } from "@/lib/mongodb";
import type { Advertiser } from "@/lib/awin";
import type { Product } from "@/lib/products";
import { productAssignment, selectProductMerchant, ProductAssignmentError } from "@/lib/model/productAssignment";
import { adminId, adminObject, adminText, productFields, ProductInputError } from "@/lib/model/productAdmin";
import { isValidRegionCode } from "@/lib/regions";
import { recordPriceObservation } from "@/lib/db/price-observations";
import { revalidatePublic, CACHE_TAGS } from "@/lib/cache";

export const dynamic = "force-dynamic";
async function readBody(request: NextRequest) {
  try { return adminObject(await request.json()); } catch (error) { if (error instanceof ProductInputError) throw error; throw new ProductInputError("Invalid JSON body."); }
}
async function assignmentFor(body: Record<string, unknown>, existing?: Product) {
  const advertiserId = adminId(body.advertiserId ?? existing?.advertiserId);
  const network = adminText(body.network ?? existing?.network, "Network", 100, true);
  if (body.regionCodes !== undefined && (!Array.isArray(body.regionCodes) || body.regionCodes.some(c => typeof c !== "string" || !isValidRegionCode(c)))) throw new ProductInputError("Choose supported country codes.");
  const regions = body.regionCodes as string[] | undefined;
  const currency = adminText(body.currency ?? existing?.currency, "Currency", 3).toUpperCase();
  if (currency && !/^[A-Z]{3}$/.test(currency)) throw new ProductInputError("Currency must contain three letters.");
  // Fictional retailers have no advertiser record. Preserve their existing ownership.
  if (existing?.demo && advertiserId === existing.advertiserId && network === existing.network) {
    return productAssignment({ id: advertiserId, network, countryCodes: existing.regionCodes, currencyCode: existing.currency }, { regionCodes: regions, currency }, existing);
  }
  const db = await getDb();
  const merchants = await db.collection<Advertiser>("advertisers").find({ id: advertiserId, network }).limit(2).toArray();
  return productAssignment(selectProductMerchant(merchants, network), { regionCodes: regions, currency }, existing);
}
function failure(error: unknown) {
  if (error instanceof ProductInputError || error instanceof ProductAssignmentError) return NextResponse.json({ error: error.message }, { status: 400 });
  if ((error as { code?: number })?.code === 11000) return NextResponse.json({ error: "That product ID already exists. Choose another ID or leave it blank." }, { status: 409 });
  console.error("Admin product operation failed:", error);
  return NextResponse.json({ error: "Product could not be saved. Please try again." }, { status: 500 });
}
async function observePrice(product: Product, previous?: Product) {
  if (product.salePrice === null || (previous && previous.salePrice === product.salePrice && previous.currency === product.currency && JSON.stringify(previous.regionCodes) === JSON.stringify(product.regionCodes))) return undefined;
  try {
    for (const market of product.regionCodes ?? []) await recordPriceObservation({
      id: `admin:${product.id}:${randomUUID()}`, productId: product.id, market, retailerId: product.advertiserId,
      retailerName: product.demo?.retailerName || `${product.network}:${product.advertiserId}`,
      itemPrice: product.salePrice, currency: product.currency || "USD", observedAt: new Date().toISOString(),
      sourceBatchId: product.demo?.fixtureSet || "admin-product-save",
    });
  } catch { return "Product saved, but price history could not be recorded. Use the History tab to add the observation."; }
}
function demoData(existing: Product | undefined, body: Record<string, unknown>, title: string) {
  if (!existing?.demo) return undefined;
  if (!/^\[DEMO\]/.test(title)) throw new ProductInputError("Keep the [DEMO] prefix on review fixtures. Create a separate product for real inventory.");
  return { ...existing.demo, retailerName: body.demoRetailerName === undefined ? existing.demo.retailerName : adminText(body.demoRetailerName, "Demo retailer name", 150, true) };
}
export async function GET(request: NextRequest) {
  try { const product = await getProductById(adminId(request.nextUrl.searchParams.get("id"))); return product ? NextResponse.json({ product }) : NextResponse.json({ error: "Product not found." }, { status: 404 }); } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);
    const source = body.copyFrom ? await getProductById(adminId(body.copyFrom)) : undefined;
    if (body.copyFrom && !source) return NextResponse.json({ error: "Source product not found." }, { status: 404 });
    const input = { ...source, ...body };
    const id = body.id === undefined || body.id === "" ? await getNextProductId() : adminId(body.id);
    const product = { ...productFields(input), id, ...await assignmentFor(input, source ?? undefined) } as Product;
    if (product.salePrice !== null && !product.currency) throw new ProductInputError("Enter a currency for the listed price.");
    const demo = demoData(source ?? undefined, body, product.title);
    if (demo) product.demo = { ...demo, comparisonOnly: body.copyKind === "offer" };
    if (source && body.copyKind === "offer" && product.advertiserId === source.advertiserId && product.network === source.network) throw new ProductInputError("Choose a different retailer for the new offer.");
    if (source && body.copyKind === "variant") {
      if (!product.brand || !product.mpn || product.brand !== source.brand || product.mpn !== source.mpn) throw new ProductInputError("A variant must share the source product's brand and model.");
      if (["size", "colour", "flavour", "packCount"].every(k => (product[k as keyof Product] ?? null) === (source[k as keyof Product] ?? null))) throw new ProductInputError("Change the size, colour, flavour or pack count for the new variant.");
    }
    const created = await createProduct(product);
    const warning = await observePrice(created);
    revalidatePublic(CACHE_TAGS.advertisers, CACHE_TAGS.categories);
    return NextResponse.json({ success: true, product: created, warning }, { status: 201 });
  } catch (error) { return failure(error); }
}
export async function PUT(request: NextRequest) {
  try {
    const body = await readBody(request), id = adminId(body.id);
    const existing = await getProductById(id);
    if (!existing) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    const changes = { ...productFields(body, true), ...await assignmentFor(body, existing) };
    if ((changes.salePrice === undefined ? existing.salePrice : changes.salePrice) !== null && !changes.currency) throw new ProductInputError("Enter a currency for the listed price.");
    const demo = demoData(existing, body, changes.title ?? existing.title);
    if (demo) Object.assign(changes, { demo });
    if (!await updateProduct(id, changes)) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    const product = { ...existing, ...changes };
    const warning = await observePrice(product, existing);
    revalidatePublic(CACHE_TAGS.advertisers, CACHE_TAGS.categories);
    return NextResponse.json({ success: true, product, warning });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: NextRequest) {
  try {
    const success = await deleteProduct(adminId(request.nextUrl.searchParams.get("id")));
    revalidatePublic(CACHE_TAGS.advertisers, CACHE_TAGS.categories);
    return success ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Product not found." }, { status: 404 });
  } catch (error) { return failure(error); }
}
