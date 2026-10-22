# Korea Prebook development plan

## Goal
Korean operator's WeChat and Alipay miniapps for **advance booking and pre-purchase from overseas**. One FastAPI backend. Existing consultation system is attached later through an external SDK/API.

## Phase 0: publication approval gates
- Verify Korean merchant legal owner, miniapp AppID and authorized WeChat/Alipay service categories.
- Confirm early-check-in motel sales, cross-border clinic appointment arrangements, pre-arrival goods shopping and parcel delivery are individually approved categories.
- Obtain approved payment/acquiring, refund flow and signed webhook requirements.
- Secure motel inventory/early-checkin suppliers, clinic partners and lodging receiving policies.
- Stop any category the platform will not approve; no foreign shell-company assumption.

## Phase 1: platform adapters
- Native WeChat WXML/WXSS and Alipay AXML/ACSS apps, each with separate user login.
- Customer and travel itinerary with arrival/departure/flight/lodging, versioned REST backend, signed platform identity validation, idempotent order API.
- Unified account model stores only server-validated platform user identities.

## Phase 2: motel early-checkin
- Clock-time availability, supplier holds and confirmed bookings.
- Cancellation/refund rules, anti-double-booking and settlement.
- Do not infer inventory or promise unsupported check-in times.

## Phase 3: Korea online pre-purchase delivered to lodging
- Advance purchase from abroad; auto-use booked lodging address or manually register any receiving hotel/motel.
- Confirm parcel reception policy, guest alias, checkin date, receiving window.
- Optional consolidation and tracking, proof of receipt and incident workflow.

## Phase 4: clinic and airport
- Authorized clinic appointment requests; regulated overseas patient arrangement only through approved operator.
- Ordinary goods airport handoff and luggage-delivery providers; duty-free/bonded handoff separate.

## Phase 5: consultation
- External integration interface only: createSession, openSession, publishContext.
- Do NOT duplicate AI/WebRTC/server counseling code in this repository.

## Acceptance and testing
- Korean merchant verified; official app IDs and approved domains.
- Native vendor IDE and on-device tests.
- True supplier confirmation and server-validated payment.
- Five end-to-end cases (motel, clinic, shopping-to-lodging, airport goods, luggage), plus failure scenarios.
- No commercial launch before review, privacy, payments and supplier contracts.

## Railway status
Project: KOREA-PREBOOK, ID 2fb3dd38-5040-4293-9064-f75eca99beed. Deploy a public catalog/health read-only API. Writes remain disabled in production until server-side identity verification.
