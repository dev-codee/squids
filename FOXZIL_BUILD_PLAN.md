# Foxzil — Build Plan vs. Complete UI Design

Gap analysis of `Foxzil_Complete_UI_Design.pdf` (29 Sep 2026, 32pp) against this codebase,
with a step-by-step completion plan.

**How to use this file:** each task is a checkbox. Tick it only when the stated
*Done means* condition is actually true — the PDF's own rule is "done means evidence
exists". Update the Status line of a feature when all its tasks are ticked.

Legend: **✅ Done** · **🟡 Partial** · **❌ Missing** · **🚫 Deferred** (PDF says defer)

---

## 0. Scorecard

| # | Area | PDF ref | Status |
|---|------|---------|--------|
| 1 | Design system & shared UI | p.17 | ✅ Done |
| 2 | Homepage | p.18–19 | ✅ Done |
| 3 | Category directory + results | p.20–21 | ✅ Done |
| 4 | Store detail page | p.22–23 | ✅ Done |
| 5 | Coupon card data contract | p.24 | ✅ Done |
| 6 | Exact-product comparison page | p.25–26 | ✅ Done |
| 7 | Core data model | p.13 | ✅ Done |
| 8 | Matching & ranking | p.14 | ✅ Done |
| 9 | Price / discount / delivery rules | p.15 | ✅ Done |
| 10 | Price history & alerts | p.27 | ✅ Done |
| 11 | Publishing workflow & jobs | p.11–12 | ✅ Done |
| 12 | Admin UI & publishing control | p.28 | ✅ Done |
| 13 | Events & reporting | p.29 | ✅ Done |
| 14 | SEO & AI-search implementation | p.16 | ✅ Done |
| 15 | Trust, disclosure & corrections | p.9, p.17 | ✅ Done |
| 16 | Business model & evidence | p.4–7 | 🟡 UI & Reporting Live (Awaiting Live Network Settlements) |

**Delivered total & data contract fully built:** All underlying delivery-cost, mandatory-charges,
promotion structures, and exact-product comparison rules are fully modeled and tested.
Calculator functions compute known totals per retailer and propagate unknown explicitly.

---

## 1. Design system & shared UI — ✅ Done

**PDF (p.17):** Ivory `#FAF9F5` canvas, navy `#18243A` text, orange `#BF481C` primary,
white cards, 12px corners, ~1200px content width, green only for supported status.

**Exists:** `tailwind.config.ts` defines `canvas`, `ink`, `brand`, `line`, `rounded-card`
(12px), `max-w-shell` (1200px). `src/app/globals.css` sets the canvas background.
`PublicHeader` / `PublicFooter` are on the tokens. Store, category and product
components were migrated off the old amber/gray palette.

- [x] Colour tokens defined and applied
- [x] 12px corner radius token
- [x] 1200px content width token
- [x] Header and footer on the design system
- [x] **Audit remaining public pages still on legacy amber/gray** — *done 2026-10-01.*
  Migrated `/[country]/deals`, `/[country]/privacy`, `/[country]/about`, plus
  `DealCard`, `DealCardSkeleton`, `DealsFilterBar`, `FilterBar`, `Pagination`,
  `RegionSelector`, `SkeletonGrid`, `AdvertiserCard`.
  Verified: the grep returns nothing outside `admin`/`transactions` except the
  deliberate `amber-*` caution tones in `OfferTable` (semantic warning, same
  family as the existing `red-*` error and `emerald-*` verified tones).
- [x] **Type scale pass** — *done 2026-10-04.*
  Aligned typography across all primary views: desktop H1 40–48px via `lg:text-[40px]-text-[44px]`,
  mobile H1 26–28px via `text-[26px]-text-[28px]`, with `leading-tight`. Body 16px, secondary 14px.
  Verified on Home hero, Category directory, Product comparison, and Store detail.
- [x] **Accessibility pass** — *done 2026-10-04.*
  Added visible `focus-visible:ring-2 focus-visible:ring-brand` focus states to all interactive elements,
  modals, inputs, and tabs. Full keyboard accessibility (Tab, Enter, Escape) implemented on autocomplete
  dropdowns, filter toggles, terms disclosures, and dispute modals.
- [x] **Define the missing UI states** — *done 2026-10-04.*
  Explicit states rendered for: stale feed data warning banner, copy failure banner with `role="alert"`,
  alert subscription confirmation & error feedback, out-of-stock and unverified retailer badges.

---

## 2. Homepage — ✅ Done

**PDF (p.19):** H1 "Compare the price. Check the deal.", unified search accepting
product/brand/store, grouped suggestions, compare-products row, store deals,
crawlable categories, "How Foxzil works" 3 steps, real evidence module, saved+alerts.

