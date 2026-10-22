from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
for app, extension in [("wechat","wxml"),("alipay","axml")]:
    p = root / "miniapps" / app
    config = json.loads((p / "app.json").read_text())
    for page in config["pages"]:
        for ext in ("js",extension):
            assert (p / f"{page}.{ext}").is_file(), f"missing {p}/{page}.{ext}"
    assert (p / "app.js").is_file()
print("Miniapp directory structures OK")
