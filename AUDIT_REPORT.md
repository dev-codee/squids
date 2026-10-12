# Functionality and SEO audit — 12 October 2026

## Fixes implemented

### Public browsing and links
- Unsupported geolocation now falls back to a supported country; root redirects preserve search and campaign parameters.
- Uppercase country URLs permanently redirect to their lowercase equivalents, preserving the query string.
- Repeated product query parameters no longer call string methods on arrays.
- Impossible catalog pages are checked during metadata generation; removed the products loading boundary so invalid pagination returns HTTP 404 before streaming begins.
- Store cards use the same slug generator as canonical routing.
- Newly saved products remember their originating country, preventing a region switch from breaking their saved link.
- Product lookup failures reach the recoverable error screen instead of masquerading as missing products.
- Added helpful 404 and error screens with working navigation and retry actions.
- Search suggestions cancel outdated requests, validate markets, limit query length, and display the recorded currency rather than always using dollars.

### Actions, forms and administration
- Shared accessible, dismissible success/error feedback for common saves, deletions, saved items, category changes, offer updates and logout.
- Subscription preference changes report success and recoverable failures.
- Failed coupon votes roll back the optimistic state and remain retryable; local storage records only successful submissions.
- Price-alert creation handles database failures and failed confirmation delivery; updating an already-confirmed alert no longer claims another confirmation email was sent.
- Invalid, failed and successful alert email links produce visible outcome messages and supported-region destinations.
- Correction submissions validate reference field types and malformed JSON.
- Reading/updating correction reports and reading network earnings require admin authentication; submitting a public correction remains available.
- Admin offer previews call the existing API route and preserve offer currency, market and unknown prices.
- Manual sync uses a protected server endpoint rather than a public browser cron secret. Partial sync failure is reported honestly.
- A failed Awin advertiser feed is no longer converted into an empty snapshot before stale-record cleanup.
- MongoDB can reconnect after an initially rejected connection instead of permanently reusing the rejection.

### SEO and performance
- Product/category pagination has distinct canonical URLs; refined listings remain noindexed.
- Categories containing products are no longer considered empty solely because they lack coupons.
- Norway's declared language matches its English interface.
- Removed inherited homepage Open Graph URLs from nested regional pages.
- Breadcrumb JSON-LD escapes HTML delimiters.
- Main sitemap contains public navigation pages without scanning every market's inventory.
- Separate market sitemaps contain eligible stores/categories; product sitemap shards use actual market availability. All are declared in robots.txt.
- Products explicitly prefixed `[TEST]` are noindexed and excluded from product sitemaps. Four such fixture records were observed; their data was preserved.
- Directory queries project only listing fields and share cached results across views. Store detail pages retrieve the selected merchant's complete record separately.

### Exclusive ribbon
- Added a reusable orange diagonal corner ribbon, with star detail and translated label, to coupon and deal cards.
- Reserved space around the ribbon so offer content remains readable; decoration does not capture pointer input.

## Verification
- Final production build passed, including lint and TypeScript checks. All 20 model regression test files passed.
- `node scripts/audit-api-regressions.cjs`: isolated tests for email delivery failure, invalid input, database errors, invalid unsubscribe links, confirmation markets and redirect parameter preservation. These tests do not send email or write to the database.
- `node scripts/audit-route-links.mjs`: checked 327 source files and 69 API routes; no missing literal API targets or static admin navigation targets.
- Initial production HTTP crawl: 32 URLs, 82 internal links discovered, no HTTP 5xx responses. Tested public navigation, sample store/product pages, invalid routes and repeated product parameters.
- Final production HTTP verification confirms `/us/products?page=999999` returns HTTP 404. Sample test products return `noindex` and are omitted from the product sitemap.
- The final focused crawl checked 10 URLs with no HTTP 5xx responses; the exclusive ribbon was present in the rendered Beauty Amora page markup.
- Local directory responses improved from approximately 78 seconds to 12 seconds. These are observed local timings, not a production performance guarantee.

## Scope and limits
- Deployment and the live site's post-deployment behavior were not verified.
- Browser automation was unavailable, so interactive/visual behavior was reviewed in source and rendered HTTP output, not through an automated browser.
- Real email delivery, external affiliate destinations, cron execution, destructive admin actions and all 36 markets were not exercised end to end.
- Link crawling sampled data-driven URLs; it is not a guarantee that every merchant destination or historical saved item still exists.
- The database's observed catalog currently consists of four explicitly marked test products. Real product inventory remains a content task.

## SEO references
- Google pagination guidance: https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading
- Next.js 14 metadata behavior: https://nextjs.org/docs/14/app/building-your-application/optimizing/metadata
