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
APP_ENV=demo uvicorn app.main:app --reload
```
API: `/health`, `/v1/catalog`, and demo-only inquiry endpoints.

## Railway
Deploy to **existing** Railway project `thriving-education` ONLY, with service `prebook-api` and the existing `pgvector` PostgreSQL service. Never create a separate Railway project or database. The database table is prefixed `korea_prebook_inquiries` to avoid collisions. 

Use repository root as build context and the root `Dockerfile`. In production configure `APP_ENV=production` and a managed PostgreSQL `DATABASE_URL` (the Python `postgresql+psycopg://` dialect is supported). The production inquiry-write endpoint is intentionally disabled pending authenticated platform login.

## Release gates
Merchant account, miniapp IDs, category approvals (motel, clinic, shopping, logistics), cross-border payments, registered request domains, supplier inventory, and native-device/platform reviews are **pending**. No actual checkout or confirmed reservation exists in this starter.


## Keyless functional consultation test — isolated feature branch

**Open:** https://prebook-keyless-consult-demo-production.up.railway.app/demo

This preview requires **no WeChat/Alipay credentials or authentication keys**. It uses an isolated demo Railway service and synthetic products with a separate SQLite database, and it never touches the existing production `prebook-api` database.

The UI includes two native-platform customer perspectives, an operator assignment queue, automatic private demo-room identifiers, and a browser-based two-peer WebRTC camera/microphone test. WeChat/Alipay native miniapp sources on `feature/consultation-functional-demo-no-keys-20261104` point to this demo API, without changing the main branch.

Please test the client flow first. Real miniapp-hosted video, production HITEL SDK, platform approvals, bookings and payments are **not yet verified**.

See [step-by-step demo test guide](docs/functional-keyless-demo.md).
