# MyDoctor publicly observed data cache

The API shares the existing Railway PostgreSQL server, using only the
`mydoctor_clone` schema. Page data is served by `GET /catalog/page?path=/...`.

1. Check `mydoctor_clone.public_page_facts` for the same original public URL.
2. Return existing factual metadata with `X-Cache: HIT` when available.
3. On cache miss, request the anonymous original GET and extract public
   factual headings, links and price tables only. Persist them to PostgreSQL,
   then return the same factual view.
4. On upstream HTTP 429/403, report the missing data; never fabricate a
   response or store copyrighted full page HTML marked no-store/private.
5. Versioned original-HTTP-200 observations are imported on API boot. They are
   **not** complete original pages; UI reports their evidence quality.
6. The 2026-11-09 GitHub Actions collector observed 29 representative
   page routes and upgraded each with public factual headings, links and
   factual numeric table rows. Each route's original data and UI interaction
   parity remain subject to separate tests.

Runtime checks:
- `/health`
- `/catalog/page-cache/status`
- `/catalog/status`
- `/catalog/coverage`

Existing `unni_clone` tables and services are untouched.