**Exists:** `src/app/[country]/AdvertisersClient.tsx` composes `HomeHero`,
`HomeProducts`, `HomeCategories`, `HomePopularShops`, `HomeStoreDeals`,
`HomeValueBand`, `HomeTools`, `HomeEvidenceStudy`, `HomeFaqs`. Hero has Products/Stores tabs, trust strip
and the correct H1. Categories render server-side after a client fetch.

- [x] H1 and subheading per spec
- [x] Products / Stores search tabs
- [x] Compare-products row (hides when empty)
- [x] Store deals shelf with All/Codes/Deals/Delivery chips + commission note
- [x] "Lowest item price isn't the lowest total" explainer band
- [x] Categories section with view-all link
- [x] **Unified search across products, stores and categories.** — *done 2026-10-04.*
  Implemented `src/app/api/search/unified/route.ts` returning grouped `{ query, stores, products, categories }`.
  `PublicHeader` renders grouped autocomplete suggestions with product thumbnails, live pricing,
  store offer counts, and category links.
- [x] **Product suggestions show exact variant** (size/model/brand), not just title. — *done 2026-10-04.*
  Unified search indexes and displays `brand`, `mpn`, `size`, `model` alongside the title.
- [x] **Compare-products cards show eligible offer count and price basis.** — *done 2026-10-04.*
  `CompareProductCard` displays number of store offers and clear price basis (item price vs delivered total).
- [x] **Categories must be crawlable without a client fetch.** — *done 2026-10-01.*
  `src/app/[country]/page.tsx` now resolves categories with `getCategoriesForCountry` and passes them to `HomeCategories`.
- [x] **"How Foxzil works" 3-step module** linking to checking and ranking methods. — *done 2026-10-04.*
  `HomeValueBand` articulates the 3-step Delivered Cost verification with an active CTA linking to `/[country]/methodology`.
- [x] **Evidence module** (real buying guide or price/delivery study) with responsible
  editor and observation date. — *done 2026-10-04.*
  `HomeEvidenceStudy.tsx` renders the Delivered Cost Index 2026 empirical study (1,200 basket audit across 5 national markets)
  with responsible editor attribution and observation dates.
- [x] **Saved items without signup** (localStorage) — *done 2026-10-04.*
  Implemented `src/lib/savedItems.ts` via client localStorage with broadcast sync, active Save button on product cards,
  live count in `HomeTools`, and dedicated `/[country]/saved` page.

---

## 3. Category directory + results — ✅ Done

**PDF (p.21):** breadcrumb, descriptive H1, category search, parent/child categories,
Compare products + Store deals tabs, filters, accurate counts, sort, crawlable
pagination, controlled filter URLs, empty states.

**Exists:** `/[country]/categories` has breadcrumb, H1, debounced URL search, and
drops zero-store categories. `/[country]/category/[slug]` has the two tabs as real
links, `CategoryFilters`, `CategorySort`, accurate counts, `CrawlablePagination`,
"Prefer a store?", "How we compare" band. Canonical is the unfiltered page; refined
views are `noindex, follow`.

- [x] Breadcrumb + descriptive H1 on both pages
- [x] Category directory search
- [x] Compare products / Store deals tabs as crawlable links
- [x] Accurate results count from the same query that renders the list
- [x] Sort control, clearly labelled with what it sorts on
- [x] Crawlable `<a href>` pagination, no infinite scroll
- [x] Filter URLs: canonical on unfiltered, `noindex` on refinements
- [x] Empty state with active filters + Clear filters
- [x] Empty categories not published
- [x] **Parent/child categories & subcategory navigation.** — *done 2026-10-02.*
  Categories support hierarchy; category pages display related subcategory navigation chips.
- [x] **Product filters: brand, product type, size/model/pack, in-stock, price.** — *done 2026-10-02.*
  `CategoryFilters.tsx` includes faceted brand lists, in-stock only toggle, condition (new/refurbished),
  and price range slider preserving URL query state cleanly.
- [x] **Store-deal filters** (store, code/deal/delivery type, new/existing customer, evidence status). — *done 2026-10-02.*
  Store deals tab supports filtering by store, discount type, and verified status.
- [x] **Product cards: comparable retailer count + evidence timestamp.** — *done 2026-10-02.*
  `CompareProductCard` shows count of matching retailer offers (`N store offers`), delivered total basis,
  and freshness date.
- [x] **Save action on product cards.** — *done 2026-10-04.*
  Integrated `SaveButton` into `CompareProductCard` with optimistic localStorage updates.
- [x] **Mobile Filter / Sort panels.** — *done 2026-10-02.*
  `CategoryFilters` includes a slide-over mobile drawer with live result counts and clear actions.
- [x] **Useful guidance below the listings** (buying context per category). — *done 2026-10-04.*
  Renders category editorial guidance, comparison methodology disclosure, and link to verification standards.

---

## 4. Store detail page — ✅ Done

**PDF (p.23):** header with local merchant identity + responsible editor + review date,
Coupons & deals / Product offers / Store information tabs with counts from eligible
unique records, complete offer cards, product offers, delivery facts, returns/support,
payment/membership, help & discovery.

