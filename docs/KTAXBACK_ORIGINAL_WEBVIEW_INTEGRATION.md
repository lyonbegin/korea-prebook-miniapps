# Original K-TAXBACK H5 inside WeChat and Alipay Mini Programs

## Source and scope
- Single original React H5 shopping page: https://ktaxback-original-live-production.up.railway.app/k-taxback-shop.html
- No native page reimplementation, no recreated pink banners or native product grid.
- Source remains on Railway; both Mini Programs use `<web-view>` to display the exact same source and data.
- All original React navigation (11 logical screens), language picker (en/jp/vi_vn/zh_cn/zh_tw), product detail and read-only cart/wishlist are inside the H5 web view.
- Neither Mini Program currently enables payments or real checkout.

## Mini Program navigation
- Both `app.json` manifests start at `pages/index/index` (travel-service menu).
- Selecting `korea_online_shopping` already navigates to `/pages/shop/index` in both platforms.
- `pages/shop/index` renders one full-screen `web-view` with `shopWebUrl` from `app.js`.
- Platform back navigation returns to the travel menu.
- Legacy native `pages/shop/detail` is still included for backwards-compatible old deep links, not used in the primary flow.

## Publishing gates (merchant platform administration)
1. Replace WeChat `project.config.json` placeholder `touristappid` with the real WeChat Mini Program AppID; supply the Alipay Mini Program AppID through the Alipay Developer Tools project configuration.
2. WeChat: log in to WeChat Official Accounts Platform -> Development Management -> Development Settings -> Business Domain (`业务域名`). Register `ktaxback-original-live-production.up.railway.app` and complete the domain verification challenge. Corporate Mini Program privileges, host/domain ownership and regulatory requirements apply.
3. Alipay: Mini Program platform -> Development Settings -> H5 Domain Whitelist (`H5域名配置`); register and verify the same hostname. Alipay requires a merchant-controlled eligible domain; verify whether a custom domain and filing are required in your merchant region.
4. Domain allowlists are independent of the Mini Program `request` domain. The H5 uses the same-origin server proxy for K-TAXBACK JSON and ESM scripts.
5. Build and upload each native Mini Program with WeChat Developer Tools / Alipay Mini Program Studio; perform on-device inspection and submit for the platforms' review/release.

## Release checks
- Confirm `pages/index/index` displays the original prearrival five-service menu.
- Tap the shopping card; verify the original H5 K-TAXBACK screen loads inside the Mini Program, not the old simplified native screen.
- Within the web view inspect best/new/hot deal/K-pop/categories/detail/brands/wishlist/cart/account and all five language selections.
- Check network/web-view domain whitelist status on **physical WeChat and Alipay clients**. Simulator/browser success does not prove a Mini Program review or whitelist success.
- API source health: `https://ktaxback-original-live-production.up.railway.app/health`.

## Platform docs
- WeChat business domain: https://developers.weixin.qq.com/miniprogram/dev/component/web-view.html
- Alipay official web-view: https://github.com/AlipayDocs/open-docs/blob/main/mini/component/%E5%9F%BA%E7%A1%80%E7%BB%84%E4%BB%B6/%E5%BC%80%E6%94%BE%E7%BB%84%E4%BB%B6/web-view/web-view%20H5%20%E9%A1%B5%E9%9D%A2%E6%89%BF%E8%BD%BD.md
