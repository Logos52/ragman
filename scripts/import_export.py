"""Import the Oct 2026 Notion/SQLite export into a Ragman inventory.json.

Usage: python -I scripts/import_export.py <inventory-export.json> <ragman-data dir>

Rules applied (see docs/PRD.md):
- Only owned items import. to_buy, rejected and given_away rows are skipped.
- Status is use-based: in_rotation yes -> Rotation, no -> Not Worn, unknown -> blank.
- Quantity N becomes N separate items with -2, -3 suffixes.
- Nothing is guessed: a field with no source stays blank. Location defaults to USA
  because every owned item is with Wedge in the USA at import time; this is the one
  assumption, and it is noted in the item note when the source said otherwise.
- Photos come from the store's own image URL recorded in Notion, saved under images/photos.
"""
import json, os, re, sys, urllib.request, time

EXPORT, DATA = sys.argv[1], sys.argv[2]
d = json.load(open(EXPORT, encoding="utf-8"))
rows = d["sqlite"]["tables"]["items"]
if isinstance(rows, dict): rows = rows.get("rows") or rows.get("data") or next(v for v in rows.values() if isinstance(v, list))
notion = {p["properties"].get("Item ID"): p["properties"] for p in d["notion"]["rows"] if p["properties"].get("Item ID") is not None}

CATEGORIES = ["tops", "bottoms", "outerwear", "underwear", "footwear", "accessories", "electronics", "bags and cubes", "consumables"]
SLOTS = ["Head", "Eyes", "Ears", "Neck", "Wrist", "Torso Base", "Torso Mid", "Torso Outer", "Hands", "Legs", "Underwear", "Socks", "Feet", "Pockets", "Backpack", "Carry-on", "Pouch"]
CAT_MAP = {"top": "tops", "shirt": "tops", "pants": "bottoms", "bottoms": "bottoms", "outer layer": "outerwear", "jacket": "outerwear", "coat": "outerwear", "underwear": "underwear", "socks": "underwear"}
NOTION_CAT = {"Tops": "tops", "Bottoms": "bottoms", "Outerwear": "outerwear"}
PERSONAL = {57: ("electronics", "iphone-air"), 58: ("electronics", "macbook-pro-14"), 59: ("electronics", "airpods-pro-3"), 60: ("electronics", "anker-733"), 61: ("bags and cubes", "filson-journeyman")}
SKIP_STATUS = {"to_buy", "rejected", "given_away"}
STATUS = {"yes": "Rotation", "no": "Not Worn", "unknown": ""}
SEASONAL = {40}
URL_RE = re.compile(r"https?://\S+")

def slug(s):
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return re.sub(r"-{2,}", "-", s)

def clean_note(n):
    if not n: return ""
    n = re.sub(r"page:\s*https?://\S+;?\s*", "", n)
    n = re.sub(r";?\s*https?://\S+\s*$", "", n)
    return n.strip(" ;")

items, photos_to_get = {}, {}
for r in rows:
    if r["status"] in SKIP_STATUS: continue
    rid = r["id"]; np = notion.get(rid, {})
    cat = PERSONAL.get(rid, (None,))[0] or CAT_MAP.get(r.get("category") or "", None) or NOTION_CAT.get(np.get("Category") or "", None) or ""
    if not cat and rid in (13, 14, 51): cat = "outerwear"
    if not cat and rid in (54, 55, 56): cat = "bottoms"
    base = PERSONAL.get(rid, (None, None))[1] or slug(" ".join(x for x in (r["name"], (r.get("colour") or "").split("(")[0].strip(), r.get("fit") or "") if x))
    maker_url = np.get("userDefined:URL") or ""
    if not maker_url:
        m = URL_RE.search((r.get("notes") or "") + " " + (r.get("source") or ""))
        maker_url = m.group(0).rstrip(";,") if m else ""
    status = "Seasonal" if rid in SEASONAL else STATUS.get(r.get("in_rotation") or "unknown", "")
    if r["status"] == "not_used": status = "Not Worn"
    if rid == 45: status = ""  # needs repair, not archived by choice
    note = clean_note(r.get("notes"))
    if r.get("location") == "packed_vn": note = ("Packed for Vietnam. " + note).strip()
    lesson = r.get("lesson") or ""
    if not lesson:
        if rid in (32, 33, 34): lesson = "Front and back fabric weights differ, so the back pulls down and the front rides up"
        elif rid == 38: lesson = "Itchy fabric"
        elif rid == 39: lesson = "Fit too skinny"
        elif rid in (35, 36): lesson = "Size M too small, L fits"
        elif rid == 2: lesson = "Not used, wears Muji boxers instead"
        elif rid == 30: lesson = "Prefers dark colours for this tee"
    care = r.get("care") or ""
    photo_url = np.get("Photo URL") or ""
    qty = r.get("quantity") or 1
    if rid == 53: qty = 1
    for n in range(1, qty + 1):
        sid = base if n == 1 else f"{base}-{n}"
        it = {
            "name": r["name"], "maker": "", "makerUrl": maker_url, "category": cat, "status": status, "location": "USA",
            "size": r.get("fit") or None, "color": r.get("colour") or "", "footprint": None, "weight_g": None, "tags": [],
            "staple": False, "consumable": False, "specialCare": care.lower().startswith("hard"),
            "note": note, "lesson": lesson, "images": {},
            "hidden": {"fabric": r.get("fabric") or "", "care": care, "source": r.get("source") or ""},
            "attachmentSlots": [], "attachedTo": None, "panels": [], "home": None,
        }
        if "machismo.com.tw" in maker_url: it["maker"] = "Machismo"
        if "uniqlo.com" in maker_url: it["maker"] = "Uniqlo"
        if "muji.us" in maker_url: it["maker"] = "Muji"
        if cat == "tops": it["footprint"] = [2, 2]
        if r.get("condition"): it["note"] = (it["note"] + " Condition: " + r["condition"]).strip()
        if photo_url:
            photos_to_get[base] = photo_url
            it["images"] = {"photo": f"photos/{base}.jpg"}
        items[sid] = it