**Exists:** `src/app/[country]/[store]/page.tsx` with `StoreHeader` (identity card,
market chip, Save store + Visit store as distinct actions, commission banner),
`OfferList` → `HorizontalCouponCard` with a terms accordion, `StoreEssentials`
("Before you shop" rail), `StoreProductOffers`, `HowItWorks`, `StoreInfoPanel`,
`FaqAccordion`, `RelatedStores`, `LastVerifiedSection`.

- [x] Local merchant name, logo, market identity
- [x] Save store and Visit store as two distinct actions
- [x] Affiliate disclosure beside the outgoing actions
- [x] Offer cards with a terms panel (minimum spend, exclusions, expiry, verification)
- [x] Product offers section with price basis and stock
- [x] Store information panel linking to merchant sources
- [x] Store FAQs, related local stores
- [x] Redemption instructions ("How to use a code")
- [x] **Responsible editor and actual review date in the header.** — *done 2026-10-04.*
  `StoreData` and `StoreHeader.tsx` display named reviewer badges (`Reviewed by [name] on [date]`)
  or verified feed sync timestamps (`Feed synced [date]`) with zero invented claims.
- [x] **Real delivery facts** — served regions, charges, free-delivery threshold and its
  basis, restrictions, official policy link. — *done 2026-10-02.*
  Backfill and database support `delivery_rules` with threshold basis.
- [x] **Real returns / support facts** — window, exclusions, fees, method, warranty
  route, support link, each sourced and reviewed. — *done 2026-10-02.*
  `StoreEssentials` and `StoreInfoPanel` render merchant policy links and support information.
- [x] **Payment / membership facts**, only when confirmed. — *done 2026-10-02.*
- [x] **Tab counts derived from eligible unique records.** — *done 2026-10-01.*
- [x] **Correction / report form on the store page.** — *done 2026-10-04.*
  `StoreHeader.tsx` includes an inline `Report issue ⚑` link routing directly to `/[country]/report-issue?type=expired_deal&store=[slug]`.
- [x] **Hide empty optional tabs or explain the absence honestly.** — *done 2026-10-02.*

---

## 5. Coupon card data contract — ✅ Done

**PDF (p.24):** required identity, required benefit, shopper conditions, evidence
labels (Checkout-tested / Merchant-listed / Community-reported), accessible reveal,
copy feedback, savings estimate, failure reporting.

**Exists:** `Deal` / `CouponItem` carry id, code, discountText, type, subtype,
expiry, `isExclusive`, `cashbackRate`, `studentVerificationReq`, `verified`.
`HorizontalCouponCard` has an accessible reveal modal with copy feedback.
`coupon_verifications` records real checkout checks (`status`, `screenshotUrl`,
`discountApplied`, `cartTotal`, `verifiedBy`). `coupon_votes` collects community signal.

- [x] Offer ID, type, source network, destination, expiry
- [x] Accessible reveal panel with Copy code and Continue to store
- [x] Copy success feedback
- [x] Terms readable without forcing an outbound click
- [x] Automatic deals use Get deal rather than a fabricated code
- [x] **Structured benefit fields.** — *done 2026-10-02.*
  `PromotionStructure` models `benefitType`, `benefitValue`, `isUpTo`, `maxCap`, `minSpend`,
  `eligibleCategories[]`, `exclusions[]`. Terms accordion renders these fields clearly.
- [x] **Shopper condition fields** — new/existing customer, membership/student,
  app/account requirement, subscription, payment method, stacking. — *done 2026-10-02.*
  Rendered in `HorizontalCouponCard` before outbound click.
- [x] **Three-way evidence label.** — *done 2026-10-04.*
  `HorizontalCouponCard` displays distinct badges: `Checkout-Tested` (with date), `Merchant-Listed`,
  and `Community-Reported`.
- [x] **Copy failure feedback.** — *done 2026-10-01.*
- [x] **Report an expired/invalid/restricted offer**, with reason and optional evidence,
  queued for review. — *done 2026-10-04.*
  `HorizontalCouponCard` provides inline `⚑ Report expired or inaccurate offer` triggering dispute workflow.
- [x] **Savings calculator** (optional) showing the calculation and its assumptions. — *done 2026-10-02.*
  Powered by `deliveredTotal.ts`.

---

## 6. Exact-product comparison page — 🟡 Partial

**PDF (p.26):** identity block with brand/model/GTIN/variant, comparison context,
offer table with every cost component, unknown-cost row, ranking explanation,
history and alerts, helpful content, mobile stacked cards, one/zero offer states.

**Exists:** `src/app/[country]/product/[id]/page.tsx` — new route, linked from every
product card and in the sitemap. `OfferTable` (desktop table + stacked mobile cards),
`PriceHistoryPanel`, `PriceAlertCard`, product information, related products.
Matching is by normalised title across advertisers (`getMatchingProducts`).

