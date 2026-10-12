# Product UI review and demo catalog

## Reference analysis

The [Idealo iPhone page supplied for this review](https://www.idealo.de/preisvergleich/OffersOfProduct/207644441_-iphone-17-pro-apple.html) groups variant choices, pricing, history and retailer comparisons around the purchase decision. Its offer rows separate item price, shipping, delivered total and shop actions. Foxzil now uses these patterns with its own branding and available data.

The [Idealo mobile-phone catalog](https://www.idealo.co.uk/cat/19116/mobile-phones.html) makes filters, specifications, result counts and sorting prominent. Foxzil's catalog now has compact rows, visible facet choices/counts, searchable long facet lists, removable filters and search that preserves refinements. Shared cards carry these changes into home, category, related-product and store sections.

The reference site's page content was readable through web research, but it blocked headless-browser visual access. This is an adaptation of its interaction and information patterns, not a claim of pixel-identical reproduction.

## Implemented

- Product overview: title first, larger image with zoom, variant specifications, prominent price, comparison action and price alert.
- Variant selector: real stored sizes/colours, selected-state indication, individual prices, reset for empty combinations.
- Sticky section navigation follows the section currently being viewed.
- Retailer table: stock filter, retailer search, verified-match filter, visible result count, item/total/retailer sorting and expandable cost breakdowns. Total sorting emphasizes the known total.
- History: 3-month, 6-month, 1-year and all-time views; keyboard-readable points and a data table. Database lookup now retains the newest observations when the limit is reached.
- Mobile: filter disclosure, stacked offers, full-width retailer search and header navigation that does not clip the first link.
- Store product cards retain specifications and distinguish an unknown price from zero.
- Added control translations in English, German, French, Spanish and Italian.

## Beauty Amora review fixtures

Seeded into the connected database for Beauty Amora (`commission-factory:83335`), Australia only:

- 14 primary products, including serum sizes/multipack, lip colour variants, cleanser, toner, cream, lotion, shampoo, body oil, mask and travel set.
- 12 comparison-only offers across four fictional retailers. These remain available in comparison tables without duplicating catalog rows.
- 775 explicitly synthetic observations across six months.
- Local SVG sample packaging; fictional descriptions and specifications.
- Known/free/unknown delivery, stock differences, missing-price state and quantity-dependent delivery thresholds.

All demo titles start with `[DEMO]`, detail pages carry an explicit notice and `noindex`, and product sitemaps omit them. Demo shop actions show feedback. Demo alerts preview success without creating subscriptions or sending emails; the API enforces this too. Existing advertisers, real delivery rules and real deals were not changed.

Review paths after deployment:

- `/au/beauty-amora` — select the store's Products section.
- `/au/products` — catalog, filters, sorting, grid/list and pagination.
- `/au/product/88001001` — serum, size/pack variants, five retailer offers and history.
- `/au/product/88001008` — lip colour variants.
- `/au/product/88001014` — missing price and unavailable stock.

Seed command (dry run by default):

```sh
node --env-file=.env.local scripts/seed-beauty-amora-demo.cjs
node --env-file=.env.local scripts/seed-beauty-amora-demo.cjs --apply
```

Re-running updates only records owned by `beauty-amora-review-v1`; collisions with unrelated records abort before writes. Synthetic history is labelled by the fixture set and is never written into real-product history.

## Validation

- Production build passed, including lint, TypeScript validation and static page generation.
- All 20 model test files passed, including demo noindex coverage.
- API regressions passed, including proof that demo alerts do not write subscriptions or send email.
- Link audit: 330 source files, 69 API routes, no missing literal API or static admin navigation targets.
- Chromium desktop/mobile checks passed: five offer rows, noindex, image zoom/close, variant filtering/reset, stock filtering, retailer search empty/reset states, shop feedback, history range, alert success and viewport fit. No runtime exceptions.
- Eight final production HTTP checks passed: Beauty Amora's populated store, 14-product catalog, pagination, brand filtering, price sorting, missing-price product, out-of-range HTTP 404 and omission of demo products from the product sitemap.
- Desktop/mobile screenshots reviewed locally. Demo data intentionally does not imply real ratings, customer reviews, merchant delivery promises or working checkout.