# Personal items from the export
items["macbook-pro-14"].update({"maker": "Apple", "tags": ["laptop", "flat"], "footprint": [4, 3], "staple": True, "status": "Daily",
    "home": {"kind": "panel", "in": "filson-journeyman", "panel": "Main", "x": 0, "y": 0, "rotated": False}})
items["anker-733"].update({"maker": "Anker", "footprint": [2, 1], "staple": True, "status": "Daily",
    "home": {"kind": "panel", "in": "filson-journeyman", "panel": "Glasses pocket", "x": 0, "y": 0, "rotated": False}})
items["iphone-air"].update({"maker": "Apple", "staple": True, "status": "Daily"})
items["airpods-pro-3"].update({"maker": "Apple", "staple": True, "status": "Daily"})
items["filson-journeyman"].update({"maker": "Filson", "status": "Daily", "panels": [
    {"name": "Main", "grid": [6, 8], "accepts": None, "regions": [{"name": "Laptop sleeve", "at": [0, 0], "size": [4, 3], "accepts": ["laptop"]}]},
    {"name": "Glasses pocket", "grid": [3, 3], "accepts": None, "regions": []},
    {"name": "Front pouch", "grid": [4, 2], "accepts": None, "regions": []}]})

# Items Wedge stated in the Oct 28, 2026 interview, not in the export
SRC = "Wedge, Oct 28 2026 interview"
def stated(sid, **kw):
    it = {"name": "", "maker": "", "makerUrl": "", "category": "accessories", "status": "", "location": "USA", "size": None, "color": "",
          "footprint": None, "weight_g": None, "tags": [], "staple": False, "consumable": False, "specialCare": False, "note": "", "lesson": "",
          "images": {}, "hidden": {"fabric": "", "care": "", "source": SRC}, "attachmentSlots": [], "attachedTo": None, "panels": [], "home": None}
    it.update(kw); items[sid] = it
stated("apple-watch-ultra-4", name="Apple Watch Ultra 4, Titanium Natural", maker="Apple", status="Daily", footprint=[2, 2], attachmentSlots=["band"], staple=True)
stated("trail-loop-dark-umber-ml", name="Trail Loop, Dark Umber, M/L", maker="Apple", tags=["band"], attachedTo={"to": "apple-watch-ultra-4", "slot": "band"})
stated("trail-loop-burgundy-sm", name="Trail Loop, Burgundy, S/M", maker="Apple", tags=["band"], lesson="Wrong color and size, kept because it is small")
stated("jins-new-classic-221", name="JINS NEW CLASSIC No.1, model 221", maker="JINS", makerUrl="https://us.jins.com/collections/men-eyeglasses/products/jins-new-classic-221", status="Daily", tags=["eyewear"], footprint=[2, 1], staple=True,
       home={"kind": "panel", "in": "glasses-case-a", "panel": "Main", "x": 0, "y": 0, "rotated": False})
stated("glasses-case-a", name="Glasses case A", panels=[{"name": "Main", "grid": [2, 1], "accepts": ["eyewear"], "regions": []}], footprint=[2, 1])
stated("glasses-case-b", name="Glasses case B", panels=[{"name": "Main", "grid": [2, 1], "accepts": ["eyewear"], "regions": []}], footprint=[2, 1], note="Second case, usually empty")
stated("mw-drift", name="Mission Workshop Drift laptop tote, Black Camo", maker="Mission Workshop", category="bags and cubes", color="Black Camo",
       makerUrl="https://missionworkshop.com/products/drift-laptop-tote-bag?variant=31730589794413", status="Travel Only", panels=[
           {"name": "Main", "grid": [8, 7], "accepts": None, "regions": [{"name": "Laptop sleeve", "at": [0, 0], "size": [5, 3], "accepts": ["laptop"]}]},
           {"name": "Phone pocket", "grid": [1, 2], "accepts": None, "regions": []},
           {"name": "Organizer pocket", "grid": [3, 2], "accepts": None, "regions": []},
           {"name": "Mesh pocket A", "grid": [2, 2], "accepts": None, "regions": []},
           {"name": "Mesh pocket B", "grid": [2, 2], "accepts": None, "regions": []},
           {"name": "External flat pocket", "grid": [4, 3], "accepts": ["flat"], "regions": []},
           {"name": "Document pocket", "grid": [4, 3], "accepts": ["flat"], "regions": []}])