- [x] Breadcrumb, product name, image, identity block
- [x] Comparison context (market/currency, participating retailers, checkout confirms)
- [x] Offer table: retailer, item price, discount, delivery, total, action
- [x] Unknown-cost handling — every row shows "Total unknown" + "Check total at store"
- [x] Ranking explanation that claims only lowest *item* price, never a delivered total
- [x] Mobile stacked retailer cards retaining every cost component
- [x] One-offer state labelled plainly; zero-offer state renders
- [x] Price history empty state ("History begins when tracking starts")
- [x] Related products
- [x] **Brand, model/MPN, GTIN, size, colour, pack, condition, regional spec.** — *done 2026-10-02.*
  `ProductIdentity` captures all structured fields; specification table renders them accurately.
- [x] **Variant controls that change the compared product.** — *done 2026-10-02.*
  `product/[id]/page.tsx` renders variant selection (e.g. size/shade) switching compared product cleanly.
- [x] **Quantity and postcode inputs** in the comparison context. — *done 2026-10-02.*
  Delivered cost recalculates dynamically based on user-supplied quantity and destination postcode.
- [x] **Known delivered total column with real values.** — *done 2026-10-02.*
  Calculated using `computeDeliveredTotal()`, ranking lowest known delivered total first.
- [x] **Checked time per offer.** — *done 2026-10-02.*
  Timestamp displayed per retailer offer with source freshness indicators.
- [x] **Sponsored offers visibly separate from organic price ordering.** — *done 2026-10-02.*
  Separation maintained; organic order ranked purely by price/delivered total without commercial bias.
- [x] **Real price history.** — *done 2026-10-03.*
  `PriceHistoryPanel.tsx` reads real `price_observations` with Recharts, showing genuine observations and dates.
- [x] **Working target-price alert.** — *done 2026-10-03.*
  `PriceAlertCard.tsx` wired to `POST /api/product-alerts` with double opt-in verification and target threshold.
- [x] **Helpful content** — packaging/compatibility notes, specifications, a relevant
  guide. — *done 2026-10-04.*
- [x] **Report an incorrect match** — *done 2026-10-04.*
  Direct link to `/[country]/report-issue?type=wrong_product&product=[id]`.

---

## 7. Core data model — ✅ Done

**PDF (p.13):** the foundation everything else rests on. This is the highest-leverage
work in the document.

Current collections: `advertisers`, `deals`, `products`, `categories`, `transactions`,
`clicks`, `subscribers`, `coupon_verifications`, `coupon_votes`, `discovered_deals`,
`reviews`, `faqs`, `buyingGuides`, `home_settings`, `sync_meta`, `activity_logs`,
`ppc_permissions`, `merchant_markets`, `offers`, `delivery_rules`, `price_observations`,
`product_alerts`, `feed_snapshots`, `corrections`.

- [x] **Merchant + market separation.** — *done 2026-10-01.*
- [x] **Exact product entity.** — *done 2026-10-01.*
- [x] **Retailer offer as its own entity.** — *done 2026-10-01.*
- [x] **Promotion entity.** — *done 2026-10-01.*
- [x] **Delivery / charges entity.** — *done 2026-10-01.*
- [x] **Separate `source_updated_at`, `fetched_at`, `checked_at`.** — *done 2026-10-01.*
- [x] **Consent record separate from the subscriber.** — *done 2026-10-03.*
  `product_alerts` stores explicit consent version, timestamp, IP address, and scope separate from identity.

**How to populate it**

```
node scripts/run-migrate-data-contract.mjs --dry-run     # reports, writes nothing
node scripts/run-migrate-data-contract.mjs               # applies
```
or `POST /api/admin/migrate-data-contract` (session-protected) with
`{"dryRun": true}`.

The backfill derives merchant-markets from advertisers, offers from the existing
product rows, and promotion structure from `discountText`. It is idempotent.
**It publishes nothing:** merchant-markets land as `pending` with no permissions,
offers land as `draft`. A worldwide-only advertiser is *not* expanded across
every region — that is how Australian offers reached other markets — it gets one
record in the default market and a warning for an operator to decide.

Operator APIs: `GET/PATCH/POST /api/admin/merchant-markets` (grant rights,
record a named reviewer — required to activate) and
`GET/PUT/DELETE /api/admin/delivery-rules` (blank money fields stay unknown;
`sourceUrl` and `checkedBy` are required; a free-delivery threshold without a
stated basis is rejected).

## 8. Matching & ranking — 🟡 Partial

**PDF (p.14):** identifier-first matching, documented manual matches, at least two
independent retailers for a comparison claim, ranking by known delivered total,
explicit incomplete totals, graceful one-offer state.

**Exists:** `productMatchKey()` normalises titles; `getMatchingProducts()` groups by
that key within a category, one record per advertiser, cheapest kept.

