# UNNI 140-point additional deployment verification (2026-11-04)

## Actual Railway resources
- WeChat and Alipay emulators and unified console: KOREA-PREBOOK, project 2fb3dd38-5040-4293-9064-f75eca99beed.
- Original prebook-api, existing pgvector PostgreSQL, and separate UNNI frontend/backend: thriving-education, project 9359b723-c8e5-48ea-a0fb-69c7674b28b1.
- All five KOREA-PREBOOK services remained Online/SUCCESS without modification.

## Verified deployment facts
- Event 70809: Option 5, Shoulder Slimming Botox, LIZTOX, 100Unit; original USD 204.60, discount 20%, sale USD 163.68, KRW 220000.
- Event 70809: original and independent clone display the same 20 source direct-image URLs (20/20 match); one file declares originalImageHeight=4932. Pixel-level image matching was NOT performed.
- The five public Recommended to items appear as five separate LI elements on the deployed event page.
- Clinic 826: 10 photo gallery items, 9.7 rating, 10685 reviews, 5 highlights, weekly hours, address and map link.
- Doctor 1502: Seungmin Yoo, 9137 reviews. Incorrect App Download metadata was corrected in existing PostgreSQL.
- UNNI catalog tables contain 102 categories, 3 hospitals, 1 doctor, 3 events, 16 event options and 5 source provenance records; not the full source catalog.
- Isolated price-history table records price states on visit, deduplicates repeated values with a unique index and preserves origin no-store rules. 15 unique price observations were verified, of which 14 belong to event 70809.
- React and FastAPI deployment statuses SUCCESS with no critical/warning incidents and zero pending work.

## Live verification
- Mobile frontend: https://unni-mobile-web-production.up.railway.app/
- Event: https://unni-mobile-web-production.up.railway.app/events/70809?optionId=d195122c-ee11-4090-94c1-29a439508bdd
- Clinic: https://unni-mobile-web-production.up.railway.app/hospitals/826
- Doctor: https://unni-mobile-web-production.up.railway.app/doctors/1502
- Backend: https://unni-mobile-api-production.up.railway.app/health
- Public DB status: https://unni-mobile-api-production.up.railway.app/catalog/status
- Price history: https://unni-mobile-api-production.up.railway.app/catalog/events/70809/price-history
- Independent inquiry status: https://unni-mobile-api-production.up.railway.app/inquiries/health

## Remaining gaps; NOT a claim of full 140/140 completion
- Latest 140-point report states 62 observed in a limited deployed scope, 59 partial code or behavior, 15 unverified due access constraints and 4 backed by only a few database records.
- Original authenticated reviews, clinic chat delivery, official appointment confirmation/cancellation and payments cannot be verified or completed without supported provider contracts and authorization.
- Independent inquiry stores user-submitted requests in our PostgreSQL, but notifies no original UNNI provider and confirms no reservation.
- Source is private/no-store for its public HTML; unlicensed original HTML bytes are not retained. Commercial re-use of images requires rights clearance.
- Original native Compose and iPhone/Android real-device pixel-perfect QA remain unverified. GitHub Playwright workflow was authored, but a completed run log has not been verified.
