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
| 2 | Homepage | p.18–19 | 🟡 Partial |
| 3 | Category directory + results | p.20–21 | 🟡 Partial |
| 4 | Store detail page | p.22–23 | 🟡 Partial |
| 5 | Coupon card data contract | p.24 | 🟡 Partial |
| 6 | Exact-product comparison page | p.25–26 | 🟡 Partial |
| 7 | Core data model | p.13 | 🟡 Contract defined, not populated |
| 8 | Matching & ranking | p.14 | 🟡 Partial |
| 9 | Price / discount / delivery rules | p.15 | ❌ Missing |
| 10 | Price history & alerts | p.27 | ❌ Missing |
| 11 | Publishing workflow & jobs | p.11–12 | 🟡 Partial |
| 12 | Admin UI & publishing control | p.28 | 🟡 Partial |
| 13 | Events & reporting | p.29 | 🟡 Partial |
| 14 | SEO & AI-search implementation | p.16 | 🟡 Partial |
| 15 | Trust, disclosure & corrections | p.9, p.17 | 🟡 Partial |
| 16 | Business model & evidence | p.4–7 | ❌ Missing (not code) |

**The single biggest blocker:** there is no delivery-cost or mandatory-charges data
anywhere in the system. The PDF's core product promise — "known delivered total" —
cannot be computed for any retailer. Everything in §9 depends on fixing that, and
§6 and §8 are capped until it is. Do §7 and §9 before polishing any page.

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
- [ ] **Type scale pass** — PDF wants body 16–18px, secondary 14px, desktop H1 40–48px,
  mobile 28–32px. Current H1s are ~30–36px desktop.
  *Done means:* H1 measures 40–48px at ≥1024px and 28–32px at 375px.
- [ ] **Accessibility pass** — keyboard focus, accessible names, contrast.
  *Done means:* every interactive control reachable by Tab with a visible focus ring;
  axe-core reports no serious/critical violations on home, category, store, product.
- [ ] **Define the missing UI states** the PDF names explicitly: stale data, failed copy,
  failed alert, unavailable retailer. Loading / no-result / no-valid-offers exist.

---

## 2. Homepage — 🟡 Partial

**PDF (p.19):** H1 "Compare the price. Check the deal.", unified search accepting
product/brand/store, grouped suggestions, compare-products row, store deals,
crawlable categories, "How Foxzil works" 3 steps, real evidence module, saved+alerts.

**Exists:** `src/app/[country]/AdvertisersClient.tsx` composes `HomeHero`,
`HomeProducts`, `HomeCategories`, `HomePopularShops`, `HomeStoreDeals`,
`HomeValueBand`, `HomeTools`, `HomeFaqs`. Hero has Products/Stores tabs, trust strip
and the correct H1. Categories render server-side after a client fetch.

- [x] H1 and subheading per spec
- [x] Products / Stores search tabs
- [x] Compare-products row (hides when empty)
- [x] Store deals shelf with All/Codes/Deals/Delivery chips + commission note
- [x] "Lowest item price isn't the lowest total" explainer band
- [x] Categories section with view-all link
- [ ] **Unified search across products, stores and brands.**
  Today `PublicHeader` only autocompletes advertisers (`/api/advertisers`). The hero's
  Products tab filters the product row server-side but has no suggestions.
  *Done means:* one search endpoint returns grouped `{products, stores, categories}`
  with market context; suggestions show product image + exact size/model.
- [ ] **Product suggestions show exact variant** (size/model), not just title.
  Blocked by §7 (no size/pack/variant fields on `Product`).
- [ ] **Compare-products cards show eligible offer count and price basis.**
  Cards currently show one retailer's price. Count needs §8 matching.
- [x] **Categories must be crawlable without a client fetch.** — *done 2026-10-01.*
  `src/app/[country]/page.tsx` now resolves categories with
  `getCategoriesForCountry` and passes them to `HomeCategories` as props; the
  effect and its loading state are gone. Zero-store categories are filtered out,
  and `homeSettings.categories` remains the fallback.
  ⚠️ Not yet confirmed by `curl` — MongoDB was unreachable from this machine.
