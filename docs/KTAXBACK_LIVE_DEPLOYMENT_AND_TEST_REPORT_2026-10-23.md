# K-TAXBACK / Olive Young — deployed source pipeline verification (2026-10-23)

## Exact user-approved scope
- Keep original tour/K-TAXBACK PostgreSQL column names and composite keys.
- Ten representative Olive Young categories, English pilot ten authentic goods each.
- Supported i18n: en, jp, zh_cn, zh_tw. **vi_vn disabled.**
- Do **not** import old 8,959-item local C:\\tour\\ktaxback.db catalogue.
- Existing frontend consumes original compat JSON endpoints; K-TAXBACK V3 React frontend itself is **not** yet migrated.

## Production source pipeline
- GitHub: lyonbegin/korea-prebook-miniapps
- Railway: thriving-education, prebook-api, prebook-oliveyoung-worker (translation), prebook-oliveyoung-collector (product details and pricing).
- Original vendor API: POST https://translation.oliveyoung.com/public/translate-texts
- Backend: backend/app/ktaxback_translation.py, ktaxback_category_translation.py, oliveyoung_refresh.py and ktaxback.py.
- Workers: workers/oliveyoung/pilot.py, source_translations.py, worker.py.
- Product translation strictly matches prdt_no and current source_text; optionList indices and English description values are matched against existing PostgreSQL originals; source HTTP 401/403/429 stop further requests.
- Each category/lang translation request has a PostgreSQL TTL lease, release after completion; vendor returns checked against English text and original DB primary keys.
- Original source category title records go to category_names_i18n, translated options go to category_filters_i18n, with English fallback in legacy category JSON until full translated filter parity.
- New product collectors update only approved categories via /manager/api/ktaxback/refresh/worker/auto-limited, ten products per category page, 3h cadence. Periodic vendor translation six-hour cadence.

## Live verification evidence
Checked read-only Railway public source/DB audit at UTC 2026-10-23 approx 03:27.
- products=130; brands=76; categories=28; category_filters=357; product_images=156; product_options=22; product_details=8
- product_translations=405: jp=136, zh_cn=133, zh_tw=136; source from live Olive Young translate-texts HTTP 200.
- category_names_i18n=30: ten authentic categories per three target languages.
- category_filters_i18n=18: six real options in one category per three languages; other category groups have not been translated.
- Example existing product GA210003713: /detail-data.json?prdtNo=GA210003713&lang=jp returns Japanese product title AND several translated option names. /details-info.json?prdtNo=GA210003713&lang=zh_cn returns Chinese why-we-love-it text. All were read back via existing frontend JSON endpoints.
- Previous English product-list 10×10 pilot saved and verified in PostgreSQL; totals now count distinct rows and other earlier live goods, **not** 8,959 legacy records.

## Outstanding blockers (report honestly)
1. Periodic *product-list* worker in Railway Chromium sometimes gets third-party vendor "Just a moment..." anti-automation page; the test batch for categories 1000000003, 1000000008 returned 0 accepted and was marked FAILED. Fail-fast, no blind retry or bypass. Data already saved was preserved. Site access differs between TinyFish browser and Railway browser; importing TinyFish session cookies into Railway without a supported provider connection is not assumed.
2. Not all original 357 English filters have translated records (currently only 18 translated examples). The compat category JSON returns original English filters until complete localized filter set is available, and exposes partial i18n separately.
3. Original multilingual **review strings, relation lists, full homepage curation and full product-detail catalogue** have not been migrated and verified for every product; UI React V3 deployment is separate and not claimed done.
4. The GitHub Actions test workflow has been added; a green automated test result has not been independently demonstrated in this chat.

## Management and public verification
- https://prebook-api-production-9b80.up.railway.app/manager/ktaxback
- https://prebook-api-production-9b80.up.railway.app/v1/ktaxback/pilot/summary
- https://prebook-api-production-9b80.up.railway.app/v1/ktaxback/translations/examples

Production status is a live backend with real source-translated catalogue rows. Full, continuously refreshing original frontend and unrestricted live source collection are **not** completed.
