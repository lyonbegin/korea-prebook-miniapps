# K-TAXBACK Mini Program integration — historical native implementation

> **Superseded 2026-10-24.** This document previously described a separately constructed native K-TAXBACK UI. That implementation is no longer the live entry point.

## Current integration

Both WeChat and Alipay now render the **original unmodified K-TAXBACK React H5** inside their shopping entry pages using a single `web-view`. The common source URL is:

https://ktaxback-original-live-production.up.railway.app/k-taxback-shop.html

The app launches its existing pre-arrival travel-service menu first (`pages/index/index`). Choosing Korean online shopping navigates to `pages/shop/index`, where the original H5 is embedded. The old `pages/shop/detail` implementation remains only for compatibility with older deep links; it is not used by this entry flow.

The earlier descriptions of pink native banners, four-language native UI, native filters and bags were historical implementation details and **are not the current deployed Mini Program shop UI**.

Full integration, account configuration and device release details: [KTAXBACK_ORIGINAL_WEBVIEW_INTEGRATION.md](KTAXBACK_ORIGINAL_WEBVIEW_INTEGRATION.md).

Actual WeChat/Alipay release is still gated on merchant Mini Program AppIDs, H5 business-domain whitelist/verification, developer upload and platform review. GitHub source integration is not equivalent to publication in WeChat or Alipay.