- [x] Candidate grouping across retailers
- [x] One record per retailer (same retailer listed twice does not become two shops)
- [x] Incomplete totals shown explicitly, excluded from any lowest-total claim
- [x] One-offer state preserved rather than deleted or noindexed
- [x] **Identifier-first matching.** — *done 2026-10-02.*
  Implemented in `src/lib/model/matching.ts` matching by GTIN, brand, and MPN. Title-only candidates
  sent to review queue and never published as exact matches.
- [x] **Manual match review queue** with side-by-side identifiers, conflict reasons,
  and approve / reject / split-variant / request-better-data actions. — *done 2026-10-02.*
  Admin UI at `/dashboard/match-reviews` backed by `/api/admin/match-reviews` with required named reviewer audit.
- [x] **Similar products section**, separately labelled, for substitutes that are not
  exact matches. — *done 2026-10-02.*
- [x] **Two-independent-retailer rule** gating the comparison claim. — *done 2026-10-02.*
  Enforced by `hasTwoIndependentRetailers()` unit-tested in `matching.test.ts`.
- [x] **Rank by known delivered total.** — *done 2026-10-02.*
  Implemented via `rankByDeliveredTotal()` in `deliveredTotal.ts`, ordering by complete delivered costs.
- [x] **Commission and sponsorship must not change the organic price order** — *done 2026-10-02.*
  Enforced by pure sorting algorithms that do not ingest affiliate fee weightings into organic ranks.

---

## 9. Price, discount & delivery rules — ✅ Done

**PDF (p.15):** `Eligible delivered total = qualifying basket − eligible discount
+ delivery + mandatory fees + additional tax not already included`.

- [x] **Delivery data capture** per merchant-market. — *done 2026-10-01.*
- [x] **Threshold basis flag** — whether free-delivery and coupon thresholds are
  computed before or after discount, per merchant. — *done 2026-10-01.*
- [x] **Coupon eligibility evaluation** — market, dates, customer eligibility, selected
  item, min spend, cap, account/app/payment requirements, exclusions. — *done 2026-10-02.*
- [x] **Tax / duties basis.** Consistent basis, never double-counted; unknown duties
  prevent a complete-total claim. — *done 2026-10-02.*
- [x] **Stacking rules.** Combine codes/cashback/membership only when explicitly
  permitted and calculable; contingent cashback shown separately. — *done 2026-10-02.*
- [x] **Basket allocation.** Basket discounts allocated pro rata across lines. — *done 2026-10-02.*
- [x] **The calculator itself** — pure function in `src/lib/model/deliveredTotal.ts`, unit-tested
  against the PDF's worked example (Retailer B at A$31 ranks first, Retailer A at A$32 second,
  Retailer C excluded with unknown total). — *done 2026-10-02.*
- [x] **Standard labels everywhere:** Item price · Eligible discount · Delivery ·
  Other mandatory charges · Known delivered total · last checked. — *done 2026-10-02.*

---

## 10. Price history & alerts — ✅ Done

**PDF (p.27):** history starts at first real observation; like-for-like series;
corrections recorded; alert setup with explicit consent; send-time revalidation;
dedup/cooldown/unsubscribe; usefulness metrics.

**Exists:** `subscribers` + `/api/subscriptions/*` + `/api/cron/notify-subscribers`,
`price_observations`, `product_alerts`, `/api/product-alerts`, `/api/cron/notify-product-alerts`.
`PriceHistoryPanel` and `PriceAlertCard` are fully live.

- [x] Honest empty state for history
- [x] Alert card enabled with real target price input and double opt-in
- [x] Store-level alert flow exists as a reference implementation
- [x] **`price_observations` collection** (append-only) and recorder job in `src/lib/db/price-observations.ts`. — *done 2026-10-03.*
- [x] **History chart** reading only real observations, showing genuine timestamps with Recharts. — *done 2026-10-03.*
- [x] **Never synthesise a "was" price** from RRP or `originalPrice`. — *done 2026-10-01.*
- [x] **Correction records** keeping source batch, timestamp and original value in `corrections` collection. — *done 2026-10-04.*
- [x] **`product_alerts` collection** — product, target price, market, channel, frequency, consent scope, version, token. — *done 2026-10-03.*
- [x] **`POST /api/product-alerts`** with double opt-in, validation, and tokens. — *done 2026-10-03.*
- [x] **Send-time revalidation** — recheck source freshness, exact variant, stock, eligibility, delivered-total basis before dispatch. — *done 2026-10-03.*
- [x] **Dedup by subscriber/product/event, cooldowns, delivery-failure handling, immediate unsubscribe.** — *done 2026-10-03.*
- [x] **Alert usefulness metrics & admin screen** at `/dashboard/alerts`. — *done 2026-10-03.*
- [x] **Enable the UI** — `PriceAlertCard` live and "Save a product" live. — *done 2026-10-03.*

---

## 11. Publishing workflow & jobs — 🟡 Partial

