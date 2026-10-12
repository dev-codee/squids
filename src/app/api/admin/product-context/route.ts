import { NextRequest, NextResponse } from "next/server";
import { getProductById, getMatchingProducts, getProductVariants } from "@/lib/db/products";
import { getPriceHistory } from "@/lib/db/price-observations";
import { getMerchantMarketForMerchant } from "@/lib/db/merchant-markets";
import { getDeliveryRules } from "@/lib/db/delivery";
import { adminId, ProductInputError } from "@/lib/model/productAdmin";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const product = await getProductById(adminId(request.nextUrl.searchParams.get("id")));
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    const market = (request.nextUrl.searchParams.get("market") || product.regionCodes?.[0] || "").toUpperCase();
    if (!product.regionCodes?.includes(market)) throw new ProductInputError("Select one of this product's markets.");
    const [matches, variants, history, merchantMarket] = await Promise.all([
      getMatchingProducts(product), getProductVariants(product, 50, market), getPriceHistory(product.id, market),
      product.demo ? Promise.resolve(null) : getMerchantMarketForMerchant(product.advertiserId, market, product.network),
    ]);
    const rules = product.demo ? product.demo.deliveryRule ? [product.demo.deliveryRule] : [] : merchantMarket ? await getDeliveryRules(merchantMarket.id) : [];
    return NextResponse.json({ product, market, offers: matches.rows.filter(r => r.product.regionCodes?.includes(market)).map(r => ({ product: r.product, basis: r.result.basis })), variants, history, rules });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ProductInputError ? error.message : "Could not load product management details." }, { status: error instanceof ProductInputError ? 400 : 500 });
  }
}
