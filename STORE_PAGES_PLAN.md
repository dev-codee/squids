# Store Pages — Data Integration Plan

> **Purpose of this doc:** give any developer or AI model full context on the
> public "store" pages, where their data comes from, and the phased plan to make
> **everything admin-managed or DB-backed (Awin-synced) with NO mock data.**
>
> Last updated: 2026-08-11

---

## 1. What this project is

A Next.js 14 (App Router) affiliate site. An admin dashboard manages Awin
advertisers and deals; public pages present per-store coupons, deals, products,
etc. (Foxzil-style, e.g. `foxzil.com/amazon/coupons`).

- **Framework:** Next.js 14.2 (App Router, RSC), React 18, TypeScript, Tailwind v3.4
- **DB:** MongoDB (`awin_affiliates` db) via `src/lib/mongodb.ts` → `getDb()`
- **External data:** Awin Publisher API (advertisers + promotions), synced into Mongo via cron routes
- **Auth:** cookie/JWT (`jose`) — dashboard is admin-only

### Public routes (the "store" pages)
| Route | File | Purpose |
|---|---|---|
| `/[store]` | `src/app/[store]/page.tsx` | Store overview: coupons, deals, products, price comparison, categories, latest discounts, buying guides, FAQs, reviews |
| `/[store]/coupons` | `src/app/[store]/coupons/page.tsx` | Verified coupons, promo codes, student discounts, cashback |
| `/[store]/deals` | `src/app/[store]/deals/page.tsx` | Today's / lightning / limited-time / trending deals |

`[store]` also handles 2-letter country codes (`/us`, `/pk`) for backward compat →
renders the advertiser listing (`AdvertisersClient`). Store slugs (e.g. `amazon`)
render the store pages.

### Public UI components (data-source agnostic)
`src/components/store/`: `StoreHeader`, `CouponCard`, `LightningDealCard`,
`ProductFeedCard`, `PriceComparisonWidget`, `FaqAccordion`, `ReviewsWidget`.

---

## 2. Data sources that already exist (real)

| Collection | Populated by | Admin CRUD | Key fields |
|---|---|---|---|
| `advertisers` | Awin sync (`/api/cron/sync-advertisers`) + `/dashboard/advertisers` | ✅ `/api/admin/advertisers` | id, name, logoUrl, url, region, countryCode, commission, status |
| `deals` | Awin sync (`/api/cron/sync-deals`) + `/dashboard/deals` | ✅ `/api/admin/deals` | id, title, description, advertiser{id,name,logoUrl}, type (`voucher`\|`promotion`), code, startDate, endDate, status, trackingUrl, regionCodes, **+enrichment (see §4)** |

DB access layer: `src/lib/db/advertisers.ts`, `src/lib/db/deals.ts`.
Types: `src/lib/awin.ts` (Advertiser), `src/lib/deals.ts` (Deal).

**Reads fall back to Awin** when Mongo is empty (see `getDealsFromDb`/`getAdvertisersFromDb` returning `null`).

---

## 3. Hardcoded → Linkable map (the whole point)

Before this work, **all** store-page content came from `src/lib/storeData.ts`
(pure mock). Target end-state:

| Store section | Real source | Status |
|---|---|---|
| Store identity (name, logo, website URL) | `advertisers` (matched by slug) | Phase 1 |
| Coupons (code, title, expiry, affiliate link, subtype) | `deals` where `type=voucher` | Phase 1 |
| Deals (title, desc, expiry, link, image, price, placement) | `deals` where `type=promotion` | Phase 1 |
| Active coupon/deal counts | derived from `deals` | Phase 1 |
| Store meta (rating, categories, banner, description, avgSavings) | `storeMeta` (new) | Phase 2 |
| Products feed | `products` (new) | Phase 3 |
| Reviews | `reviews` (new) | Phase 4 |
| FAQs | `faqs` (new) | Phase 4 |
| Buying guides | `buyingGuides` (new) | Phase 4 |
| Price comparison | needs multi-retailer pricing — **out of scope for now** | Deferred |

**Rule:** no mock. If a section has no data for a store, it is **hidden**, not faked.

---

## 4. `deals` schema enrichment (Phase 1 — DONE)

Added optional, admin-managed fields to `Deal` (`src/lib/deals.ts`). Awin never
provides these; the admin fills them in. All optional → absent means "not set".