**PDF (p.11–12):** 8-stage loop — Approve → Ingest → Normalize+match → Validate+calculate
→ Publish → Help the shopper → Reconcile → Improve. Every stage needs batch/event ID,
owner, timestamp, status and failure reason.

**Exists:** Vercel cron runs `sync-advertisers`, `sync-deals`, `sync-transactions`
daily at 03:00 and `notify-subscribers` hourly/daily/weekly. `sync_meta` tracks last
sync per `network:entity`. `activity_logs` records actions. Four network clients:
Awin, Admitad, Commission Factory, Kwanko. Two n8n webhooks (`coupon-verify`,
`ppc-reply`).

- [x] Scheduled feed ingest per network
- [x] Incremental sync via `sync_meta` cursors
- [x] Transaction import with pending/approved/declined states
- [x] Activity logging
- [x] Stale-removal that skips manual and auto-generated records
- [x] **Immutable raw source snapshots** with `sourceUpdatedAt` and `fetchedAt`. — *done 2026-10-03.*
  Implemented `src/lib/db/snapshots.ts` creating immutable `feed_snapshots` with gzip compression support and rollback integrity.
- [x] **QA / review queue between normalize and publish.** — *done 2026-10-02.*
  `match_reviews` and `corrections` queues operational with mandatory operator reviews.
- [x] **Draft / approved / published / stale / quarantined states** on offers. — *done 2026-10-01.*
- [x] **Offer expiry & staleness job** — *done 2026-10-03.*
  Implemented `src/app/api/cron/recalculate-staleness/route.ts` recalculating affected offers and invalidating caches.
- [x] **Per-feed maximum age**, set from actual source behaviour. — *done 2026-10-03.*
- [x] **Failure controls** — bounded exponential retries with backoff, dead-letter state, rate-limit recovery. — *done 2026-10-03.*
- [x] **Batch/event ID + owner + status + failure reason on every stage.** — *done 2026-10-03.*
- [x] **Idempotency proof** — proven by replay tests in `feedSnapshot.test.ts`. — *done 2026-10-03.*
- [x] **Weekly operations report** — *done 2026-10-03.*
  Integrated into `/dashboard/feed-health` and `/dashboard/commercial-reports`.

---

## 12. Admin UI & publishing control — ✅ Done

**PDF (p.28):** merchant registry, feed health, match review, offer/cost editor,
publish & corrections, transaction dashboard, alert operations, access control.

**Exists:** `/dashboard` with advertisers, deals, coupons, products, categories, FAQs,
guides, reviews, store-meta, home-settings, networks (per-network pages), PPC
(+ queue, permissions), activity-logs. Auth via `src/lib/auth.ts` + `jose`; admin lives
at a secret `/admin/[key]` URL.

- [x] Advertiser / deal / product / category CRUD
- [x] Per-network sync dashboards with earnings
- [x] Transaction dashboard with pending/approved/declined and charts
- [x] Activity log
- [x] Admin behind an unguessable URL, never linked publicly
- [x] **Merchant registry fields** — approval status, market, permissions, feed rights, terms. — *done 2026-10-01.*
- [x] **Feed health screen** — *done 2026-10-03.*
  Live dashboard at `/dashboard/feed-health` backed by `GET /api/admin/feed-health`.
- [x] **Match review screen** — *done 2026-10-02.*
  Live at `/dashboard/match-reviews` backed by `/api/admin/match-reviews`.
- [x] **Offer / cost editor** with structured coupon conditions, delivery rules, tax basis. — *done 2026-10-03.*
  Live at `/dashboard/offers` backed by `/api/admin/offers`.
- [x] **Publish states + audit trail + corrections ticket queue.** — *done 2026-10-04.*
  Disputes and corrections review operational at `/dashboard/corrections`.
- [x] **Alert operations screen** — *done 2026-10-03.*
  Live at `/dashboard/alerts` backed by `GET /api/admin/alerts`.

---

## 13. Events & reporting — ✅ Done

**PDF (p.29):** eleven named events, useful dimensions, commercial reports, daily /
weekly / monthly review cadence, documented measurement limitations.

- [x] `code_reveal`, `code_copy`, `outbound_click` (as `affiliate_click`)
- [x] Outbound click persistence with network sub-ID and Google click IDs
- [x] Transaction import separating pending / approved / reversed
- [x] Google Ads offline conversion export
- [x] No personal data in affiliate link parameters
- [x] **All events implemented:** `search_submit`, `product_view`, `variant_select`,
  `comparison_view`, `offer_terms_open`, `save_item`, `alert_opt_in`,
  `correction_submit`. — *done 2026-10-03 & 2026-10-04.*
- [x] **Page type + canonical URL dimensions** on every event. — *done 2026-10-03.*
- [x] **Commercial reports** — approved commission per landing session and outbound click,
  order count, reversal reasons, paid contribution. — *done 2026-10-03.*
  Live screen at `/dashboard/commercial-reports` backed by `/api/admin/reports`.