stated("sleeper-hold-travel-pillow", name="Sleeper Hold Travel Pillow", status="Travel Only", home={"kind": "panel", "in": "mw-drift", "panel": "Main", "x": 5, "y": 0, "rotated": False})
stated("ipad-m4", name="M4 iPad", maker="Apple", category="electronics", tags=["flat"], note="Model line not confirmed; fits the Drift's external flat pocket but stays out by choice")

# Pack everything without a home into the USA stash, 10 wide, first fit
W = 10; occupied = set()
def fits(x, y, w, h): return x + w <= W and all((x + i, y + j) not in occupied for i in range(w) for j in range(h))
def place(w, h):
    y = 0
    while True:
        for x in range(W):
            if fits(x, y, w, h):
                occupied.update((x + i, y + j) for i in range(w) for j in range(h)); return x, y
        y += 1
for sid, it in items.items():
    if it["home"] is None and it["attachedTo"] is None:
        w, h = it["footprint"] or [1, 1]
        x, y = place(w, h)
        it["home"] = {"kind": "stash", "location": "USA", "x": x, "y": y, "rotated": False}

inv = {
    "version": 1,
    "settings": {"statuses": ["Daily", "Rotation", "Seasonal", "Travel Only", "Not Worn", "Retired"], "categories": CATEGORIES,
                 "locations": ["USA", "Vietnam"], "defaultSlots": SLOTS, "stashWidth": W},
    "items": items,
    "loadouts": {
        "Work": {"slots": [s for s in SLOTS if s != "Carry-on"], "pocketsGrid": [4, 1], "placements": {
            "filson-journeyman": {"kind": "slot", "slot": "Backpack"}, "apple-watch-ultra-4": {"kind": "slot", "slot": "Wrist"}, "jins-new-classic-221": {"kind": "slot", "slot": "Eyes"}}},
        "Plane": {"slots": SLOTS, "pocketsGrid": [4, 1], "placements": {
            "filson-journeyman": {"kind": "slot", "slot": "Backpack"}, "mw-drift": {"kind": "slot", "slot": "Carry-on"},
            "apple-watch-ultra-4": {"kind": "slot", "slot": "Wrist"}, "jins-new-classic-221": {"kind": "slot", "slot": "Eyes"}}},
    },
    "activeLoadout": "Plane",
    "archive": {"width": W},
    "quickUse": ["macbook-pro-14"] + [None] * 9,
    "tasks": [
        {"id": "pack-vietnam", "title": "Pack for Vietnam", "description": "Items already marked as going to Vietnam in the export.", "status": "active", "itemId": None,
         "objectives": [
             {"text": "MacBook Pro in the Filson", "done": False, "auto": {"item": "macbook-pro-14", "in": "filson-journeyman", "loadout": "Plane"}},
             {"text": "Leaf jacquard open collar shirt packed", "done": False, "auto": None},
             {"text": "SOLOTEX Haori Suit packed, once it arrives", "done": False, "auto": None},
             {"text": "SOLOTEX Trousers packed, once they arrive", "done": False, "auto": None}]},
        {"id": "repair-hakama-cord", "title": "Repair the Hakama pants cord", "description": "Broken cord, not yet repaired.", "status": "active",
         "itemId": next(k for k, v in items.items() if v["name"].startswith("Hakama")), "objectives": [{"text": "Cord repaired or replaced", "done": False, "auto": None}]}],
    "skills": [],
}

os.makedirs(os.path.join(DATA, "images", "photos"), exist_ok=True)
got, failed = 0, []
for base, url in photos_to_get.items():
    dest = os.path.join(DATA, "images", "photos", f"{base}.jpg")
    if os.path.exists(dest): got += 1; continue
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as resp, open(dest, "wb") as f: f.write(resp.read())
        got += 1; time.sleep(0.3)
    except Exception as e:
        failed.append((base, str(e)[:60]))
        for it in items.values():
            if it["images"].get("photo") == f"photos/{base}.jpg": it["images"] = {}

with open(os.path.join(DATA, "inventory.json"), "w", encoding="utf-8") as f:
    json.dump(inv, f, ensure_ascii=False, indent=2)
print(f"items: {len(items)}  photos saved: {got}  failed: {failed}")
print("by category:", {c: sum(1 for i in items.values() if i['category'] == c) for c in CATEGORIES})
print("by status:", {s: sum(1 for i in items.values() if i['status'] == s) for s in [''] + inv['settings']['statuses']})
print("skipped export rows:", [r['id'] for r in rows if r['status'] in SKIP_STATUS])
