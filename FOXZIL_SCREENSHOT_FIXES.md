# Screenshot guide implementation — 7 October 2026

This supersedes the completion claims in FOXZIL_BUILD_PLAN.md where they conflict with the screenshot audit. No merchant, offer, product, price or research records were hardcoded or changed in the database.

## Implemented in application code

- Shared market-scoped publication gate: active and started offers, real expiry handling, distinct totals, explicit country eligibility, network plus merchant ID and normalized name identity. Missing eligibility, quarantined records and generated brand/welcome placeholders are withheld.
- One canonical merchant per market snapshot for homepage counts, store resolution, directory, search, related stores and sitemap. The store loader reads every eligible offer page rather than truncating at 100.
- Server-rendered directory and crawlable pagination; unique directory pages use page-specific canonicals. Saved pages are noindex and absent from sitemap. Unsupported aliases/markets and empty merchants return 404; recognized suffix aliases redirect permanently.
- Homepage copy describes store discovery and store email alerts. Unsupported research figures, product identifiers and fabricated sample prices were removed. Research route has a no-data state and is noindex.
- Store copy and metadata derive from current eligible offers; generic verification promises were removed. Checkout status requires recorded test source, checker and date; import timestamps never act as checkout proof.
- Offer cards expose sourced terms, structured minimum spend, customer eligibility, exclusions, real expiry and source URL; unknown values remain unknown. Shipping labels depend on sourced structured fees/thresholds/destinations and otherwise use a neutral delivery label.
- Separate official policy/support URL fields; missing URLs are unavailable rather than shopping links. Affiliate shopping is labelled. Reviewed category assignments are required for category/related modules rather than generic feed tags.
- French offer filters, sorting, follow dialogs, source status and report actions translated. Coupon and follow dialogs support focus management, Tab trapping, Escape and focus restoration; clipboard failures preserve a readable code.
- Outbound endpoint validates offer market and identity, scopes composite offer IDs, and rejects missing/ambiguous destinations. Public API failures cannot bypass eligibility using a raw feed fallback.
- Store subscriptions validate merchant identity and retain country. Alerts use country/network/store identity, keep failed-send cursors for retry, and use local offer links. Confirmation failures do not report success. Feed upserts avoid overlapping MongoDB update paths and record fetch time separately from edit time.

## Source data still needed

The read-only database check found no product records. It also found several guide merchants marked inactive, market suffixes in legacy deal names, and source dates needing review. Publication rules intentionally withhold inactive/unreviewed data; code must not invent active status, policies, categories, prices, test outcomes or eligibility to fill modules.

Operators can supply `reviewedCategories` (protected advertiser PUT stamps review time), `officialUrl`, distinct `policyUrls`, and reviewed content confirmation. Protected offer enrichment accepts source terms/URL, `reviewedRegionCodes`, structured `promotion` conditions/evidence and `delivery` rules. Reviewed offer country overrides survive feed refreshes. Legacy subscriptions without a country are withheld pending a genuine market selection.

No live import, database repair, deployment, email send, paid-promotion permission check or revenue settlement reconciliation was performed. Those require real source records and an authorized end-to-end environment. Mobile/browser visual evidence and real email delivery cannot be inferred from compilation or model tests.

## Follow-up UI and flagship requirements

- Main brand is orange-red `#FF4D00`; square offer actions use `#300A6E` with `#0B00CF` hover. Store identity panels use alice blue. Store page titles are 20px, offer headings 14px and descriptions 13px.
- Actual expiry (or the translated unknown label) appears beneath the offer action. Exclusive badges depend on the source flag and sit by the discount tile. Terms use an SVG chevron with expanded state and a linked panel. The duplicate coupon heading and recently viewed sidebar were removed.
- The user's later instruction to preserve flagship selections supersedes the earlier blanket inactive-merchant restriction for editor-selected flagships. Joined, market-matching records marked `isFlagship` remain public without changing their stored feed status. Their individual offers still pass all source, market, date and deduplication checks. A flagship with no eligible offers shows an empty state with no invented offers and is noindex.
- The homepage includes its real, flagship-first store grid in server HTML directly below the hero; no search is required to see selected stores. No store names, flags, statuses, dates or counts were hardcoded or written to the database.

## Validation recorded

- Final production build and TypeScript checks passed after the moderation/feed adjustments.
- Model suite: 14 files passed, including new paid/free/conditional delivery regression cases.
- Read-only MongoDB aggregation checks passed for lifecycle, explicit/unknown/wrong markets, reviewed country overrides, deduplication and suffix normalization. The stored Beauty Amora offers produced zero US-eligible results; Hacoo had 10 distinct FR-eligible source records before merchant joining.
- Commission Factory source verification timed out. No active status or expiry was guessed to bypass that failure.
- Awin partial-page failures and partial CF imports retain last-good records and do not record a complete refresh. Protected moderation reads expose unpublished records for review, separate from public API publication.

Follow-up validation: production build and all 14 model test files passed. Read-only MongoDB regressions passed for case-insensitive active status, stored flagship visibility, non-joined exclusion and unchanged offer eligibility. Firefox confirmed Beauty Amora AU has 14 cards, a 20px page title, 14px offer titles, 13px descriptions, alice-blue banner, square purple actions and sourced expiry labels. Terms expand into their linked panel. The AU homepage shows the existing All Fenix and Beauty Amora flagship selections; All Fenix has a no-offers state and noindex metadata. No horizontal overflow appeared at the checked desktop and 500px browser widths.

Still open: source-owner review of inactive statuses, offer dates/conditions, distinct official policies and reviewed taxonomy; real product inputs for comparisons/history; remaining English labels in French subpages; live consent/save/email/retry/unsubscribe/correction-delivery checks; real feed failure, moderation, vote and tracking/revenue checks; and broader accessibility/mobile/performance verification. Firefox's window minimum prevented a true 390px check, and the later US-route browser navigation timed out, so neither is recorded as a browser pass. No real email or affiliate purchase was triggered.