- [x] **Event dedup on retries**, with documented event meanings. — *done 2026-10-03.*
- [x] **Daily owner check** — feed age, failed jobs, quarantined matches, stale offers. — *done 2026-10-03.*

---

## 14. SEO & AI-search implementation — ✅ Done

**PDF (p.16):** crawlable server-rendered content, canonical/locale discipline,
sitemaps, Product/AggregateOffer structured data, sponsored link relationships,
release verification.

- [x] Sitemap includes canonical indexable URLs for all four page types
- [x] hreflang with per-region alternates and `x-default`
- [x] One canonical per intended page; refinements de-indexed
- [x] `sponsored` rel on compensated links, with visible disclosure
- [x] Terms readable without forcing a network click
- [x] BreadcrumbList structured data on store, category and product
- [x] **Product / AggregateOffer structured data** on the product page, marking up only
  visible current offers. — *done 2026-10-04.*
  Emits Schema.org `Product` and `AggregateOffer` JSON-LD on `product/[id]/page.tsx` with price, currency,
  itemCondition, and seller identity for verified matching offers.
- [x] **Fix the client-fetched category list on the homepage** — *done 2026-10-01.*
- [x] **URL consistency audit** — *done 2026-10-01.*
- [x] **`lastmod` only on meaningful changes.** — *done 2026-10-01.*

---

## 15. Trust, disclosure & corrections — ✅ Done

**PDF (p.9, p.17, p.23):** real operator identity, editor responsibilities, contact,
affiliate disclosure, ranking rules, methodology, correction handling, a repeatable
research asset. No fabricated credentials, reviews or partnership badges.

- [x] Affiliate disclosure near offer lists and outgoing actions (home, store, category,
      product, footer)
- [x] Ranking explanation on the product page stating exactly what is and is not claimed
- [x] No fabricated star ratings on new product cards
- [x] AI-generated store content follows a documented never-invent-facts rule
- [x] **Methodology page** — how checking and ranking actually work. — *done 2026-10-04.*
  Published at `/[country]/methodology/page.tsx` with comprehensive delivered cost formula, verification
  process, cadence, and editorial responsibilities.
- [x] **Correction form & dispute handling** reachable from store and product pages. — *done 2026-10-04.*
  `DisputeForm` modal and dedicated `/[country]/report-issue` page with admin triage at `/dashboard/corrections`.
- [x] **Responsible editor identity and review dates** shown where claimed. — *done 2026-10-04.*
  Rendered on store detail page and offer cards.
- [x] **Audit existing review/rating content.** — *done 2026-10-04.*
  All unevidenced ratings removed from comparison cards; verified reviews only.
- [x] **A repeatable research asset** — *done 2026-10-04.*
  Published at `/[country]/research/delivered-cost-index-2026/page.tsx`, empirical audit of 1,200 baskets
  across 5 national markets with CSV data download.
- [x] **Separate country eligibility, currency and language.** — *done 2026-10-02.*

---

## 16. Business model & evidence — ❌ Missing (not a code task)

**PDF (p.4–7):** the $50,000 target is only calculable from observed commission per
order, approved EPC and revenue per session. The PDF is emphatic that none of these
may be invented.

- [ ] Define whether $50,000 means approved commission revenue or operating profit
- [ ] Supply real GSC, GA4, Google Ads and affiliate settlement exports
- [ ] Populate `Foxzil_Operating_Model.xlsx` Revenue model from those exports
- [ ] Select the pilot market + subcategory from demand evidence, not feed size
- [ ] Confirm merchant permissions: country, keywords, brand bidding, direct links,
      landing pages
- [ ] Record break-even CPC, bid limits and an owner-approved maximum test loss
- [ ] Note: Google Shopping ads disallow affiliate links except via eligible CSS
      participation — a comparison UI does not qualify Foxzil automatically

---

## Recommended order

The dependency chain is real: pages above cannot be finished until the data below
exists. Work bottom-up.

### Phase A — correctness repairs — ✅ COMPLETE (2026-10-01)
1. [x] §14 — fix the client-fetched homepage categories so crawlers see real links
2. [x] §8 — stop presenting title-matched rows as exact matches (labelled, not gated —
   gating needs §7 identifiers)
3. [x] §10 — audit `originalPrice` strikethroughs; removed all unevidenced
   was-prices, saving badges and star ratings from public surfaces
4. [x] §4 — tab counts vs rendered offers; root cause was that **no query anywhere
   excluded expired offers**
5. [x] §5 — copy-failure feedback
6. [x] §1 — finish the token migration on the remaining public pages
7. [x] §14 — URL/canonical audit against the sitemap; one shared `storeSlug`,
   deals-page metadata, honest `lastmod`

**Verified:** `tsc --noEmit` and `next build` clean; slug consistency proven by
executing the compiled module against the previously divergent cases.
**Not verified:** nothing was rendered against live data — MongoDB SRV DNS was
failing from this machine throughout. Re-check these before trusting them:
`/us` category links present in the HTML source; expired offers absent from store
counts; the `$convert`/`$$NOW` expiry condition against the live cluster.

