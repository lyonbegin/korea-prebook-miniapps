# K-TAXBACK catalogue: audited DB schema and cloud migration (2026-10-23)

## Source actually inspected
User-provided \`ktaxback_catalog_audit.zip\` contains schema and up to 12 read-only sample rows per table from \`C:\tour\ktaxback.db\` (700,989,440 bytes); not the complete database.

|Table|Rows|
|---|---:|
|products|8,959|
|brands|2,174|
|categories|145|
|category_filters|11,269|
|attribute_defs|724|
|product_images|251,356|
|product_options|16,722|
|product_details|17,698|
|product_attributes|22,262|
|product_relations|101,637|
|reviews|83,092|
|home_corners|12|
|home_corner_sets|56|
|home_banners|51|
|home_corner_products|145|
|product_translations|508,297|
|category_names_i18n|144|
|category_filters_i18n|11,236|
|seed_progress|31,588|
|shop_collections|0|

Profile warnings: \`shop_pickup_centers\`, \`shop_price_offers\`, \`shop_bundles\` not found in the scanned local database. These are optional and should not be invented as existing records.

### Critical migration facts
- Source \`products.prdt_no\` is the canonical product ID; it is **not** the channel listing ID.
- Original \`assemblers.js\` exposes \`prdtNo\`, \`prdtName\`, \`saleAmt\`, \`optionList\`, \`thumbnailList\`, \`setContsMap\` and exact legacy .json routes.
- \`products.sale_amt\` and \`nrml_amt\` are \`REAL\` and **the schema has no currency column**. The existing UI explicitly displays \`US$\`; never assume KRW.
- Images are relative paths resolved against \`https://cdn-image.oliveyoung.com/\` by the original frontend; keep these paths intact and independently verify licensing and image reachability for production use.
- Product translations are stored by \`(prdt_no, lang_code, field_key)\`; original languages: \`en\`, \`jp\`, \`vi_vn\`, \`zh_cn\`, \`zh_tw\`.
- Full source DB was *not* uploaded, and the production database has not yet received all 8,959 original products.

## Implemented in repository
- \`backend/app/ktaxback.py\`: create isolated \`korea_prebook_kt_*\` catalog tables from SQLite's schema through authenticated API, bulk upsert exact rows by original composite PK, serve original JSON formats.
- \`scripts/ktaxback_sync.py\`: read-only SQLite batch copy over HTTPS; resume by source rowid; excludes accounts, orders, carts, sessions and checkout; review authors excluded and reviews omitted unless explicitly opted in.
- \`backend/tests/test_ktaxback.py\`: synthetic regression tests for schema import, full/partial upsert, translated product, options, gallery, brand list, category page and forbidden private data.
- Existing prebook API tables are not modified. Original \`touranal\` and \`C:\tour\` files remain untouched.

### Supported original web API contracts
- \`/main-vue-data.json\`
- \`/new-arrivals-data.json\`
- \`/flash-deal-vue-data.json\`
- \`/featured-brands.json\`
- \`/order-best.json\`
- \`/best-seller-data.json\`
- \`/brand-list.json\`
- \`/oliveyoung_json_data/ctgr_{id}/page_{n}.json\`
- \`/FINAL_category_with_real_filters.json\`
- \`/detail-data.json?prdtNo=...\`
- \`/details-info.json?prdtNo=...\`
- \`/review-list.json?prdtNo=...\`
- \`/relation-list.json?prdtNo=...\`
- \`/product-data-kpop.json\`

The migration has **not** yet reimplemented user/cart/checkout mutation routes, official WeChat/Alipay native checkout, or hosted the original React V3 UI files. Do not claim full frontend migration.

### Local full-catalogue transfer (when ready)
1. Obtain \`scripts/ktaxback_sync.py\` from the connected GitHub repository and run:
   \`py ktaxback_sync.py --dry-run\` (reads SQLite, no network).
2. On the actual transfer, run \`py ktaxback_sync.py\`, with the authorized Railway manager token entered via a non-echoing prompt. Do not paste the token into chat or commit it to GitHub. The script does not store the token and skips user/order tables.
3. Existing DB rows are keyed by SQLite PK, so restarting from a checkpoint remains safe. It streams catalogue records to existing production PostgreSQL and never changes original SQLite.
4. The worker/api entrypoint is existing Railway \`prebook-api\`; service API \`/manager/api/ktaxback/status\` displays table row counts after authentication.
5. Do not start full migration until the API deployment and regression tests pass.

### Deployment status caveat
\`/health\` may be live even while the older deployment serves \`/brand-list.json\` 503 because the original catalogue rows have not been transferred yet. A configured endpoint is not evidence of successful complete import.
