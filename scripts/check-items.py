"""Check a batch of Ragman item records before they are merged into inventory.json.

Usage:
  python -I scripts/check-items.py <batch.json> [--data <ragman-data dir>]

A batch is a vendor stock file (vendors/<vendor>.json) or an inbox file (inbox/<date>.json): a JSON object
with an "items" map of slug -> item record, and for a stock file a "vendor" object. Each record is checked
against the item definition in schema/inventory.schema.json; slugs are checked against the slug pattern and
against the inventory for collisions; category, status, location and tags are checked against the lists in
use; any text that mentions a price is refused. Needs the jsonschema package (pip install jsonschema).
"""
import argparse, json, os, re, sys

try:
    import jsonschema
except ImportError:
    sys.exit("jsonschema is not installed: pip install jsonschema")

ap = argparse.ArgumentParser()
ap.add_argument("batch")
ap.add_argument("--data", default=os.path.join(os.path.dirname(__file__), "..", "..", "ragman-data"))
a = ap.parse_args()

root = os.path.join(os.path.dirname(__file__), "..")
schema = json.load(open(os.path.join(root, "schema", "inventory.schema.json"), encoding="utf-8"))
batch = json.load(open(a.batch, encoding="utf-8"))
inv_path = os.path.join(a.data, "inventory.json")
inv = json.load(open(inv_path, encoding="utf-8")) if os.path.exists(inv_path) else None

item_schema = {"$ref": "#/$defs/item", "$defs": schema["$defs"]}
validator = jsonschema.Draft202012Validator(item_schema)
slug_re = re.compile(schema["$defs"]["slug"]["pattern"])
price_re = re.compile(r"(\$|€|£|¥|₫|\b(?:RM|USD|EUR|TWD|VND|MYR)\b|\bprices?\b|\bcost\b|\bsale\b|\bdiscount)", re.I)

settings = inv["settings"] if inv else None
known_tags = {"laptop", "flat", "band", "liquid", "eyewear"}
errors, warnings = [], []
items = batch.get("items")
if not isinstance(items, dict):
    sys.exit("the batch needs an 'items' object of slug -> record")
if "vendor" in batch:
    v = batch["vendor"]
    for k in ("id", "name"):
        if not v.get(k):
            errors.append(f"vendor.{k} is missing")
    if v.get("id") and not slug_re.match(v["id"]):
        errors.append(f"vendor.id '{v['id']}' is not a slug")

for slug, rec in items.items():
    where = f"items.{slug}"
    if not slug_re.match(slug):
        errors.append(f"{where}: slug does not match {slug_re.pattern}")
    if inv and slug in inv["items"]:
        errors.append(f"{where}: slug already exists in inventory.json")
    for e in sorted(validator.iter_errors(rec), key=lambda e: list(e.path)):
        path = ".".join(str(p) for p in e.path) or "(record)"
        errors.append(f"{where}.{path}: {e.message}")
    if settings:
        if rec.get("category") not in settings["categories"]:
            errors.append(f"{where}.category: '{rec.get('category')}' is not one of {settings['categories']}")
        if "status" in rec and rec["status"] not in settings["statuses"]:
            errors.append(f"{where}.status: '{rec['status']}' is not one of {settings['statuses']}")
        if "location" in rec and rec["location"] not in settings["locations"]:
            errors.append(f"{where}.location: '{rec['location']}' is not one of {settings['locations']}")
    for t in rec.get("tags", []):
        if t not in known_tags:
            warnings.append(f"{where}.tags: '{t}' is not a tag the app knows ({sorted(known_tags)})")
    if rec.get("weightEstimated") and rec.get("weight_g") is None:
        errors.append(f"{where}: weightEstimated without weight_g")
    text = json.dumps(rec, ensure_ascii=False)
    if price_re.search(text):
        errors.append(f"{where}: mentions a price or currency; prices never enter Ragman")
    if not rec.get("makerUrl"):
        warnings.append(f"{where}: no makerUrl")
    if not (rec.get("hidden") or {}).get("source"):
        warnings.append(f"{where}: hidden.source is empty; say where the values came from")
    photo = (rec.get("images") or {}).get("photo")
    if photo and not os.path.exists(os.path.join(a.data, "images", photo)):
        warnings.append(f"{where}: images.photo '{photo}' is not in the images folder yet")

for w in warnings:
    print("warn ", w)
for e in errors:
    print("ERROR", e)
print(f"{len(items)} records, {len(errors)} errors, {len(warnings)} warnings")
sys.exit(1 if errors else 0)
