# K-TAXBACK: Origin collectors deployed for ongoing updates (2026-10-23)

## Why this exists
Transferring only the original ~701MB \`C:\tour\ktaxback.db\` would freeze the products. The original data producer must be moved to Railway too.

**Source code examined**, not guessed from names:
- \`C:\tour\olive.py\`: headless Playwright category navigation with \`ctgrNo\`, response URL containing \`product-data\`, MORE-button pagination; raw \`hits.hit[].fields\` per product.
- \`C:\tour\scrape_product_details.py\` variants: \`/product/detail?prdtNo=...\`, intercept \`detail-data\`, \`details-info\`, and reviews/relation APIs.
- \`C:\tour\seed.py\`: normalize incoming \`prdtNo\` to \`products.prdt_no\`; UPSERT with preservation of previously known values; replace gallery/options for one product, ensure translations are separate.
- \`C:\tour\olivecategory.py\`: category tree \`categoryFacets\`, \`attrFacets\` and filter counts.
- \`C:\tour\assemblers.js\`: reconstruct legacy K-TAXBACK JSON API.

## Railway architecture
- Production API service (existing) \`prebook-api\`: https://prebook-api-production-9b80.up.railway.app
- **New separate collector service** \`prebook-oliveyoung-worker\` in existing \`thriving-education\` project
- Source GitHub repo \`lyonbegin/korea-prebook-miniapps\`
- \`Dockerfile.oliveyoung\`: Playwright Python image with Chromium included.
- \`workers/oliveyoung/worker.py\`: capture original \`product-data\` and a limited batch of \`detail-data/details-info\`. Send data to existing API via HTTPS, no local SQLite/Windows Chrome/CDP required.
- \`backend/app/oliveyoung_refresh.py\`: Postgres job queue, price change history, validated raw capture ingestion, original \`seed.py\` normalization, options/images/details update and non-destructive partial upserts.
- \`backend/app/manager.html\`: request manual refresh or check source jobs and errors.
- \`backend/tests/test_oliveyoung_refresh.py\`: regression cases for capture, security, price update and job transitions.

## Secrets / credentials
- Worker \`ADMIN_API_TOKEN\` is a Railway cross-service variable reference, not a hardcoded literal.
- No vendor passwords, cookies or API secrets are committed.
- The original global.oliveyoung.com category listing pages appear to be public; this direct Playwright collector does not request seller login.
- If remote browsing is blocked or site structure changes, the job must fail visibly; never fabricate prices or mark zero items as success.

## Automatic update behavior
- \`OLIVEYOUNG_AUTO_REFRESH=1\` on the worker.
- The worker checks for a new due job every 30min; API enforces **3-hour minimum** between queued jobs.
- Rotates up to **8 categories** per automatic batch across the imported category IDs (excluding root), at most **2 pages per category**.
- \`DETAIL_LIMIT=10\` caps detailed product requests per job. Adjust only after real collection results justify increased volume.
- Logging: \`GET /manager/api/ktaxback/refresh/jobs\` with manager bearer token.
- Detailed per-product edits \`POST /manager/api/ktaxback/refresh/worker/{job}/detail\`; category pages \`.../capture\`.
- Price changes are written to \`korea_prebook_kt_price_history\`, no synthetic price data.

## Critical initial activation
1. The source SQLite DB has **not yet been uploaded**. Prior audit ZIP included only schema/sample; no full records.
2. Full initial import from user's computer uses \`scripts/ktaxback_sync.py\` after a dry-run. See \`docs/KTAXBACK_CATALOG_PROFILE_2026-10-23.md\`.
3. Until \`korea_prebook_kt_products\` and \`korea_prebook_kt_categories\` tables are registered in PostgreSQL, API returns 409 and worker remains idle.
4. This is intentional data-integrity protection. Deployment health \`SUCCESS\` does not mean first live Olive Young capture or complete ~8,959 item import has been verified.
5. Original translation, category-filter, review and marketing front-page generators are not *all* updated by the current scheduled worker; complete refresh coverage must be expanded and tested separately, in particular multilingual snapshots, related-product records, translation overlays and front page curation.
6. Original local files are kept intact; new production collector is a refactor, not a claim that all the original 45KB \`seed.py\` and all historical scraper variants were committed verbatim.

### Useful routes
- \`GET /manager/api/ktaxback/status\` — initial catalogue import progress
- \`POST /manager/api/ktaxback/refresh/jobs\` — manual refresh request \`{category_ids:["1000000003"],max_pages:2}\`
- \`GET /manager/api/ktaxback/refresh/jobs\` — jobs, processed count, errors, price changes
- \`GET /manager/api/ktaxback/refresh/worker/next\` — claim queued job; 409 until schema exists
- \`GET /detail-data.json?prdtNo=...\` — frontend legacy data contract
