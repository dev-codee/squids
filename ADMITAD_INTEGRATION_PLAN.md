# Admitad Integration Plan

> Context doc for implementing Admitad affiliate-network support, mirroring the
> existing Awin integration. Written for any AI/engineer picking this up.
> Status: **planning complete, implementation not started.**

## Goal

Integrate the **Admitad** affiliate network to full parity with Awin:
advertisers, coupons/deals, and transactions — plus Admitad's aggregated
date/month statistics. Admitad stores & coupons appear on the **public
storefront** (region pages `/us`, `/de`, …) alongside Awin, and Admitad gets its
own **admin dashboard** under Networks → Admitad, with earnings rolled into the
combined "All Earnings" view.

### Decisions already locked (from the user)
- **Scope:** full parity (advertisers + coupons + transactions + reports).
- **Public storefront:** Admitad advertisers/coupons show publicly, unified with Awin.

---

## Existing Awin architecture (the template to mirror)

| Layer | File(s) | Role |
|---|---|---|
| Auth | env `AWIN_API_TOKEN`, `AWIN_PUBLISHER_ID` | static bearer token |
| Advertisers client | `src/lib/awin.ts` → `fetchProgrammes(relationship)` | Awin programmes → normalized `Advertiser` |
| Deals client | `src/lib/deals.ts` → `fetchDeals({page,pageSize})` | vouchers/promotions → `Deal` |
| Transactions client | `src/lib/transactions.ts` → `fetchTransactions(start,end)` | conversions → `Transaction` |
| Persistence | `src/lib/db/advertisers.ts`, `src/lib/db/deals.ts`, `src/lib/db/transactions.ts` | upsert + query MongoDB |
| Sync jobs | `src/app/api/cron/sync-advertisers`, `sync-deals`, `sync-transactions` | guarded by `CRON_SECRET` (Bearer or `?secret=`) |
| Sync metadata | `src/lib/db/sync-meta.ts` (`SyncEntity`, `getLastSyncTime`, `updateSyncTime`, `recordSyncError`) | last-sync tracking |
| Scheduling | `vercel.json` `crons` (all at `0 3 * * *`) | daily |
| Networks registry | `src/lib/networks.ts` (`NETWORKS[]`, `getNetwork`) | drives sidebar, overview, per-network pages |
| Dashboard UI | `src/components/transactions/TransactionsDashboard.tsx` | reusable analytics view (used by `/dashboard` overview data + `/dashboard/networks/awin`) |
| Network dashboards | `src/app/dashboard/networks/[network]/page.tsx` (scaffold) + `/networks/awin/page.tsx` (live) | |

**Key data shapes** (all in `src/lib/*`):
- `Advertiser` (`src/lib/awin.ts`): `id, name, logoUrl, status, relationship, region, countryCode, currencyCode, commission, url` + manual overrides `description, categories, bannerUrl, avgSavings, rating, isFlagship, isGlobal, isPPC`.
- `Deal` (`src/lib/deals.ts`): `id, advertiser{id,name,...}, type: "voucher"|"promotion", code, discountText, originalPrice, salePrice, placement, endDate, isExclusive, ...`.
- `Transaction` (`src/lib/transactions.ts`): `id, advertiserId, advertiserName, status, commission, commissionCurrency, orderValue, orderCurrency, transactionDate, clickDate, customerCountry`.

**Important existing quirks to respect:**
- Advertiser upsert uses `$setOnInsert` (never overwrites existing rows on re-sync).
- Awin transactions omit advertiser name; it's resolved from the `advertisers`
  collection at **read time** in `src/lib/db/transactions.ts`
  (`buildAdvertiserNameMap`). Admitad actions DO include campaign name — store it.
- Public advertiser currency is per-region (see `src/lib/regions.ts`,
  `src/lib/fx.ts`); deal prices are converted from advertiser currency → region
  currency at read time in `src/lib/storeData.ts`.

---

## Admitad API reference

