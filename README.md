# KOREA-PREBOOK · Korea Pre-Arrival Miniapps

Independent project for a Korean company's **WeChat and Alipay** miniapps. Positioning: **reserve or purchase before arriving in Korea**.

## Business services
1. Motel-first early check-in reservation, using actual available arrival times.
2. Korean clinic appointment inquiries and partner booking.
3. Korean online goods pre-purchased from abroad; ship to a customer's registered motel/hotel.
4. Departure-day ordinary-goods airport pickup and hotel-to-airport luggage transfer reservations.

The existing AI/human consultation system is **out of scope**. Integrate through an SDK/API later. LINE and Xiaohongshu are excluded from this release.

## Structure
- `miniapps/wechat`: native WXML/WXSS miniapp
- `miniapps/alipay`: native AXML/ACSS miniapp
- `backend`: FastAPI + SQLAlchemy inquiry prototype (not actual booking)
- `docs`: development plan, vendor approvals, integration boundaries

## Local test
```bash
cd backend
python -m pip install -r requirements-dev.txt
PYTHONPATH=. pytest -q
DEMO_WRITE_KEY=local-test-key uvicorn app.main:app --reload
```
API: `/health`, `/v1/catalog`, and demo-only inquiry endpoints.

## Railway
Use repository root as build context and the root `Dockerfile`. In production configure `APP_ENV=production` and a managed PostgreSQL `DATABASE_URL` (the Python `postgresql+psycopg://` dialect is supported). The production inquiry-write endpoint is intentionally disabled pending authenticated platform login.

## Release gates
Merchant account, miniapp IDs, category approvals (motel, clinic, shopping, logistics), cross-border payments, registered request domains, supplier inventory, and native-device/platform reviews are **pending**. No actual checkout or confirmed reservation exists in this starter.
