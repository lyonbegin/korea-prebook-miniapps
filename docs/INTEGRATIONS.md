# Provider contracts (planned; no live integration yet)

**Future ConsultationProvider** (external SDK): `createSession(customerId,locale,itineraryId)`, `openSession(sessionId)`, `publishContext(sessionId,serviceKind,referenceId)`. The consultation engine is not part of this project.

**MotelSupplier**: `searchEarlyCheckin(propertyId,date,time)`, `hold`, `confirm`, `cancel`.
**ClinicPartner**: `findVisitSlot`, `requestAppointment`, `confirm/cancel`.
**ShoppingMerchant**: product catalog, price, verified stock, order lifecycle.
**LodgingDelivery**: `confirmParcelAcceptance`, `receive`, `dispatch`, `proofOfDelivery`.
**AirportHandoff**: counter acceptance and custody chain at public area; bonded duty-free separated.
**PaymentAdapter**: server-side intent, signed webhook, refund, reconciliation and idempotency.

Privacy: app login identities are not trusted without server-side code exchange/verification. Do not embed merchant API secrets in miniapp client.