- **Host:** `https://api.admitad.com` (Admitad now operates under **Mitgo** —
  confirm the host shown in the user's panel API docs before shipping).
- **Auth:** OAuth2 **client_credentials** grant. Unlike Awin's static token,
  Admitad requires a token exchange:
  - `POST /token/` with `Content-Type: application/x-www-form-urlencoded`,
    header `Authorization: Basic <base64(client_id:client_secret)>`,
    body `grant_type=client_credentials&client_id=<id>&scope=<space-separated scopes>`.
  - Returns `access_token` + `expires_in` (~2 hours). **Cache in-memory with
    expiry** (like `programmeCache` in `src/lib/awin.ts`); refresh on expiry.
  - All data calls use header `Authorization: Bearer <access_token>`.
- **Pagination:** `?limit=&offset=`; responses have `{ results: [...], _meta: { count, limit, offset } }`.
- **Website (`wID`):** the publisher site id in Admitad; required by
  `.../website/{wID}/` endpoints. Env `ADMITAD_WEBSITE_ID`.

### Endpoint → entity mapping

| Our entity | Admitad endpoint | Scope | Notes |
|---|---|---|---|
| Advertisers | `GET /advcampaigns/website/{wID}/` | `advcampaigns_for_website` | connected programs: name, logo, `regions`, currency, commission, status/connection |
| Coupons/Deals | `GET /coupons/website/{wID}/` | `coupons_for_website` | promo codes & offers; has campaign, dates, discount |
| Transactions | `GET /statistics/actions/` | `statistics` | individual conversions: `action`, `status` (pending/approved/declined), `payment`, `currency`, `action_date`, `click_date`, `advcampaign_id/name`, `order_id` |
| Date report | `GET /statistics/dates/` | `statistics` | pre-aggregated per day (for dashboard date reports) |
| Month report | `GET /statistics/months/` | `statistics` | pre-aggregated per month |
| Balance (optional) | `GET /me/balance/`, `/payments/` | `payments` | accurate pending vs paid |

> Verify exact field names & query params (`date_start`, `date_end`, `subid`,
> `status`, `advcampaign`) against live docs during Phase 4.

### Status mapping (Admitad → our normalized status)
- `pending` / `1` → `pending`
- `approved` / `confirmed` / `2` → `approved`
- `declined` / `rejected` / `3` → `declined`
(Confirm Admitad's exact status codes when wiring `statistics/actions`.)

---

## Required architecture change: multi-network

Advertisers/deals/transactions are currently implicitly Awin-only and keyed by a
numeric `id`. **Admitad ids can collide with Awin ids**, so we add a network
discriminator and composite keys BEFORE adding Admitad. Backwards-compatible:
existing rows get stamped `network: "awin"`.

1. Add `network: "awin" | "admitad"` to `Advertiser`, `Deal`, `Transaction`.
2. Change MongoDB uniqueness from `{ id }` → `{ network, id }` in
   `src/lib/db/*.ts` (unique indexes, upsert `filter`, `removeStale*`,
   `getById`, `getBySlug`). Migration: `updateMany({network:{$exists:false}}, {$set:{network:"awin"}})`.
3. Make reads network-aware: optional `network` filter (per-network dashboards)
   and cross-network aggregation (All Earnings, overview KPIs).
4. Per-network sync metadata: extend `SyncEntity` to include network, e.g.
   keys `awin:transactions`, `admitad:transactions` (or add a `network` arg).
5. Slug resolution (`getAdvertiserBySlug`) may now match across networks — keep
   deterministic (prefer exact slug; if two networks share a store, decide a
   winner — e.g. prefer the one with active deals, or namespace by network).

---

## Environment variables (add to `.env.local`, `.env.example`, Vercel)

```
ADMITAD_CLIENT_ID=...            # OAuth2 app client id
ADMITAD_CLIENT_SECRET=...        # OAuth2 app client secret
ADMITAD_BASIC_AUTH=...           # base64(client_id:client_secret) for /token/ (optional; can compute at runtime)
ADMITAD_WEBSITE_ID=...           # numeric publisher website id (PENDING from user)
```
> User has already added client id, secret, and the base64 header locally.
> **`ADMITAD_WEBSITE_ID` is still pending** — advertiser/coupon/website-scoped
> endpoints cannot be built end-to-end until it's provided; the OAuth token
> helper and `statistics/*` (account-level) can be built/tested first.

---

## Phased implementation

### Phase 1 — Foundations (credential-independent)
- Add `network` field + composite `(network, id)` keys across the three DB
  layers; run the `network: "awin"` backfill.
- `src/lib/admitad.ts`: `getAdmitadToken()` (client_credentials + in-memory
  expiry cache) and a small `admitadFetch(path, params)` helper with pagination.
- Add `admitad` to `src/lib/networks.ts` (`integrated: false` initially).

### Phase 2 — Advertisers
- `fetchAdmitadCampaigns()` → normalize to `Advertiser` (`network:"admitad"`,
  map regions→countryCode, currency, commission, logo, url).
- `src/app/api/cron/sync-advertisers`: also pull Admitad; upsert with
  `network:"admitad"`; `removeStale` scoped per network.
- Verify Admitad stores appear in `/dashboard/advertisers` (Stores) and on
  public region pages via `/api/advertisers`.

### Phase 3 — Coupons/Deals
- `fetchAdmitadCoupons()` → normalize to `Deal` (voucher/promotion, code,
  discount, dates, advertiser link).
- `sync-deals`: pull Admitad; upsert `network:"admitad"`; expire/stale per network.
- Confirm they render in `/dashboard/deals`, `/dashboard/coupons`, and public
  store pages (exclusive/sorting/currency logic already handles them).

### Phase 4 — Transactions & reports
- `fetchAdmitadActions(start,end)` → normalize to `Transaction`
  (`network:"admitad"`, keep `advertiserName` from Admitad).
- `sync-transactions`: incremental per network using per-network sync-meta.
- Flip Admitad to `integrated:true` in `networks.ts`.
- Build `/dashboard/networks/admitad/page.tsx`:
  - Reuse `TransactionsDashboard` (add a `network` prop so it queries
    `/api/transactions?network=admitad`), OR a dedicated Admitad view.
  - Add date/month report panels backed by `statistics/dates` & `statistics/months`.

### Phase 5 — Combined earnings
- `/dashboard/networks` (All Earnings) and `/dashboard` overview KPIs aggregate
  across `network` (sum commission, counts) instead of Awin-only.
- Per-network breakdown cards show live totals per network.

---

## API surface changes
- `/api/advertisers`, `/api/deals`, `/api/transactions`: accept optional
  `?network=awin|admitad`; default = all networks (union).
- New (optional) `/api/networks/[network]/stats?period=...` for date/month reports.

## Verification checklist (per phase)
- Token: `getAdmitadToken()` returns and caches; refreshes after expiry.
- Advertisers: count synced; a known store shows correct country/currency; visible publicly.
- Deals/coupons: codes/discounts render; exclusive + region currency correct.
- Transactions: statuses map correctly; totals match Admitad panel for a date range.
- Reports: date/month figures match Admitad statistics.
- Combined: All Earnings = Awin + Admitad; per-network filters work.

## Open items
- **Pending:** `ADMITAD_WEBSITE_ID`.
- Confirm API **host** (api.admitad.com vs Mitgo variant) and exact **scope names**.
- Confirm Admitad **status codes** and **statistics** field/param names.
- Single vs multiple Admitad websites (multi-site → loop over website ids).
- `CRON_SECRET` in `.env.local` is still the placeholder — set a real value before relying on cron auth.
```