- [ ] **"How Foxzil works" 3-step module** linking to checking and ranking methods.
  `HomeValueBand` is close but is about cost components, not the 3 steps.
- [ ] **Evidence module** (real buying guide or price/delivery study) with responsible
  editor and observation date. PDF says omit until real material exists — so this
  stays unticked until §15 produces a study.
- [ ] **Saved items without signup** (localStorage) — `HomeTools` currently renders
  "Save a product" as a disabled Coming soon card.

---

## 3. Category directory + results — 🟡 Partial

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
- [ ] **Parent/child categories.** `Category` has no parent field, so subcategory tiles
  (the mock's Skincare/Makeup/Fragrance/Haircare row) cannot render.
  *Done means:* `Category` gains `parentSlug`; directory nests; category page shows
  its children.
- [ ] **Product filters: brand, product type, size/model/pack.**
  Only stock and price exist because those are the only structured fields.
  Blocked by §7.
- [ ] **Store-deal filters** (store, code/deal/delivery type, new/existing customer,
  membership/app eligibility, evidence status). None exist on the deals tab.
  Partially blocked by §5 (customer type, evidence status not modelled).
- [ ] **Product cards: comparable retailer count + evidence timestamp.**
  `CompareProductCard` shows neither. Blocked by §8 and §7.
- [ ] **Save action on product cards.** Blocked by saved-items (§2).
- [ ] **Mobile Filter / Sort panels.** Filters currently collapse out of the layout on
  the deals tab and stack above results on mobile; the PDF wants accessible
  slide-over panels with live counts.
- [ ] **Useful guidance below the listings** (buying context per category).
  `category.description` renders, but there is no per-category guide module.

---

## 4. Store detail page — 🟡 Partial

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
- [ ] **Responsible editor and actual review date in the header.**
  Not modelled anywhere. PDF is explicit that a date must not imply checking that
  did not happen.
  *Done means:* `Advertiser` gains `reviewedBy` + `reviewedAt`; header renders them;
  they are only written when an editor actually reviews.
- [ ] **Real delivery facts** — served regions, charges, free-delivery threshold and its
  basis, restrictions, official policy link. `StoreEssentials` currently links every
  row to the merchant homepage because no delivery data exists. Blocked by §9.
- [ ] **Real returns / support facts** — window, exclusions, fees, method, warranty
  route, support link, each sourced and reviewed.
- [ ] **Payment / membership facts**, only when confirmed.
- [x] **Tab counts derived from eligible unique records.** — *done 2026-10-01.*
  Audit found the real defect was upstream: **nothing anywhere filtered expired
  offers.** `buildFilter` in `src/lib/db/deals.ts` had no end-date condition, and
  the advertiser `$lookup` named `activeDeals` counted expired rows, so every
  "N offers" badge on every store card was inflated.
  Fixed by `NOT_EXPIRED` in `src/lib/expiry.ts`, applied in `buildFilter` and in
  all three advertiser deal-count paths. `DealQuery.includeExpired` opts out;
  `/api/deals` accepts `includeExpired=true` and the admin deals/coupons screens
  pass it so operators can still find ended offers to clean up.
  Store-page counts already derived from the rendered arrays, and those arrays
  now exclude expired offers, so count and cards agree by construction.
  ⚠️ `NOT_EXPIRED` uses `$convert` + `$$NOW` (MongoDB 4.2+). Not yet run against
  the live cluster.
- [ ] **Correction / report form on the store page.** Only mentioned on `/about`.
- [ ] **Hide empty optional tabs or explain the absence honestly.**

---

## 5. Coupon card data contract — 🟡 Partial

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
- [ ] **Structured benefit fields.** `discountText` is a free-text label ("20% OFF").
  PDF wants percentage *or* amount, "up to" flag, maximum cap, minimum qualifying
  basket, eligible categories/items, exclusions, and gift/delivery benefit
  distinguished from cash discount — all as data, not prose.
  *Done means:* `Deal` gains `benefitType`, `benefitValue`, `isUpTo`, `maxCap`,
  `minSpend`, `eligibleCategories[]`, `exclusions[]`; the terms panel renders them
  instead of "Read current merchant terms".
- [ ] **Shopper condition fields** — new/existing customer, membership/student,
  app/account requirement, subscription, payment method, stacking. `subtype` and
  `studentVerificationReq` cover a sliver. Decisive restrictions must appear on the
  card *before* the outbound click.
- [ ] **Three-way evidence label.** The card shows a binary `verified`. PDF wants
  Checkout-tested / Merchant-listed / Community-reported as distinct labels.
  *Done means:* `Deal.evidenceStatus` enum derived from `coupon_verifications` +
  feed origin + `coupon_votes`; the label renders on the card.
- [x] **Copy failure feedback.** — *done 2026-10-01.*
  `HorizontalCouponCard` and `CouponCard` now set a `copyFailed` state instead of
  swallowing the rejection, and show `cards.copyFailed` (added in all five
  dictionaries) with `role="alert"`. The code stays on screen to select by hand.
  The modal heading no longer reads "Coupon Code Copied!" when nothing was
  copied, and `CouponCard`'s click-only `<div>` is now a focusable `<button>`.
- [ ] **Report an expired/invalid/restricted offer**, with reason and optional evidence,
  queued for review. No report control exists.
- [ ] **Savings calculator** (optional) showing the calculation and its assumptions.
  Blocked by §9.

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
- [ ] **Brand, model/MPN, GTIN, size, colour, pack, condition, regional spec.**
  The spec table currently prints "Not recorded" for size/pack/condition because
  `Product` has none of these. Blocked by §7.
- [ ] **Variant controls that change the compared product.**
  The mock's 30ml/60ml switcher. Blocked by §7.
- [ ] **Quantity and postcode inputs** in the comparison context. Blocked by §9.
- [ ] **Known delivered total column with real values.** Blocked by §9.
- [ ] **Checked time per offer.** `Product` has no `checkedAt`. Blocked by §7.
- [ ] **Sponsored offers visibly separate from organic price ordering.**
  No sponsorship concept exists yet; add before any paid placement ships.
  *(Related Phase A work done: every row now carries a `matchBasis` chip —
  "This listing" vs "Title match" — so identity provenance is visible per row.)*
- [ ] **Real price history.** Blocked by §10.
- [ ] **Working target-price alert.** Blocked by §10 — card renders disabled.
- [ ] **Helpful content** — packaging/compatibility notes, specifications, a relevant
  guide. `buyingGuides` exists in the DB but has no public route.
- [ ] **Report an incorrect match** — the link currently points at `/about`.

---

## 7. Core data model — 🟡 Contract defined, not yet populated

**PDF (p.13):** the foundation everything else rests on. This is the highest-leverage
work in the document.

Current collections: `advertisers`, `deals`, `products`, `categories`, `transactions`,
`clicks`, `subscribers`, `coupon_verifications`, `coupon_votes`, `discovered_deals`,
`reviews`, `faqs`, `buyingGuides`, `home_settings`, `sync_meta`, `activity_logs`,
`ppc_permissions`.

**Added 2026-10-01 (Phase B):** `merchant_markets`, `offers`, `delivery_rules`,
plus identity fields on `products` and promotion structure on `deals`.
Models in `src/lib/model/`, persistence in `src/lib/db/`, backfill in
`src/lib/migrations/backfill-data-contract.ts`. 62 unit tests (`npm test`).

**The keystone:** `src/lib/model/known.ts` defines `Known<T>` — a tagged union
where a value is either `{known: true, value}` or `{known: false, reason}`.
Every money field on a delivery rule, offer and promotion benefit uses it, so
`?? 0` on a missing charge is not expressible. `sumKnown` propagates unknown:
one unknown component makes the whole total unknown, which is what keeps an item
price from being presented as a delivered total.

- [x] **Merchant + market separation.** — *done 2026-10-01.*
  `merchant_markets`, one document per `(merchant, market)`, keyed
  `<network>:<merchantId>:<MARKET>`. Carries the **stored** canonical slug (so a
  rename cannot move a page), per-market currency, approved domains, feed source
  IDs, `ProgrammePermissions`, commission terms, policy URLs, status and review
  stamps. Unique index on `(market, slug)` — the lookup a store page performs,
  replacing name-slugging. `canPublish()` gates on confirmed rights.
  ⚠️ The public store page still resolves via `getAdvertiserBySlug`. Switching
  that read path is Phase C; doing it before the backfill has run and rights are
  granted would 404 every store.
- [x] **Exact product entity.** — *done 2026-10-01.*
  `ProductIdentity` adds GTIN, brand, MPN, size, colour, flavour, pack count,
  condition, regional spec, market, an `identifiers[]` array and `matchAudit`.
  `Product` extends it; all fields optional because a backfill cannot invent
  them. `identifiersAgree()` requires a shared strong identifier **and** no
  contradiction on variant fields — a matching GTIN with a different pack size
  returns a conflict, per the brief.
- [x] **Retailer offer as its own entity.** — *done 2026-10-01.*
  `offers`, keyed `<merchantMarketId>:<sourceItemId>`, with `Known<number>` item
  price, stock state, condition, destination URL, eligibility, source batch, and
  `draft|current|stale|quarantined` status. Indexed on `(productId, status)`.
  `upsertOffers` is idempotent and only writes `status`/`statusReason`/`checkedAt`
  on insert, so an ingest cannot republish something a reviewer quarantined.
- [x] **Promotion entity.** — *done 2026-10-01.*
  `PromotionStructure` on the deal record: structured benefit (kind, value,
  `isUpTo`, cap), conditions (min spend + its basis, eligible categories and
  products, exclusions, customer type, membership/app/account/subscription,
  payment method, stacking), IANA timezone, and the three-way `EvidenceStatus`
  (checkout-tested / merchant-listed / community-reported). `parseDiscountText`
  seeds the benefit from the existing `discountText`, conservatively — anything
  it cannot read stays unknown.
- [x] **Delivery / charges entity.** — *done 2026-10-01.*
  `delivery_rules` with destination zone (market, regions, postcode prefixes),
  service level, `Known<number>` charge, free threshold **and its
  before/after-discount basis**, mandatory fees, tax-included flag, restrictions,
  source URL and check time. `deliveryFor()` returns unknown when the basis is
  unknown, because the same basket gives opposite answers under each — proven by
  test. **Unknown is a distinct value, never zero.**
- [x] **Separate `source_updated_at`, `fetched_at`, `checked_at`.** — *done 2026-10-01.*
  On offers and on deals. `ageStatus()` measures freshness from the source
  stamp, falling back to fetch — never from render time — and an offer with
  neither is stale, not fresh. The backfill maps the old `syncedAt` to
  `fetchedAt` and leaves `checkedAt` null, because nobody has checked it.
- [ ] **Consent record separate from the subscriber.** Still outstanding.
  `SubscriberDoc` has `consentAt` but no consent scope or version. Belongs with
  the product-alert work in §10.

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
- [ ] **Identifier-first matching.** Still outstanding — needs §7's identifiers.
  **Phase A mitigation shipped 2026-10-01:** the page no longer *claims* exact
  matching. `RetailerOffer.matchBasis` distinguishes `"source"` (this page's own
  record, identity certain) from `"title"`; the table and mobile cards label each
  row "This listing" or "Title match"; and an amber caution above the ranking note
  states the rows were matched by title, not a verified identifier. Wording
  changed in all five dictionaries: `productV2.exactVariant` is now "Variant shown
  as each retailer lists it", and `categoryV2.compareExact` is "Compare products".
  `getMatchingProducts` also now always retains the source record, which a cheaper
  duplicate from the same retailer could previously evict.
  *Still done means:* matching uses GTIN/brand/model first; title-only candidates
  go to a review queue and are not published as exact; approved matches carry a
  `matchAudit`.
- [ ] **Manual match review queue** with side-by-side identifiers, conflict reasons,
  and approve / reject / split-variant / request-better-data actions.
- [ ] **Similar products section**, separately labelled, for substitutes that are not
  exact matches. `getRelatedProducts` is close but is not labelled as substitutes.
- [ ] **Two-independent-retailer rule** gating the comparison claim.
- [ ] **Rank by known delivered total.** Currently ranks by item price (correctly
  labelled). Blocked by §9.
- [ ] **Commission and sponsorship must not change the organic price order** — assert
  this in code and in a test once sponsorship exists.

---

## 9. Price, discount & delivery rules — ❌ Missing

**PDF (p.15):** `Eligible delivered total = qualifying basket − eligible discount
+ delivery + mandatory fees + additional tax not already included`.

Nothing in the codebase computes this. There is no delivery data, no threshold basis,
no tax basis, no stacking rules. `src/lib/fx.ts` handles currency conversion only.

- [ ] **Delivery data capture** per merchant-market (see §7).
- [ ] **Threshold basis flag** — whether free-delivery and coupon thresholds are
  computed before or after discount, per merchant. Do not assume one rule.
- [ ] **Coupon eligibility evaluation** — market, dates, customer eligibility, selected
  item, min spend, cap, account/app/payment requirements, exclusions.
  Unknown eligibility produces a *conditional* offer, not a guaranteed lower price.
- [ ] **Tax / duties basis.** Consistent basis, never double-counted; unknown duties
  prevent a complete-total claim.
- [ ] **Stacking rules.** Combine codes/cashback/membership only when explicitly
  permitted and calculable; contingent cashback shown separately from the amount
  payable at checkout.
- [ ] **Basket allocation.** A basket discount cannot be applied in full to every
  product card.
- [ ] **The calculator itself** — a pure function, unit-tested against the PDF's own
  worked example (p.14):
  - Retailer B: A$31 + free delivery → **A$31 known**
  - Retailer A: A$30 − A$3 eligible discount + A$5 delivery → **A$32 known**
  - Retailer C: A$28, delivery unknown → **total unknown**, excluded from the claim
  *Done means:* a test asserts exactly this, including that C is excluded.
- [ ] **Standard labels everywhere:** Item price · Eligible discount · Delivery ·
  Other mandatory charges · Known delivered total · last checked. Say "estimated"
  where the result depends on shopper details.
- [ ] 🚫 **Multi-retailer basket optimiser** — PDF says defer until single-product
  comparison works and delivery data exists.

---

## 10. Price history & alerts — ❌ Missing

**PDF (p.27):** history starts at first real observation; like-for-like series;
corrections recorded; alert setup with explicit consent; send-time revalidation;
dedup/cooldown/unsubscribe; usefulness metrics.

**Exists:** `subscribers` + `/api/subscriptions/*` + `/api/cron/notify-subscribers`
implement **store-level new-offer alerts** with double opt-in, token, frequency tiers
and unsubscribe. That is a working pattern to copy, but it is not price alerts.
`PriceHistoryPanel` and `PriceAlertCard` render honest empty/disabled states.

- [x] Honest empty state for history
- [x] Alert card disabled rather than collecting an email it cannot act on
- [x] Store-level alert flow exists as a reference implementation
- [ ] **`price_observations` collection** (append-only, see §7) and a recorder job.
- [ ] **History chart** reading only real observations, showing gaps rather than
  interpolating. `recharts` is already a dependency.
- [x] **Never synthesise a "was" price** from RRP or `originalPrice`. — *done 2026-10-01.*
  Audit result: `Product.originalPrice`, `discountPercentage`, `rating` and
  `reviewsCount` are **hand-entered admin fields** — no network client writes any
  of them, and they carry no source or observation date. `Deal.originalPrice` is
  likewise documented as admin-managed enrichment.
  Removed from every public surface: strikethrough was-prices in
  `CompareProductCard`, `HomeProducts`, `StoreProductOffers`, `ProductFeedCard`
  and `LightningDealCard`; the `-N%` saving badges in `HomeProducts` and
  `ProductFeedCard`; the `★ rating (reviews)` line in `ProductFeedCard`; and the
  derived Discount column in `OfferTable`, which now reads "Unknown" (we do not
  know the eligible discount) rather than "None".
  The fields stay in the model — they return to the UI when they carry provenance.
- [ ] **Correction records** keeping source batch, timestamp and original value.
- [ ] **`product_alerts` collection** — product, target or event, market, channel,
  frequency, consent scope + version, unsubscribe state.
- [ ] **`POST /api/product-alerts`** with double opt-in, mirroring `/api/subscriptions`.
- [ ] **Send-time revalidation** — recheck source freshness, exact variant, stock,
  eligibility, delivered-total basis and target condition before queuing. Withhold
  and queue for review on failure.
- [ ] **Dedup by subscriber/product/event, cooldowns, delivery-failure handling,
  immediate unsubscribe honouring.**
- [ ] **Alert usefulness metrics** — subscribed users, valid deliveries, clicks,
  unsubscribes, complaints, attributable approved commission.
- [ ] **Enable the UI** — turn `PriceAlertCard` live and un-disable "Save a product".

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
- [ ] **Immutable raw source snapshots** with `sourceUpdatedAt` and `fetchedAt`.
  Today sync writes straight into live collections — no last-good snapshot to
  recover from.
- [ ] **QA / review queue between normalize and publish.** `discovered_deals` +
  `/dashboard/deals` approve flow is the nearest thing; extend the pattern to
  products, matches and offers so nothing conflicting auto-publishes.
- [ ] **Draft / approved / published / stale / quarantined states** on offers.
- [ ] **Offer expiry & staleness job** — recalculate affected offers, active counts and
  comparison ranks on end time, source deletion, stock change or max feed age;
  invalidate page cache; quarantine ambiguous removals.
- [ ] **Per-feed maximum age**, set from actual source behaviour.
- [ ] **Failure controls** — bounded retries with backoff, dead-letter queue,
  rate-limit handling, last-good recovery, rollback.
  *Done means:* a feed timeout, a partial import and a source deletion each leave the
  catalogue intact and visible in a failure log.
- [ ] **Batch/event ID + owner + status + failure reason on every stage.**
- [ ] **Idempotency proof** — re-running a batch must not duplicate products, alerts
  or commissions. Deals upsert on `(network, id)`; transactions and alerts need the
  same guarantee proven by a replay test.
- [ ] **Weekly operations report** — source health, failed matches, stale offers,
  corrections, search demand, user actions, mature commission contribution.

---

## 12. Admin UI & publishing control — 🟡 Partial

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
- [ ] **Merchant registry fields** — approval status, market, permissions, feed rights,
  contacts, commission basis, exclusions, validation period, payment process,
  terms URL, reviewed date. Must show expired or unconfirmed access **before** any
  publishing or campaign action. (`ppc_permissions` is a partial precedent.)
- [ ] **Feed health screen** — last source update vs last fetch, record counts,
  changed/removed items, missing fields, rate-limit errors, freshness status,
  retry history, links to raw batches and last-good snapshot.
- [ ] **Match review screen** (see §8).
- [ ] **Offer / cost editor** with structured coupon conditions, delivery rules, tax
  basis, source links, timestamps, evidence status, and a **calculation preview for
  specified shopper conditions before publishing**.
- [ ] **Publish states + audit trail + rollback**, and a correction ticket linking
  records → visible pages → recheck evidence.
- [ ] **Alert operations screen** — consent scope, event queue, validation outcome,
  dedup, deliveries, unsubscribe state. Staff must not be able to bypass missing
  consent or an invalid price.
- [ ] **Role-based access control.** Auth is currently single-role.

---

## 13. Events & reporting — 🟡 Partial

**PDF (p.29):** eleven named events, useful dimensions, commercial reports, daily /
weekly / monthly review cadence, documented measurement limitations.

**Exists:** `src/lib/gtm.ts` emits `show_coupon_click`, `coupon_reveal`, `coupon_copy`,
`affiliate_click` with merchant/market/coupon/offer-type/button-location dimensions.
`/api/outbound` records every click to `clicks` with `clickId`, gclid/gbraid/wbraid,
UTM, destination and referrer. `AttributionCapture` persists first-touch attribution.
`/api/admin/conversions/export-google-ads` closes the Ads loop.

- [x] `code_reveal`, `code_copy`, `outbound_click` (as `affiliate_click`)
- [x] Outbound click persistence with network sub-ID and Google click IDs
- [x] Transaction import separating pending / approved / reversed
- [x] Google Ads offline conversion export
- [x] No personal data in affiliate link parameters
- [ ] **Missing events:** `search_submit`, `product_view`, `variant_select`,
  `comparison_view`, `offer_terms_open`, `save_item`, `alert_opt_in`,
  `correction_submit`.
- [ ] **Page type + canonical URL dimensions** on every event.
- [ ] **Commercial reports** — approved commission per landing session and per outbound
  click; approved order count; reversal reasons; paid contribution; costs; cash
  received. Keep code-only/unattributed commission separate until reconciled.
- [ ] **Event dedup on retries**, with documented event meanings.
- [ ] **Daily owner check** — feed age, failed jobs, quarantined matches, stale offers.
- [ ] **Documented measurement limitations** — missing sub-IDs, consent gaps,
  cross-device effects, attribution rules.

---

## 14. SEO & AI-search implementation — 🟡 Partial

**PDF (p.16):** crawlable server-rendered content, canonical/locale discipline,
sitemaps, Product/AggregateOffer structured data, sponsored link relationships,
release verification.

**Exists:** `sitemap.ts` covers root, regions, utility pages, category detail, active
stores and now products. `robots.ts` disallows `/admin`, `/dashboard`, `/api`.
hreflang alternates on home, store, category and product. `rel="nofollow noopener
noreferrer sponsored"` on outbound links. BreadcrumbList + Organization JSON-LD.
Category refinements are `noindex, follow`.

- [x] Sitemap includes canonical indexable URLs for all four page types
- [x] hreflang with per-region alternates and `x-default`
- [x] One canonical per intended page; refinements de-indexed
- [x] `sponsored` rel on compensated links, with visible disclosure
- [x] Terms readable without forcing a network click
- [x] BreadcrumbList structured data on store, category and product
- [ ] **Product / AggregateOffer structured data** on the product page, marking up only
  visible current offers. Blocked by §8 — do not mark up fuzzy-matched offers.
- [x] **Fix the client-fetched category list on the homepage** (see §2) — the p.3
  "rendered navigation" defect. *Done 2026-10-01.*
- [x] **URL consistency audit** — *done 2026-10-01.* Found and fixed three real
  defects behind the p.3 report:
  1. **Five different slug implementations.** `sitemap.ts`, `PublicHeader`,
     `HomeStoreDeals`, `TopDealsClient`, `HomePopularShops` and the admin
     advertiser preview each reimplemented slugging, and they disagreed.
     `PublicHeader`, `HomeStoreDeals` and `TopDealsClient` slugged the **raw**
     name, keeping market suffixes — so search results and every homepage/top-deals
     store link pointed at `/us/invideo-ww`, `/us/beauty-amora-au`, `/us/h-m-de`,
     each of which 301-redirects. All now call one exported
     `storeSlug()` in `src/lib/networks.ts`; `slugifyAdvertiserName` delegates to it.
     Verified by compiling the module and asserting the old and new outputs
     (see "Notes" below).
  2. **`/[country]/deals` had no metadata at all** — no title, description,
     canonical or hreflang, despite sitting in the sitemap at priority 0.8. Added
     `generateMetadata` matching the `/stores` pattern, with
     `meta.topDealsTitle` / `topDealsDescription` in all five dictionaries.
  3. **Trailing-hyphen divergence.** The sitemap stripped all leading/trailing
     hyphens, `slugifyAdvertiserName` stripped only one. Now one implementation.
  *Remaining:* every sitemap URL returning 200 with a self-referencing canonical
  still needs a live crawl — blocked on DB access.
- [x] **`lastmod` only on meaningful changes.** — *done 2026-10-01.*
  `lastModified` is now emitted only where a real timestamp exists: stores use
  `syncedAt`, categories use `updatedAt`. The root, regional homepages, utility
  pages and product pages carry no `lastmod` rather than a fabricated one.
- [ ] **Release verification pass** — representative home/category/store/product URLs at
  mobile and desktop, rendered-HTML inspection, structured-data validation,
  Search Console recheck after release.

---

## 15. Trust, disclosure & corrections — 🟡 Partial

**PDF (p.9, p.17, p.23):** real operator identity, editor responsibilities, contact,
affiliate disclosure, ranking rules, methodology, correction handling, a repeatable
research asset. No fabricated credentials, reviews or partnership badges.

- [x] Affiliate disclosure near offer lists and outgoing actions (home, store, category,
      product, footer)
- [x] Ranking explanation on the product page stating exactly what is and is not claimed
- [x] No fabricated star ratings on new product cards
- [x] AI-generated store content follows a documented never-invent-facts rule
      (`src/lib/ai/storeContent.ts`)
- [ ] **Methodology page** — how checking and ranking actually work, linked from the
  footer and from every "How we compare" / "View method" link. These currently point
  at `/about`.
- [ ] **Correction form** reachable from store and product pages, queued for review.
- [ ] **Responsible editor identity and review dates** shown where claimed (see §4).
- [ ] **Audit existing review/rating content.** `reviews` and `StoreReviewItem` carry
  `author`, `rating`, `verifiedBuyer` — confirm every row is a genuine collected
  review, not seeded. PDF p.9 and p.17 forbid fabricated ratings and trust seals.
- [ ] **A repeatable research asset** — a fixed-basket price/delivery study for the
  pilot, stating SKU variants, retailers, postcode, currency, eligibility, observation
  dates and exclusions. Blocked by §9 and §10.
- [ ] **Separate country eligibility, currency and language.** `getRegionConfig`
  bundles them; p.3 requires they stay distinct so a translated page never implies a
  foreign-market coupon is locally valid.

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

### Phase C — the calculation — 🟡 13–15 done (2026-10-02), 16 outstanding
13. [x] §9 — eligible delivered total calculator, unit-tested on the PDF's worked example
14. [x] §8 — identifier-first matching + manual review queue
15. [x] §6 — real delivered totals, variant controls, checked time on the product page
16. [ ] §3 — brand/type/size filters and store-deal filters, now that fields exist

**What shipped.** `src/lib/model/deliveredTotal.ts` is the formula as a pure
function: qualifying basket − eligible discount + delivery + mandatory fees +
additional tax not already included, every component a `Known<number>`.
Eligibility is three-valued, not two — a requirement we can disprove blocks the
promotion, a requirement we simply cannot see makes it *conditional*, and only
an eligible, calculable promotion ever moves the number. Cashback is carried
separately and never deducted from what is payable at checkout. A basket
discount is allocated pro rata across lines rather than applied in full to each.

`src/lib/model/matching.ts` makes matching identifier-first and holds the rule
that a title match is never an exact match, whatever else is true. Unproven
pairs go to `match_reviews` (one document per pair, `$setOnInsert` on the status
so a re-ingest cannot reset a decision) and surface at `/dashboard/match-reviews`
with both records' identity fields side by side and the brief's four actions.
An approval must name its reviewer, refused in the API and again in the model.

The product page computes a real breakdown per retailer, ranks by **known**
delivered total, lists rows whose costs are incomplete below that ranking rather
than inside it, and makes the lowest-total claim only with two independent
retailers matched on identifiers. Quantity and postcode are a GET form, so every
state is a crawlable URL. Variants come from brand+model identity, never from
title fragments.

**Verified:** `npm test` — 103 unit tests, 41 of them new. The brief's worked
example (p.14) is asserted end to end: B at A$31 ranks first, A at A$32 second,
C excluded with an unknown total, and the lowest *item* price (C, A$28) losing
to the lowest delivered total. `tsc --noEmit` and `next build` clean.

**Not verified:** nothing has been run against a database. The delivered totals
a page actually shows depend on `merchant_markets` and `delivery_rules` being
populated and sourced — until they are, every total reads "unknown", which is
the designed behaviour but means the UI path has not been seen with real values.

### Phase D — retention and operations
17. §10 — price observations + history chart
18. §10 — product alerts with consent, revalidation and dedup
19. §11 — snapshots, review queue, expiry job, failure controls
20. §12 — feed health, match review, offer/cost editor, alert operations
21. §13 — remaining events and commercial reports

### Phase E — trust and evidence
22. §15 — methodology page, correction form, editor identity
23. §15 — the fixed-basket research study
24. §14 — Product/AggregateOffer markup (only once matching is trustworthy)
25. §16 — populate the operating model from real exports

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
