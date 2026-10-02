/**
 * Server-side bridge from stored records to the delivered-total calculator.
 *
 * `deliveredTotal` is a pure function on purpose: everything it needs is passed
 * in. This module is the only place that goes and gets those things — the
 * merchant-market (for currency and identity), its delivery rule for the
 * shopper's destination, and the merchant's structured promotions.
 *
 * Where a record is missing, nothing is substituted. No merchant-market means
 * no delivery rule, which means an unknown delivery charge, which means an
 * unknown total — the honest chain, all the way through.
 */

import type { Product } from "@/lib/products";
import type { DeliveryRule } from "@/lib/model/delivery";
import type {
  DeliveredTotalBreakdown,
  EvaluablePromotion,
  ShopperContext,
} from "@/lib/model/deliveredTotal";
import { deliveredTotal } from "@/lib/model/deliveredTotal";
import { fromNullable } from "@/lib/model/known";
import { getMerchantMarketForMerchant } from "@/lib/db/merchant-markets";
import { getDeliveryRuleFor } from "@/lib/db/delivery";
import { getDealsFromDb } from "@/lib/db/deals";

export interface OfferTotal {
  productId: number;
  breakdown: DeliveredTotalBreakdown;
  /** Merchant-market currency when known, otherwise the market default. */
  currency: string;
  /** True when no merchant-market record backs this retailer in this market. */
  unresolvedMerchant: boolean;
}

/** Deals structured enough to take part in a calculation. */
async function promotionsFor(
  advertiserId: number,
  market: string,
): Promise<EvaluablePromotion[]> {
  const paged = await getDealsFromDb({
    advertiserId,
    country: market,
    pageSize: 50,
  }).catch(() => null);
  if (!paged) return [];

  return paged.deals
    .filter((deal) => deal.promotion)
    .map((deal) => ({
      id: `${deal.network}:${deal.id}`,
      structure: deal.promotion!,
      markets: deal.regionCodes ?? [],
      startDate: deal.startDate,
      endDate: deal.endDate,
      label: deal.discountText ?? deal.title,
    }));
}

/**
 * Compute a delivered total for each comparison row.
 *
 * Rows are resolved in parallel, and any lookup failure degrades to "no record"
 * rather than throwing: a comparison page that cannot reach the delivery
 * collection must still render, showing those totals as unknown.
 */
export async function deliveredTotalsFor(params: {
  products: readonly Product[];
  market: string;
  defaultCurrency: string;
  shopper?: Partial<ShopperContext>;
  now?: Date;
}): Promise<Map<number, OfferTotal>> {
  const market = params.market.toUpperCase();

  const entries = await Promise.all(
    params.products.map(async (product): Promise<OfferTotal> => {
      const merchantMarket = await getMerchantMarketForMerchant(
        product.advertiserId,
        market,
      ).catch(() => null);

      let rule: DeliveryRule | null = null;
      if (merchantMarket) {
        rule = await getDeliveryRuleFor(merchantMarket.id, {
          market,
          postcode: params.shopper?.postcode ?? null,
          serviceLevel: params.shopper?.serviceLevel ?? "standard",
        }).catch(() => null);
      }

      const promotions = await promotionsFor(product.advertiserId, market).catch(
        () => [],
      );

      const currency = merchantMarket?.currency ?? params.defaultCurrency;
      const shopper: ShopperContext = {
        market,
        postcode: params.shopper?.postcode ?? null,
        serviceLevel: params.shopper?.serviceLevel ?? "standard",
        quantity: params.shopper?.quantity ?? 1,
        customerType: params.shopper?.customerType ?? "unknown",
      };

      return {
        productId: product.id,
        currency,
        unresolvedMerchant: !merchantMarket,
        breakdown: deliveredTotal(
          {
            itemPrice: fromNullable(product.salePrice),
            currency,
            deliveryRule: rule,
            promotions,
            shopper,
            productId: product.id,
            categorySlug: product.category,
          },
          params.now,
        ),
      };
    }),
  );

  return new Map(entries.map((e) => [e.productId, e]));
}
