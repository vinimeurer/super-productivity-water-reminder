#!/usr/bin/env python3
"""Validate the plugin and build dist/water-reminder.zip (files at the ZIP root)."""
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
FILES = ["manifest.json", "plugin.js", "index.html", "icon.svg"]
FALLBACK_RE = re.compile(
    r'(<script type="application/json" id="i18n-fallback">)(.*?)(</script>)', re.S
)


def flatten(obj, prefix=""):
    out = {}
    for k, v in obj.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            out.update(flatten(v, key))
        else:
            out[key] = v
    return out


def placeholders(s):
    return set(re.findall(r"\{\{(\w+)\}\}", s))


def main():
    errors = []
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    langs = manifest.get("i18n", {}).get("languages", [])

    # Translations: same keys and placeholders as en.json, files match manifest.
    tr = {}
    for lang in langs:
        path = ROOT / "i18n" / f"{lang}.json"
        if not path.exists():
            errors.append(f"manifest lists '{lang}' but {path.name} is missing")
            continue
        tr[lang] = flatten(json.loads(path.read_text(encoding="utf-8")))
    for path in (ROOT / "i18n").glob("*.json"):
        if path.stem not in langs:
            errors.append(f"{path.name} exists but '{path.stem}' is not in manifest i18n.languages")
    en = tr.get("en", {})
    for lang, data in tr.items():
        if lang == "en":
            continue
        for key in sorted(set(en) - set(data)):
            errors.append(f"{lang}: missing key {key}")
        for key in sorted(set(data) - set(en)):
            errors.append(f"{lang}: extra key {key}")
        for key in set(en) & set(data):
            if placeholders(en[key]) != placeholders(data[key]):
                errors.append(f"{lang}: placeholders differ in {key}")

    # Keys used in code must exist in en.json; unused keys are reported.
    used = set()
    for name in ("plugin.js", "index.html"):
        text = (ROOT / name).read_text(encoding="utf-8")
        used |= set(re.findall(r"['\"](WATER\.[A-Z0-9_]+)['\"]", text))
    for key in sorted(used - set(en)):
        errors.append(f"key used in code but missing in en.json: {key}")
    for key in sorted(set(en) - used):
        print(f"warning: unused key {key}")

    # Keep the HTML fallback identical to en.json.
    html_path = ROOT / "index.html"
    html = html_path.read_text(encoding="utf-8")
    en_json = json.dumps(
        json.loads((ROOT / "i18n" / "en.json").read_text(encoding="utf-8")),
        ensure_ascii=False,
    )
    new_html, n = FALLBACK_RE.subn(lambda m: m.group(1) + en_json + m.group(3), html)
    if n != 1:
        errors.append("index.html: i18n-fallback script tag not found")
    elif new_html != html:
        html_path.write_text(new_html, encoding="utf-8")
        print("index.html: fallback refreshed from i18n/en.json")

    if errors:
        print("\n".join(f"error: {e}" for e in errors))
        sys.exit(1)

    DIST.mkdir(exist_ok=True)
    out = DIST / f"{manifest['id']}.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for name in FILES:
            z.write(ROOT / name, name)
        for lang in langs:
            z.write(ROOT / "i18n" / f"{lang}.json", f"i18n/{lang}.json")
    digest = hashlib.sha256(out.read_bytes()).hexdigest()
    print(f"built {out.relative_to(ROOT)} ({out.stat().st_size} bytes)")
    print(f"sha256 {digest}")


if __name__ == "__main__":
    main()