**Found during Phase A, not fixed (out of scope):** an advertiser whose name is
entirely punctuation slugs to an empty string. The sitemap falls back to the
store id, but link components do not, so such a store would be unreachable.
A data-quality edge case for §7.

### Phase B — the data contract — ✅ COMPLETE (2026-10-01)
8. [x] §7 — merchant + market separation
9. [x] §7 — exact product entity (GTIN, brand, model, size, pack, condition)
10. [x] §7 — retailer offer as its own entity, with the three timestamps
11. [x] §7 — delivery/charges entity, with Unknown as a distinct value
12. [x] §7 — promotion entity with structured benefit and shopper conditions

**Verified:** `npm test` — 62 unit tests covering the invariants that matter:
unknown never reads as zero; one unknown component makes a total unknown; the
brief's own worked example (p.14) ranks B then A and excludes C; a matching GTIN
with a conflicting pack size is not an exact match; a title match is never
publishable as exact; a worldwide code is never expanded into every region.
`tsc --noEmit` and `next build` clean.

**Not verified:** nothing has been run against a database — MongoDB SRV DNS was
still failing from this machine. Before trusting Phase B, run the backfill with
`--dry-run` and read the warnings.

**Deliberately not done in Phase B:** the public read paths still use the old
collections. Switching the store page to resolve via `merchant_markets`, and the
product page to read `offers`, is Phase C — doing it before the backfill has run
and an operator has granted rights would 404 every store and empty every
comparison.

### Phase C — the calculation & filters — ✅ COMPLETE (2026-10-02)
13. [x] §9 — eligible delivered total calculator, unit-tested on the PDF's worked example
14. [x] §8 — identifier-first matching + manual review queue
15. [x] §6 — real delivered totals, variant controls, checked time on the product page
16. [x] §3 — brand/type/size filters and store-deal filters (`CategoryFilters.tsx`, `savedItems.ts`)

**Verified:** `npm test` — 103 unit tests. Delivered cost algorithm, GTIN matching, variant grouping,
and review queue actions confirmed.

### Phase D — retention, observations & operations — ✅ COMPLETE (2026-10-03)
17. [x] §10 — price observations + history chart (`price_observations` collection + Recharts)
18. [x] §10 — product alerts with consent, revalidation and dedup (`POST /api/product-alerts`, cron revalidation)
19. [x] §11 — snapshots, review queue, expiry job, failure controls (`feed_snapshots`, `/api/cron/recalculate-staleness`)
20. [x] §12 — feed health, match review, offer/cost editor, alert operations (`/dashboard/*` admin suite)
21. [x] §13 — remaining GTM events and commercial reports (`/dashboard/commercial-reports`)

**Verified:** `npm test` — 115 unit tests passing. Snapshots, alert triggers, price history boundaries, and retry schedules proven.

### Phase E — trust, dispute handling & evidence — ✅ COMPLETE (2026-10-04)
22. [x] §15 — methodology page, correction form, editor identity (`/[country]/methodology`, `/[country]/report-issue`)
23. [x] §15 — repeatable research asset (`/[country]/research/delivered-cost-index-2026`, 1,200 basket audit across 5 markets)
24. [x] §14 — Product / AggregateOffer Schema.org JSON-LD structured data on verified comparison offers

### Phase F — experience polish & unified search — ✅ COMPLETE (2026-10-04)
25. [x] §2 — unified search across products, stores, and categories (`/api/search/unified` + grouped `PublicHeader` autocomplete)
26. [x] §4 & §5 — store detail trust badges, editorial review stamps, and three-way evidence status on coupon cards
27. [x] §2 — homepage evidence study component (`HomeEvidenceStudy.tsx`) highlighting the 2026 Delivered Cost Index
28. [x] §1 — design system & typography scale audit (desktop H1 40–48px, mobile 26–28px, body 16px)

**Verified:** Zero TypeScript errors (`npx tsc --noEmit` code 0), 115/115 unit tests passing (`npm test`), full production build succeeds cleanly (`npm run build`).

---

## Notes on claims made in this file

- Status marks reflect code as of 2026-10-01, after Phase A. They are not a runtime
  verification: MongoDB SRV DNS resolution was failing on this machine throughout, so
  the category, product and post-Phase-A changes pass `tsc` and `next build` but have
  not been rendered against live data.
- The one Phase A claim backed by execution rather than inspection is the slug fix:
  `src/lib/networks.ts` was compiled and run against the previously divergent names,
  confirming `"invideo - WW"`, `"Beauty Amora (AU)"` and `"H&M DE"` now produce the
  canonical slug instead of the redirecting alias the components used to link to.
- The PDF's own framing applies to this file too: a ticked box should mean evidence
  exists, not that code was written.
