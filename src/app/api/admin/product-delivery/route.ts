import { NextRequest, NextResponse } from "next/server";
import { getProductById, updateProduct } from "@/lib/db/products";
import { getMerchantMarketForMerchant, upsertMerchantMarket } from "@/lib/db/merchant-markets";
import { getDeliveryRules, upsertDeliveryRule, deleteDeliveryRule } from "@/lib/db/delivery";
import { getDb } from "@/lib/mongodb";
import { NO_PERMISSIONS } from "@/lib/model/merchantMarket";
import { fromNullable } from "@/lib/model/known";
import { adminId, adminObject, adminText, adminNumber, adminUrl, ProductInputError } from "@/lib/model/productAdmin";
import { revalidatePublic, CACHE_TAGS } from "@/lib/cache";
import type { DeliveryRule } from "@/lib/model/delivery";
import { storeSlug } from "@/lib/networks";
export const dynamic = "force-dynamic";
export async function PUT(request: NextRequest) {
  try {
    let input; try { input = await request.json(); } catch { throw new ProductInputError("Invalid JSON body."); }
    const body = adminObject(input), product = await getProductById(adminId(body.productId));
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    const market = adminText(body.market, "Market", 2, true).toUpperCase();
    if (!product.regionCodes?.includes(market)) throw new ProductInputError("Select one of this product's markets.");
    let mm = product.demo ? null : await getMerchantMarketForMerchant(product.advertiserId, market, product.network);
    if (body.remove === true) {
      if (product.demo) await updateProduct(product.id, { demo: { ...product.demo, deliveryRule: null } });
      else {
        const rules = mm ? await getDeliveryRules(mm.id) : [];
        const id = adminText(body.id, "Delivery rule ID", 250, true);
        if (!rules.some(r => r.id === id)) return NextResponse.json({ error: "Delivery rule not found for this retailer and market." }, { status: 404 });
        await deleteDeliveryRule(id);
      }
    } else {
      const checkedBy = adminText(body.checkedBy, "Reviewer", 150, true), sourceUrl = adminUrl(body.sourceUrl, "Source URL");
      if (!sourceUrl && !product.demo) throw new ProductInputError("Provide the retailer's delivery policy URL.");
      const threshold = adminNumber(body.freeThreshold, "Free-delivery threshold");
      const basis = body.thresholdBasis || "unknown";
      if (!["before-discount", "after-discount", "unknown"].includes(String(basis)) || (threshold !== null && basis === "unknown")) throw new ProductInputError("Choose how the free-delivery threshold is calculated.");
      const prefixes = adminText(body.postcodePrefixes, "Postcode prefixes", 500).split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
      if (prefixes.some(p => !/^[A-Z0-9 -]{1,10}$/.test(p))) throw new ProductInputError("Enter valid comma-separated postcode prefixes.");
      if (product.demo && prefixes.length) throw new ProductInputError("Demo delivery supports a market-wide rule. Clear postcode prefixes.");
      if (body.taxIncluded !== null && typeof body.taxIncluded !== "boolean") throw new ProductInputError("Choose whether tax is included or unknown.");
      const merchantMarketId = mm?.id || `${product.network}:${product.advertiserId}:${market}`;
      const rule: DeliveryRule = { id: body.id ? adminText(body.id, "Rule ID", 250) : `${merchantMarketId}:standard:${prefixes.join("-") || "all"}`, merchantMarketId, zone: { market, postcodePrefixes: prefixes }, serviceLevel: "standard", currency: product.currency || "USD", charge: fromNullable(adminNumber(body.charge, "Delivery charge")), freeThreshold: fromNullable(threshold), thresholdBasis: basis as DeliveryRule["thresholdBasis"], mandatoryFees: fromNullable(adminNumber(body.mandatoryFees, "Mandatory fees")), taxIncluded: body.taxIncluded as boolean | null, sourceUrl: sourceUrl || "https://example.invalid/demo-delivery", checkedBy, checkedAt: new Date().toISOString(), restrictions: adminText(body.restrictions, "Restrictions", 2000).split("\n").filter(Boolean) };
      if (product.demo) await updateProduct(product.id, { demo: { ...product.demo, deliveryRule: rule } });
      else {
        const existingRules = mm ? await getDeliveryRules(mm.id) : [];
        if (body.id && !existingRules.some(r => r.id === rule.id)) throw new ProductInputError("That delivery rule does not belong to this retailer and market.");
        if (mm && mm.currency !== rule.currency) throw new ProductInputError(`This retailer's delivery rules use ${mm.currency}. Match the product currency before editing them.`);
        const priorRule = existingRules.find(r => r.id === rule.id);
        if (priorRule) {
          rule.serviceLevel = priorRule.serviceLevel;
          rule.zone.regions = priorRule.zone.regions;
        }
        if (!mm) {
          const db = await getDb(), advertiser = await db.collection("advertisers").findOne({ id: product.advertiserId, network: product.network });
          if (!advertiser) throw new ProductInputError("Retailer no longer exists.");
          await upsertMerchantMarket({ id: merchantMarketId, merchantId: product.advertiserId, network: product.network!, market, currency: rule.currency, displayName: advertiser.name, slug: storeSlug(advertiser.name), websiteUrl: advertiser.websiteUrl || null, approvedDomains: [], feedSourceIds: [], permissions: { ...NO_PERMISSIONS }, status: "pending" });
        }
        await upsertDeliveryRule(rule);
      }
    }
    revalidatePublic(CACHE_TAGS.advertisers);
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error instanceof ProductInputError ? error.message : "Delivery settings could not be saved." }, { status: error instanceof ProductInputError ? 400 : 500 }); }
}
