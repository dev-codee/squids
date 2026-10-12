import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getProductById } from "@/lib/db/products";
import { getDb } from "@/lib/mongodb";
import { adminId, adminObject, adminText, adminNumber, adminUrl, ProductInputError } from "@/lib/model/productAdmin";
import { revalidatePublic, CACHE_TAGS } from "@/lib/cache";
export const dynamic = "force-dynamic";
async function save(request: NextRequest, correction: boolean) {
  try {
    let input; try { input = await request.json(); } catch { throw new ProductInputError("Invalid JSON body."); }
    const body = adminObject(input), productId = adminId(body.productId);
    const product = await getProductById(productId);
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    const market = adminText(body.market, "Market", 2, true).toUpperCase();
    if (!product.regionCodes?.includes(market)) throw new ProductInputError("Select one of this product's markets.");
    const price = adminNumber(body.itemPrice, "Item price", { required: true })!;
    const reviewer = adminText(body.reviewedBy, "Reviewer", 150, true);
    const sourceUrl = adminUrl(body.sourceUrl, "Source URL");
    if (!product.demo && !sourceUrl) throw new ProductInputError("A source URL is required for real price observations.");
    const db = await getDb(), col = db.collection("price_observations");
    if (correction) {
      const id = adminText(body.id, "Observation ID", 250, true), reason = adminText(body.reason, "Correction reason", 1000, true);
      const existing = await col.findOne({ id, productId, market });
      if (!existing) return NextResponse.json({ error: "Observation not found for this product and market." }, { status: 404 });
      // Keep every previous correction and use a compare-and-swap to avoid lost edits.
      const result = await col.updateOne({ _id: existing._id, itemPrice: existing.itemPrice }, {
        $set: { itemPrice: price, isCorrection: true, originalValue: existing.originalValue ?? existing.itemPrice, correctionReason: reason, correctedBy: reviewer, sourceUrl, correctedAt: new Date().toISOString(), corrections: [...(existing.corrections ?? []), { previousPrice: existing.itemPrice, correctedPrice: price, reason, reviewer, sourceUrl, at: new Date().toISOString() }] },
      });
      if (!result.matchedCount) return NextResponse.json({ error: "This observation changed. Reload before correcting it." }, { status: 409 });
    } else {
      const observedAt = adminText(body.observedAt, "Observation date", 40, true), time = Date.parse(observedAt);
      if (!Number.isFinite(time) || time > Date.now()) throw new ProductInputError("Choose a valid observation date that is not in the future.");
      await col.insertOne({ id: `admin:${productId}:${randomUUID()}`, productId, market, retailerId: product.advertiserId, retailerName: product.demo?.retailerName || `${product.network}:${product.advertiserId}`, itemPrice: price, currency: product.currency || "USD", observedAt: new Date(time).toISOString(), sourceUrl, reviewedBy: reviewer, sourceBatchId: product.demo?.fixtureSet || "admin-observation", ...(product.demo && { demoFixtureSet: product.demo.fixtureSet }) });
    }
    revalidatePublic(CACHE_TAGS.advertisers);
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error instanceof ProductInputError ? error.message : "Price history could not be saved." }, { status: error instanceof ProductInputError ? 400 : 500 }); }
}
export const POST = (request: NextRequest) => save(request, false);
export const PATCH = (request: NextRequest) => save(request, true);
