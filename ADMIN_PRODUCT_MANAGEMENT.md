# Managing products from the admin panel

Open **Dashboard → Products**. Choose **Add Product** or **Manage** on an existing listing. The admin list includes comparison-only demo offers as well as catalog products.

## Editor sections

| Section | Controls |
| --- | --- |
| Details | Retailer selection, title, category, countries, description, image URL/local asset path, and specification rows |
| Identity & variants | Brand, model/MPN, GTIN, size, colour, flavour, pack count, condition and regional specification |
| Price & links | Current price, currency, stock, affiliate/retailer URL and demo retailer label |
| Variants & offers | View/edit related listings, preview public pages, add a variant or add another retailer's offer |
| Delivery | Country-wide or postcode-prefix delivery charges, free-delivery threshold/basis, mandatory fees, tax inclusion, restrictions, policy source and reviewer |
| Price history | Add a sourced observation or correct an existing one with a reason; previous values are retained |

Save a new product before using delivery and history controls. A new or changed current price creates a dated history observation for its markets. If history recording fails after the product is saved, the editor reports that partial outcome.

**Variants:** use the same brand and model, then change size, colour, flavour or pack count. The Add variant action clears the copied GTIN so it is not accidentally reused for a different item. Enter the new variant's actual identifier when known.

**Retailer offers:** use Add retailer offer, select another retailer, then enter that retailer's price, availability and URL. Matching identity fields connect the listings. Uncertain product matches can be reviewed through the linked Match reviews screen.

**Delivery:** real delivery rules are shared across that retailer's products in the selected market. Demo delivery remains attached only to its demo listing. Blank monetary fields mean unknown; enter 0 explicitly for free delivery or no fees. Existing express service levels and region restrictions are preserved when editing their rules.

**History:** the editor shows the latest 200 observations. Real manual observations require a source URL and reviewer. Corrections require a reason and retain correction history. Editing a historical observation does not change the current product price.

Images use an existing URL or local asset path. Legacy reference prices, discounts and ratings remain editable as internal fields; they do not become unsourced public savings or customer ratings. Demo fixtures retain their `[DEMO]` labels and noindex behavior.

## Validation

- Production build passed, including lint, TypeScript and static page generation.
- All 21 model test files pass, including malformed prices, incomplete specifications, unsafe URLs and partial-edit preservation.
- `node scripts/audit-admin-products.cjs` checks create/update validation, duplicate-ID rejection, variant/offer creation rules, automatic observations, demo preservation, scoped history corrections and demo delivery isolation without database writes.
- Existing API and route-link audits pass.
- Production requests without an admin session returned 401 for product edits, product context, history and delivery endpoints.
- An authenticated browser check saved a temporary description on the labelled serum demo, confirmed it on the public page, and restored it. Specifications and identity were preserved.
- Browser checks confirmed all 26 admin records are visible, related variants/five offers resolve, delivery/history editors load, duplicate IDs return 409, and the modal fits mobile. No browser runtime exceptions were observed.
