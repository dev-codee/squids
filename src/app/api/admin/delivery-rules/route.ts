import { NextRequest, NextResponse } from "next/server";
import {
  getDeliveryRules,
  upsertDeliveryRule,
  deleteDeliveryRule,
} from "@/lib/db/delivery";
import { emptyDeliveryRule, type DeliveryRule, type ThresholdBasis } from "@/lib/model/delivery";
import { fromNullable, known, unknown } from "@/lib/model/known";
import { logActivity } from "@/lib/db/activity-logs";
import { revalidatePublic, CACHE_TAGS } from "@/lib/cache";

export const dynamic = "force-dynamic";

const BASES: ThresholdBasis[] = ["before-discount", "after-discount", "unknown"];

/**
 * Read a money field from an admin form.
 *
 * An empty field means "not sourced", which is a different thing from zero.
 * Only an explicit number becomes a known value — so leaving the delivery
 * charge blank can never publish free delivery.
 */
function money(input: unknown): ReturnType<typeof fromNullable> {
  if (input === "" || input === null || input === undefined) return unknown("not-sourced");
  const n = Number(input);
  return Number.isFinite(n) ? known(n) : unknown("not-sourced");
}

/** GET /api/admin/delivery-rules?merchantMarketId=awin:1:AU */
export async function GET(request: NextRequest) {
  const merchantMarketId = request.nextUrl.searchParams.get("merchantMarketId");
  if (!merchantMarketId) {
    return NextResponse.json({ error: "merchantMarketId is required" }, { status: 400 });
  }
  try {
    const rules = await getDeliveryRules(merchantMarketId);
    return NextResponse.json({ rules });
  } catch (error) {
    console.error("GET /api/admin/delivery-rules:", error);
    return NextResponse.json({ error: "Failed to load delivery rules." }, { status: 500 });
  }
}

/**
 * PUT /api/admin/delivery-rules
 *
 * Create or update one rule. Money fields left blank stay unknown.
 *
 * `sourceUrl` and `checkedBy` are required: the brief only lets a delivery fact
 * be shown when it is sourced and reviewed, so a rule with neither would be
 * invisible on the public page anyway.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const merchantMarketId = typeof body?.merchantMarketId === "string" ? body.merchantMarketId : null;
    const market = typeof body?.market === "string" ? body.market.toUpperCase() : null;
    const currency = typeof body?.currency === "string" ? body.currency.toUpperCase() : null;

    if (!merchantMarketId || !market || !currency) {
      return NextResponse.json(
        { error: "merchantMarketId, market and currency are required" },
        { status: 400 },
      );
    }
    if (!body?.sourceUrl || !body?.checkedBy) {
      return NextResponse.json(
        {
          error:
            "sourceUrl and checkedBy are required — an unsourced delivery fact cannot be published.",
        },
        { status: 400 },
      );
    }

    const serviceLevel = String(body.serviceLevel ?? "standard");
    const id =
      typeof body.id === "string" && body.id
        ? body.id
        : `${merchantMarketId}:${serviceLevel}:${(body.zoneKey ?? "all").toString()}`;

    const basis: ThresholdBasis = BASES.includes(body.thresholdBasis)
      ? body.thresholdBasis
      : "unknown";

    const rule: DeliveryRule = {
      ...emptyDeliveryRule(id, merchantMarketId, market, currency),
      serviceLevel,
      zone: {
        market,
        regions: Array.isArray(body.regions) ? body.regions : undefined,
        postcodePrefixes: Array.isArray(body.postcodePrefixes)
          ? body.postcodePrefixes
          : undefined,
      },
      charge: money(body.charge),
      freeThreshold: money(body.freeThreshold),
      thresholdBasis: basis,
      mandatoryFees: money(body.mandatoryFees),
      taxIncluded: typeof body.taxIncluded === "boolean" ? body.taxIncluded : null,
      restrictions: Array.isArray(body.restrictions) ? body.restrictions : [],
      sourceUrl: String(body.sourceUrl),
      checkedAt: new Date().toISOString(),
      checkedBy: String(body.checkedBy),
    };

    // A free-delivery threshold is meaningless without knowing what it measures.
    if (rule.freeThreshold.known && rule.thresholdBasis === "unknown") {
      return NextResponse.json(
        {
          error:
            "thresholdBasis must be 'before-discount' or 'after-discount' when a free-delivery threshold is set — merchants differ and it changes the answer.",
        },
        { status: 400 },
      );
    }

    await upsertDeliveryRule(rule);

    await logActivity({
      type: "store_updated",
      title: "Delivery rule saved",
      description: `${merchantMarketId} ${serviceLevel}: charge ${
        rule.charge.known ? rule.charge.value : "unknown"
      }, threshold ${rule.freeThreshold.known ? rule.freeThreshold.value : "unknown"} (${basis})`,
      entity: id,
      status: "success",
    }).catch(() => {});

    revalidatePublic(CACHE_TAGS.advertisers);
    return NextResponse.json({ rule });
  } catch (error) {
    console.error("PUT /api/admin/delivery-rules:", error);
    return NextResponse.json({ error: "Failed to save delivery rule." }, { status: 500 });
  }
}

/** DELETE /api/admin/delivery-rules?id=... */
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  try {
    const ok = await deleteDeliveryRule(id);
    revalidatePublic(CACHE_TAGS.advertisers);
    return NextResponse.json({ ok });
  } catch (error) {
    console.error("DELETE /api/admin/delivery-rules:", error);
    return NextResponse.json({ error: "Failed to delete delivery rule." }, { status: 500 });
  }
}
