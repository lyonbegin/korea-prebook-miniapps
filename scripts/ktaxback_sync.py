"""Read-only streaming migration: C:\\tour\\ktaxback.db -> Railway K-TAXBACK catalogue.

Default excludes user/account/cart/order/checkout data, all reviews and source
crawler paths. Reviews must be explicitly opted into and author is redacted.
Never prints or stores the administrator token. Resumable by SQLite rowid.
"""
from __future__ import annotations

import argparse
import getpass
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import quote

BASE="https://prebook-api-production-9b80.up.railway.app"
TABLES = (
    "brands", "categories", "category_filters", "attribute_defs",
    "products", "product_options", "product_images", "product_details",
    "product_attributes", "product_relations", "product_translations",
    "product_names_i18n", "product_breadcrumb_i18n",
    "category_names_i18n", "category_filters_i18n",
    "home_corners", "home_corner_sets", "home_banners", "home_corner_products",
    "shop_collections", "shop_pickup_centers", "shop_price_offers", "shop_bundles",
)
OPTIONAL_REVIEWS=("reviews","review_media")
RETRY_CODES={429,500,502,503,504}

def request(base,token,endpoint,payload):
    url=base.rstrip("/")+endpoint
    data=json.dumps(payload,ensure_ascii=False,separators=(",",":")).encode("utf-8")
    headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"}
    err=None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,data=data,method="POST",headers=headers),timeout=90) as f:
                return json.loads(f.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body=exc.read(500).decode("utf-8","replace")
            if exc.code not in RETRY_CODES:
                raise RuntimeError(f"HTTP {exc.code} {endpoint}: {body[:350]}") from exc
            err=f"HTTP {exc.code} {body[:180]}"
        except (urllib.error.URLError,TimeoutError) as exc:
            err=str(exc)[:200]
        print(f"  network retry {attempt+1}/5: {err}",file=sys.stderr)
        time.sleep(min(15,2**attempt))
    raise RuntimeError("Server not reachable after retry: "+str(err))

def read_sqlite(db):
    uri="file:"+quote(Path(db).resolve().as_posix(),safe="/:")+"?mode=ro"
    c=sqlite3.connect(uri,uri=True,timeout=30)
    c.row_factory=sqlite3.Row
    c.execute("PRAGMA query_only=ON")
    return c

def schema(conn,table):
    return [dict(row) for row in conn.execute('PRAGMA table_info("'+table+'")')]

def safe_value(v):
    if isinstance(v,bytes):
        raise RuntimeError("Unexpected binary column: audit catalogue source")
    return v

def main():
    ap=argparse.ArgumentParser(description="Stream approved K-TAXBACK product catalogue to Railway without copying private records.")
    ap.add_argument("--db",default=r"C:\tour\ktaxback.db")
    ap.add_argument("--server",default=BASE)
    ap.add_argument("--batch-size",type=int,default=100)
    ap.add_argument("--state",default=str(Path.home()/"Downloads"/"ktaxback_import_checkpoint.json"))
    ap.add_argument("--dry-run",action="store_true")
    ap.add_argument("--include-reviews",action="store_true",help="Include public reviews with author removed")
    ap.add_argument("--only",default="",help="Comma-separated allowlisted tables")
    args=ap.parse_args()
    if args.batch_size<1 or args.batch_size>200:
        ap.error("--batch-size must be 1..200")
    if not args.server.startswith("https://"):
        ap.error("Server must use HTTPS")
    conn=read_sqlite(args.db)
    available={x[0] for x in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    selected=list(TABLES)+(list(OPTIONAL_REVIEWS) if args.include_reviews else [])
    if args.only:
        only=set(s.strip() for s in args.only.split(","))
        if not only.issubset(set(selected)):
            ap.error("--only includes unsupported or non-opted-in tables")
        selected=[s for s in selected if s in only]
    selected=[s for s in selected if s in available]
    total=0
    for table in selected:
        count=conn.execute('SELECT COUNT(*) FROM "'+table+'"').fetchone()[0]
        print(f"{table}: {count:,} records")
        total+=count
    print(f"Selected tables: {len(selected)}; catalogue records: {total:,}")
    print("Excluded: users, orders, carts, wishlist, accounts, checkout, session data, seed_progress")
    if args.dry_run:
        print("DRY RUN complete; no network request and no database changes.")
        return
    token=os.getenv("ADMIN_API_TOKEN") or getpass.getpass("Railway prebook API administrator token: ")
    if not token:
        raise SystemExit("Administrator token is required")
    state_path=Path(args.state)
    state=json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}
    dbstat=Path(args.db).stat()
    identity=f"{Path(args.db).resolve()}:{dbstat.st_size}:{dbstat.st_mtime_ns}"
    if state.get("source")!=identity:
        state={"source":identity,"rows":{}}
    for table in selected:
        cols=schema(conn,table)
        if not cols:continue
        print(f"\n{table}: schema registration")
        request(args.server,token,"/manager/api/ktaxback/schema",{"name":table,"columns":[
            {"name":c["name"],"type":c["type"],"notnull":c["notnull"],"pk":c["pk"]} for c in cols
        ]})
        cursor=int(state["rows"].get(table,0))
        imported=0
        while True:
            batch=conn.execute('SELECT rowid AS __rowid__, * FROM "'+table+
                               '" WHERE rowid>? ORDER BY rowid LIMIT ?',(cursor,args.batch_size)).fetchall()
            if not batch:break
            rows=[]
            for row in batch:
                payload={k:safe_value(row[k]) for k in row.keys() if k!="__rowid__"}
                if table in OPTIONAL_REVIEWS:
                    payload.pop("author",None) # author is never transferred
                rows.append(payload)
            request(args.server,token,"/manager/api/ktaxback/import/"+table,{"rows":rows})
            cursor=int(batch[-1]["__rowid__"])
            imported+=len(rows)
            state["rows"][table]=cursor
            temporary=state_path.with_suffix(state_path.suffix+".tmp")
            temporary.parent.mkdir(parents=True,exist_ok=True)
            temporary.write_text(json.dumps(state,ensure_ascii=False),encoding="utf-8")
            temporary.replace(state_path)
            if imported%2000<len(rows):
                print(f"  {table}: +{imported:,} rows; cursor={cursor}")
        print(f"  {table} complete; this run +{imported:,} rows")
    conn.close()
    print("Catalogue sync completed. Source SQLite was opened read-only.")
    print("Check /manager/api/ktaxback/status with your administrator token.")

if __name__=="__main__":
    main()
