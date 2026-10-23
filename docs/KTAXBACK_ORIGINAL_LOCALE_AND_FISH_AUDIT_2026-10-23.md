# K-TAXBACK Global Olive Young localization source audit — 2026-10-23

## Requested changes

1. Exclude \`vi_vn\` from active pilot source languages and future queue claims.
2. Use the **actual global.oliveyoung.com** website, not only a fake \`Accept-Language\` header.
3. Select BOTH **Shipping Location** and **Language** in Shopping Preferences; commit Save; verify persisted settings.
4. Preserve cookies/session **within a single browser context for all category tabs** of that language.
5. Distinguish source product listing locale from the site-side translation service.

## Original source inspected from user's C:\tour full-source ZIP

- \`olive.py\`: visits \`https://global.oliveyoung.com/display/category?ctgrNo=...\`, intercepts \`product-data\` and writes original JSON. It opens a **new browser context per category**, appropriate for English but not locale persistence.
- \`olivecategory_jp_crawler.py\`: deliberately **shares a single Playwright browser context**, has a **visible human language setup tab**, and reuses that context's cookies/storage on every category. The comment explicitly says new contexts would revert the locale to English.
- \`olivecategory_multilang_crawler.py\`: attaches via Playwright CDP to a real Chrome profile, asks operator to set language first, and uses the already-open context and its session for every category.
- \`seed.py\` locale detail handling near lines 728-767: \`prdtNameEn\` remains English regardless of locale; \`prdtName\` is the native Japanese name. Japanese snapshots use \`product_names_i18n\`; optional names/breadcrumbs and overlay translations have separate storage paths.
- \`scrape_translate_texts.py\`: from a language-configured browser, observes \`https://translation.oliveyoung.com/public/translate-texts\`. Request has \`source_language\`, \`target_language\`, \`texts\`; response \`translations[]\`. Actual pairs are captured, not inferred from list \`product-data\`.
- \`batch_translate.py\`: alternative explicitly invokes above translation endpoint and writes \`translations_<lang>.json\`. Source validates each response and handles HTTP 403. This is distinct from selecting Shopping Preferences alone.
- \`chrome_translate_capture.py\`: yet another translation path using the browser's page translation. Not the same as site-native localized product data.

## Real TinyFish visual browser checks (not assumptions)

### Japanese
Live TinyFish clicked **Shopping Preferences > Shipping Location: JAPAN > Currency automatically ¥ JPY > Language: Japanese > Save**. Reopening modal showed saved choices. The linked category \`?ctgrNo=1000000008\` remained English with US$ prices. A saved preference is NOT evidence that \`product-data\` or UI returned Japanese, and this alone does not prove global localization cannot work in other contexts.

### Simplified Chinese
A separate TinyFish session selected **Shipping Location: CHINA > Language: 中文（简体） > Save**. Reopening modal confirmed selections. Opened live product \`https://global.oliveyoung.com/product/detail?prdtNo=GA210002626\`. Product title, descriptions, navigation and price remained English/USD. No access-restriction banner was shown in that Fish session. This does not show whether the \`translation.oliveyoung.com\` API was called — the browser task inspected UI rather than capturing network traces.

### Traditional Chinese
The country and its exact UI label have **not** been independently verified with Fish. Railway's \`TAIWAN\` option must fail visibly when unavailable; do not mark translations successful based on a guessed shipping country.

## Cloud code now
- \`workers/oliveyoung/pilot.py\`: restricts to \`en\`, \`jp\`, \`zh_cn\`, \`zh_tw\`; uses the actual global homepage; attempts Fish-verified shipping country and language selection; Save/reopen verification; retains a **shared browser context per source language** for category requests.
- \`backend/app/ktaxback_pilot.py\`: excludes pending historical \`vi_vn\` tasks without deleting their audit data, filters manager/summary queries and schedules one-time 3-locale category smoke.
- \`backend/app/ktaxback_collector.html\`: 4-language table, Vietnamese column removed.
- All production product and category data stays in original-column-name Railway Postgres \`korea_prebook_kt_*\` tables; original 8,959-item user SQLite has not been imported.

## Required separate follow-on verification

Capture on a configured product page the **actual** HTTP network request to \`translation.oliveyoung.com/public/translate-texts\`, inspect its source/target language and translations; link fields to original \`seed.py\` paths before upserting to \`product_translations\`. **Do not pretend names or content are localized when original HTTP JSON returns English**. If the provider serves access-denial challenges, mark the probe failed without bypassing controls.
