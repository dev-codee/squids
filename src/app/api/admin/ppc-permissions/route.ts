import { NextRequest, NextResponse } from "next/server";
import {
  addManualNote,
  approvePermission,
  deletePermission,
  getPermissionById,
  listPermissions,
  setEconomicsSignOff,
  suppressPermission,
  upsertPermission,
  type PpcPermissionQuery,
} from "@/lib/db/ppc-permissions";
import { sendFollowups, sendInitialRequests } from "@/lib/ppc/outreach";
import { getRawAdvertiserById, slugifyAdvertiserName } from "@/lib/db/advertisers";
import type { PpcBrandInAdText } from "@/lib/ppc";

export const dynamic = "force-dynamic";

/**
 * Admin API for PPC permissions. Protected by the session cookie / Bearer token
 * check in `middleware.ts`, which covers every `/api/admin/*` route.
 *
 *   GET    ?id=…                     one record
 *   GET    ?status=&view=&search=…   paged directory listing
 *   POST   { action: "upsert" | "send_now" | "followup_now", … }
 *   PATCH  { id, action: "approve" | "refuse" | "do_not_contact" | "reopen"
 *                      | "economics_signoff" | "note" , … }
 *   DELETE ?id=…                     only permitted for dry-run (isTest) rows
 */

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const id = params.get("id");
  if (id) {
    const permission = await getPermissionById(id);
    if (!permission) {
      return NextResponse.json({ error: "Permission record not found." }, { status: 404 });
    }
    return NextResponse.json({ permission });
  }

  const query: PpcPermissionQuery = {
    status: params.get("status") ?? undefined,
    network: params.get("network") ?? undefined,
    country: params.get("country") ?? undefined,
    search: params.get("search") ?? undefined,
    view: (params.get("view") as PpcPermissionQuery["view"]) ?? undefined,
    includeTest: params.get("includeTest") === "1",
    page: Number(params.get("page")) || 1,
    pageSize: Number(params.get("pageSize")) || 30,
  };

  const result = await listPermissions(query);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action ?? "upsert";

  // --- Manual send triggers (used to validate the flow in dry-run mode) -----
  if (action === "send_now" || action === "followup_now") {
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const opts = { only: String(body.id), dryRun: Boolean(body.dryRun), limit: 1 };
    const result = action === "send_now" ? await sendInitialRequests(opts) : await sendFollowups(opts);

    // `considered: 0` means the record didn't pass the claim filter — most often
    // because it has already been emailed, which is exactly the guarantee.
    if (result.considered === 0) {
      return NextResponse.json({
        ok: false,
        error:
          action === "send_now"
            ? "Not eligible for an initial send — already sent, suppressed, or missing a valid contact email / landing page."
            : "Not eligible for a follow-up — already followed up, a reply arrived, the window hasn't passed, or the record is suppressed.",
        result,
      });
    }
    return NextResponse.json({ ok: result.sent > 0, result });
  }

  // --- Create / update -----------------------------------------------------
  if (action === "upsert") {
    const merchantId = Number(body.merchantId);
    if (!Number.isFinite(merchantId) || merchantId <= 0) {
      return NextResponse.json({ error: "merchantId is required" }, { status: 400 });
    }
    const network = String(body.network ?? "awin");

    // Fill the denormalised merchant fields from the advertiser record when the
    // caller didn't supply them, so the directory list always has a real name.
    let merchantName: string | undefined = body.merchantName?.trim() || undefined;
    let merchantSlug: string | null | undefined = body.merchantSlug ?? undefined;
    if (!merchantName || merchantSlug === undefined) {
      const advertiser = await getRawAdvertiserById(merchantId, network).catch(() => null);
      if (advertiser) {
        merchantName = merchantName || advertiser.name;
        if (merchantSlug === undefined) merchantSlug = slugifyAdvertiserName(advertiser.name);
      }
    }

    const { permission, created } = await upsertPermission({
      merchantId,
      network,
      merchantName,
      merchantSlug: merchantSlug ?? null,
      publisherId: body.publisherId ?? undefined,
      contactName: body.contactName ?? undefined,
      contactEmail: body.contactEmail ?? undefined,
      country: body.country ?? undefined,
      landingPage: body.landingPage ?? undefined,
      keywordsScope: body.keywordsScope ?? undefined,
      brandInAdText: body.brandInAdText as PpcBrandInAdText | undefined,
      notes: body.notes ?? undefined,
      isTest: body.isTest,
    });

    return NextResponse.json({ ok: true, created, permission }, { status: created ? 201 : 200 });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = body.id ? String(body.id) : null;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  switch (body.action) {
    case "approve": {
      const result = await approvePermission(id, {
        permissionScope: String(body.permissionScope ?? ""),
        evidence: String(body.evidence ?? ""),
        brandInAdText: body.brandInAdText as PpcBrandInAdText | undefined,
        keywordsScope: body.keywordsScope,
        landingPage: body.landingPage,
        country: body.country,
        notes: body.notes,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    case "refuse":
    case "do_not_contact": {
      const result = await suppressPermission(id, {
        status: body.action === "refuse" ? "REFUSED" : "DO_NOT_CONTACT",
        evidence: body.evidence,
        notes: body.notes,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    case "economics_signoff": {
      const result = await setEconomicsSignOff(id, {
        signedOffBy: body.signedOffBy ?? null,
        notes: body.economicsNotes,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    case "note": {
      const result = await addManualNote(id, {
        body: String(body.body ?? ""),
        direction: body.direction === "outbound" ? "outbound" : "inbound",
        subject: body.subject ?? null,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const permission = await getPermissionById(id);
  if (!permission) {
    return NextResponse.json({ error: "Permission record not found." }, { status: 404 });
  }

  // Real permission records are the written audit trail behind a live campaign.
  // Deleting one would destroy the evidence, so only dry-run rows may be removed
  // — everything else is closed with DO_NOT_CONTACT instead.
  if (!permission.isTest) {
    return NextResponse.json(
      {
        error:
          "Only dry-run (test) records can be deleted. Use the 'Do not contact' action to retire a real merchant record and keep its audit trail.",
      },
      { status: 403 },
    );
  }

  const deleted = await deletePermission(id);
  return NextResponse.json({ ok: deleted });
}
