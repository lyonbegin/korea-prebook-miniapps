#!/usr/bin/env python3
"""Strict screenshot comparison of ORIGINAL Android v6.50.0 against Railway clone.
All pixels are from real emulator/UI captures: no reconstructed original UI,
no generated/mocked provider data, no use of APKPure marketing screenshots.
Compares full screen plus content-only crop to isolate Android system bars.
"""
import json, html, os, pathlib
import numpy as np
from PIL import Image,ImageChops,ImageEnhance,ImageDraw,ImageFont
BASE=pathlib.Path(__file__).resolve().parent/"artifacts"
BASE.mkdir(exist_ok=True,parents=True)
LABELS=("home","medical-cost","telemedicine","hospital","mounjaro")
WIDTH,HEIGHT=390,844
THRESHOLD=25
def contain(arr):
    return Image.fromarray(arr.astype(np.uint8),"RGB")
def metrics(orig, web, key):
    x=np.asarray(orig.convert("RGB"),dtype=np.int16)
    y=np.asarray(web.convert("RGB"),dtype=np.int16)
    d=np.abs(x-y)
    mismatch=float((d.max(axis=2)>THRESHOLD).mean())
    mae=float(d.mean())
    rms=float(np.sqrt(np.mean(d.astype(np.float64)**2)))
    color=np.zeros_like(d,dtype=np.uint8)
    strength=np.clip(np.max(d,axis=2).astype(float)*2.6,0,255).astype(np.uint8)
    color[:,:,0]=strength
    color[:,:,1]=np.maximum(0,60-strength//4).astype(np.uint8)
    contain(color).save(BASE/f"pixel_diff_{key}.png")
    overlay=Image.blend(orig.convert("RGB"),web.convert("RGB"),.5)
    overlay.save(BASE/f"overlay_{key}.png")
    return dict(mismatch_pct=round(mismatch*100,3),
                matching_pct=round((1-mismatch)*100,3),
                mae=round(mae,3),rmse=round(rms,3),
                tolerance_rgb=THRESHOLD,
                diff=f"pixel_diff_{key}.png",overlay=f"overlay_{key}.png")
def verified_original_launch():
    """Reject launcher/splash captures, even when someone saved android_home.png."""
    log=BASE/"launch_result.txt"
    meta=BASE/"device_metadata.txt"
    if not log.is_file() or not meta.is_file():
        return False,"MISSING_PROVENANCE"
    launch=log.read_text(encoding="utf-8",errors="replace")
    metadata=meta.read_text(encoding="utf-8",errors="replace")
    if ("APP_LAUNCH_FAILED" in launch
        or "VERIFIED_TOP_ACTIVITY=" not in launch
        or not any("com.merakiplace.mydoctor" in line
                   for line in launch.splitlines()
                   if line.startswith("VERIFIED_TOP_ACTIVITY="))):
        return False,"ORIGINAL_APP_NOT_FOREGROUND"
    if ("Hermes expected user-uploaded SHA256" not in metadata
        or "Downloaded Hermes SHA256" not in metadata):
        return False,"NO_EXACT_HERMES_PROVENANCE"
    return True,"VERIFIED_RUNNING_ORIGINAL"
ORIGINAL_LAUNCH_OK, ORIGINAL_LAUNCH_REASON = verified_original_launch()
def compare(label):
    a,b=BASE/f"android_{label}.png",BASE/f"web_{label}.png"
    if not ORIGINAL_LAUNCH_OK:
        return dict(name=label,state="UNVERIFIED_ORIGINAL_LAUNCH",
                    reason=ORIGINAL_LAUNCH_REASON,
                    android_exists=a.exists(),web_exists=b.exists())
    if not a.is_file() or not b.is_file():
        return dict(name=label,state="MISSING_REFERENCE",
                    android_exists=a.exists(),web_exists=b.exists())
    original=Image.open(a).convert("RGB")
    clone=Image.open(b).convert("RGB")
    # Keep screenshot aspect ratio and label scaling explicitly.
    native_scaled=original.resize((WIDTH,HEIGHT),Image.Resampling.LANCZOS)
    web_scaled=clone.resize((WIDTH,HEIGHT),Image.Resampling.LANCZOS)
    native_scaled.save(BASE/f"android_scaled_{label}.png")
    web_scaled.save(BASE/f"web_scaled_{label}.png")
    full=metrics(native_scaled,web_scaled,label)
    # Remove only OS system status/navigation bars for a content-only diagnostic.
    # In a 1080x2340 Android image the approximate top and bottom system bars
    # are 24dp. This is an APPROXIMATION, not used for pixel-parity acceptance.
    scale=original.width/393.0
    top=round(24*scale); bottom=round(24*scale)
    if original.height<=top+bottom+500:
        crop=original
    else:
        crop=original.crop((0,top,original.width,original.height-bottom))
    crop=crop.resize((WIDTH,HEIGHT),Image.Resampling.LANCZOS)
    crop.save(BASE/f"android_content_{label}.png")
    content=metrics(crop,web_scaled,label+"_content")
    margin=8; title_h=34
    panel=Image.new("RGB",(WIDTH*3+margin*4,HEIGHT+title_h+margin*2),"#ffffff")
    draw=ImageDraw.Draw(panel)
    for i,(text,img) in enumerate([
      ("Original Android 6.50.0",native_scaled),
      ("Current Railway web",web_scaled),
      ("Strict pixel difference",Image.open(BASE/f"pixel_diff_{label}.png").convert("RGB"))
    ]):
        x=margin+(WIDTH+margin)*i
        draw.text((x+5,10),text,fill="#111111")
        panel.paste(img,(x,title_h+margin))
    panel.save(BASE/f"side_by_side_{label}.png")
    return dict(name=label,state="MEASURED",original_pixels=list(original.size),
                web_pixels=list(clone.size),normalized_pixels=[WIDTH,HEIGHT],
                strict=full,content_only_diagnostic=content,
                acceptance="PASS" if full["mismatch_pct"]<=10 else "FAIL",
                comparison=f"side_by_side_{label}.png")
out=dict(app="com.merakiplace.mydoctor",original_version="6.50.0",
  source="ACTUAL_RUNNING_ANDROID_OR_NONE",
  threshold="<=10% pixels differ by >25 RGB intensity",
  created_at_utc=__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
  records=[compare(name) for name in LABELS])
out["summary"]=dict(measured=sum(x["state"]=="MEASURED" for x in out["records"]),
  passed=sum(x.get("acceptance")=="PASS" for x in out["records"]),
  failed=sum(x.get("acceptance")=="FAIL" for x in out["records"]),
  missing=sum(x["state"]!="MEASURED" for x in out["records"]),
  provenance=ORIGINAL_LAUNCH_REASON)
(BASE/"pixel_parity_report.json").write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf-8")
def row(rec):
    name=html.escape(rec["name"]); state=rec["state"]
    if state!="MEASURED":
        return f"<section><h2>{name}: MISSING</h2><p>Original Android capture missing — no synthetic reference accepted.</p></section>"
    m=rec["strict"]
    return f"""<section><h2>{name} · {rec["acceptance"]} · {m["mismatch_pct"]}% pixels differ</h2>
       <p>Original: {rec["original_pixels"]}; Web: {rec["web_pixels"]};
       MAE: {m["mae"]}; RGB threshold ±25. Content-only diagnostic:
       {rec["content_only_diagnostic"]["mismatch_pct"]}%</p>
       <img alt="Original vs clone vs pixel differences" src="{rec["comparison"]}" width="100%">
       <p><a href="android_{name}.xml">Original Android accessibility hierarchy</a> ·
       <a href="overlay_{name}.png">50/50 overlay</a> ·
       <a href="pixel_diff_{name}.png">pixel difference</a></p></section>"""
HTML="""<!doctype html><html lang=ko><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>나만의닥터 6.50.0 — Original Android vs Railway Pixel Diff</title>
<style>body{font:15px system-ui;margin:20px auto;max-width:1200px;color:#222}
section{padding:16px 0;border-bottom:1px solid #ddd}img{display:block;max-width:100%;height:auto;border:1px solid #ddd}
h1{font-size:23px}h2{font-size:18px}p{line-height:1.6}</style></head><body>"""
HTML+="<h1>Original 6.50.0 Android Emulator → Railway Web · 1:1 pixel audit</h1>"
HTML+="<p>The original screenshots were captured from an installed Android application. No guessing from JS/Hermes or promotional images. A pixel PASS needs at least 90% of pixels within ±25 RGB per channel.</p>"
HTML+="".join(row(r) for r in out["records"])+("</body></html>")
(BASE/"index.html").write_text(HTML,encoding="utf-8")
print("NATIVE_PIXEL_REPORT",json.dumps(out["summary"]))
for x in out["records"]:
    print("PIXEL_SCREEN",x["name"],x["state"],x.get("strict",{}).get("mismatch_pct"),x.get("acceptance"))
if out["summary"]["measured"]<1:
    raise SystemExit("NO ORIGINAL ANDROID SCREEN WAS MEASURED")
if out["summary"]["missing"] or out["summary"]["failed"]:
    raise SystemExit("PIXEL_PARITY_NOT_ACHIEVED — open artifact side_by_side and fix web UI")
