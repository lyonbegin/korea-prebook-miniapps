# K-TAXBACK V3 native Mini Program integration

## Current result
- WeChat miniapp native WXML/WXSS/JS shop is the FIRST page.
- Alipay miniapp native AXML/ACSS/JS shop is the FIRST page.
- Previous pre-arrival service directory is still accessible from bottom navigation and the shopping service links back into K-TAXBACK.
- Both miniapps fetch real PostgreSQL products from the existing Railway FastAPI server. No mock items or legacy SQLite import.

## Source design reference
Inspected full original C:\tour sources:
- nanoom-tour-shop-ui-v3.jsx — red #ff3152, pink promo sections and category chips, two-column product cards, original US$ price, bottom shop navigation, product detail.
- k-taxback-shop.jsx and assemblers.js — original per-language product/brand/option/image response formats.
- nanoom-tour-unified-app.jsx — original V3 bridge and customer shopping state.

## UI now in both native Mini Programs
1. Home: K-TAXBACK title, category chips, Best/New/Sale/Price buttons, search, actual source product 2-column grid, lazy more and four languages (zh_cn, zh_tw, jp, en; vi_vn excluded).
2. Detail: source image swiper, translated real product title, actual USD price, source options, details, quantity, local wishlist and local shopping bag.
3. Former travel services menu accessible via airplane tab; shopping item navigates to K-TAXBACK.

## Production APIs
- GET https://prebook-api-production-9b80.up.railway.app/v1/ktaxback/miniapp/home?lang=zh_cn
- GET https://prebook-api-production-9b80.up.railway.app/v1/ktaxback/miniapp/products?lang=jp&category=1000000008&page=1&size=20
- GET https://prebook-api-production-9b80.up.railway.app/v1/ktaxback/miniapp/products/GA210003713?lang=zh_tw

K-TAXBACK original prdt_no, category IDs and source USD are unchanged. Images use Olive Young's original HTTPS image CDN relative paths; image-domain availability and usage rights must be validated prior to public commercial release.

## How to preview
- Import miniapps/wechat in WeChat Developer Tools.
- Import miniapps/alipay in Alipay Mini Program Studio.
- Configure each platform's real application ID and HTTPS request/image domain allowlist. Request domain: prebook-api-production-9b80.up.railway.app; source image domain: cdn-image.oliveyoung.com.
- Check language, cards, category, search, detail image/option, local bag and return to travel services in both simulators and real devices.

Existing WeChat touristappid is IDE demo only. Platform authentication, merchant approval, signed native payment, paid order placement, refund eligibility and airport handoff are NOT part of this preliminary UI integration. Local bag is deliberately non-transactional and visibly labeled as unavailable for checkout.

## Code
Backend: backend/app/ktaxback_miniapp.py; tests: backend/tests/test_ktaxback_miniapp.py.
WeChat: miniapps/wechat/pages/shop/index.js, index.wxml, index.wxss, detail.js, detail.wxml, detail.wxss.
Alipay: miniapps/alipay/pages/shop/index.js, index.axml, index.acss, detail.js, detail.axml, detail.acss.
The original React V3 source is preserved; these are native UI adaptations, not an iframe or fabricated replacement.
