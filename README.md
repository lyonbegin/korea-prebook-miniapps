# KOREA-PREBOOK · Korea Pre-Arrival Miniapps

A standalone project for a Korean business to publish WeChat and Alipay miniapps. Customers prepare Korean reservations and purchases before arriving in Korea.

## Scope
- WeChat native miniapp: WXML, WXSS, wx API
- Alipay native miniapp: AXML, ACSS, my API
- Python/FastAPI common backend
- Motel early check-in reservation inquiries
- Clinic appointment inquiries
- Korea online pre-purchase: hotel/motel delivery
- Departure-day airport handoff and luggage transfer inquiries
- Existing consultation SDK is **not implemented here**; integrate later.

## Safety and reality checks
This starter is an **inquiry prototype**, not confirmed bookings, paid transactions, or an approved/registered Mini Program. No real inventory or payment is connected. Production protects demo-write operations; merchant onboarding, industry review and payment certification remain separate.

## Local backend
```bash
cd backend
pip install -r requirements-dev.txt
PYTHONPATH=. pytest -q
DEMO_WRITE_KEY=local-test uvicorn app.main:app --reload
```

Endpoints: `GET /health`, `GET /v1/catalog`, `POST /v1/inquiries` (demo-only), `GET /v1/inquiries/{id}` (demo-only).

See `docs/DEVELOPMENT_PLAN.md` and `docs/PLATFORM_CHECKLIST.md`. The API server has its own `backend/Dockerfile` and Railway should use `backend` as the service root.