```ts
// shared
discountText?: string | null;   // "20% OFF", "$15 OFF"
imageUrl?: string | null;       // product/hero image
originalPrice?: number | null;
salePrice?: number | null;
isExclusive?: boolean;          // also mapped from Awin exclusiveOnly

// voucher/coupon-only
subtype?: "code" | "student" | "cashback" | null;  // coupons-page grouping
cashbackRate?: string | null;
studentVerificationReq?: string | null;

// promotion/deal-only
placement?: "todays" | "lightning" | "limited" | "trending" | null; // deals-page grouping
stockPercentage?: number | null; // lightning claim bar (0–100)
```

- Parsed/validated in `src/app/api/admin/deals/route.ts` via `parseEnrichment()`
  (used by both POST create and PUT update).
- Editable in `src/components/admin/DealModal.tsx` under a "Public Page Display"
  section that switches fields on voucher vs promotion.

---

## 5. Slug → advertiser matching

Store URLs use a slug (`amazon`, `best-buy`). Advertisers are keyed by numeric
Awin `id` + `name`. We resolve a slug to an advertiser by **slugifying the name**
and matching (see `getAdvertiserBySlug` in `src/lib/db/advertisers.ts`).

- Slugify: lowercase, non-alphanumeric runs → `-`, trim leading/trailing `-`.
- Match uses a loose, anchored, case-insensitive regex so `best-buy` ↔ "Best Buy".
- (Phase 2 may add an explicit `slug` field to advertisers for exact control.)

---

## 6. Public data loader (Phase 1)

`src/lib/storeData.ts` is being converted from a mock generator to a
**DB-backed async loader**:

- `loadStoreData(slug): Promise<StoreData | null>`
  1. `getAdvertiserBySlug(slug)` → identity; `null` ⇒ page returns `notFound()`.
  2. `getDealsFromDb({ advertiserId })` → split by `type`:
     - `voucher` → `coupons[]` (grouped by `subtype`)
     - `promotion` → `deals[]` (grouped by `placement`)
  3. Sections without a source yet (products, reviews, faqs, guides, priceComparisons)
     return **empty arrays** — pages hide empty sections.
- Public pages become `async` server components and call `loadStoreData`.

---

## 7. Phase plan & status

- [x] **Phase 1a** — enrich `Deal` schema + admin API + `DealModal`
- [x] **Phase 1b** — `getAdvertiserBySlug` + rewrite `storeData.ts` to DB loader
- [x] **Phase 1c** — rewire `/[store]`, `/[store]/coupons`, `/[store]/deals` to async DB reads; hide empty sections; remove mock
- [x] **Phase 2** — `storeMeta` collection (slug, rating, categories, banner, description, avgSavings) + admin UI
- [x] **Phase 3** — `products` collection + admin UI + wire product feed
- [x] **Phase 4** — `reviews`, `faqs`, `buyingGuides` collections + admin UI
- [ ] **Deferred** — price comparison (needs external multi-retailer pricing)

---

## 8. Conventions to follow (for new collections)

Mirror the existing `deals`/`advertisers` pattern exactly:

1. **Type** in `src/lib/<name>.ts` (or extend an existing type).
2. **DB layer** in `src/lib/db/<name>.ts`: `getDb()`, `createIndex`, CRUD +
   `get…ByAdvertiser(advertiserId)`, `getNext…Id()` (custom IDs start at `900000+`).
3. **Admin API** `src/app/api/admin/<name>/route.ts`: POST/PUT/DELETE, validate,
   coerce with `toTrimmedOrNull` / `toNumberOrNull` helpers.
4. **Admin page** `src/app/dashboard/<name>/page.tsx` + **modal**
   `src/components/admin/<Name>Modal.tsx` (copy `DealModal`).
5. **Nav** entry in `src/components/DashboardNav.tsx`.
6. **Public read** via the store loader in `src/lib/storeData.ts`; render only when non-empty.

### Gotchas
- Tailwind is **v3.4** — do NOT use v4-only classes (`shadow-2xs`, etc.).
- Custom animations/utilities (`animate-fade-in`, `scrollbar-none`) live in
  `src/app/globals.css`, not the Tailwind config.
- Coupon reveal: clicking "Show Code" copies the code AND opens the affiliate
  link in a **new tab** (user stays on page) — see `CouponCard.tsx`.
- Public store pages set `export const dynamic = "force-dynamic"`.
- Advertiser cards link to `/[slug]` (the store page), not the removed
  `/[country]/advertisers/[slug]` route.
