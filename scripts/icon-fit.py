"""Fit a Grok icon to its footprint canvas and register it in inventory.json.

Usage:
  python -I -X utf8 scripts/icon-fit.py <slug> <grok-image> --footprint WxH --data <ragman-data dir> [--prompt <text file>] [--no-rembg]

Steps (docs/icons.md, Post-processing):
  1. Remove the white background with rembg (alpha matting on); fall back to a flood fill if rembg is unavailable.
  2. Trim to the opaque bounding box.
  3. Scale so the longest side is 88% of the footprint canvas (128 px per cell), keeping aspect.
  4. Center on a transparent canvas of 128*W by 128*H.
  5. Save images/icons/<slug>.png, write <slug>.prompt.txt beside it, and a 56 px per cell preview under images/icons/preview/.
  6. Set the item's footprint and images.icon in inventory.json. If the item sits in a stash and no longer fits, re-place it in the first free spot.
"""
import argparse, json, os, sys
from collections import deque
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("slug"); ap.add_argument("image")
ap.add_argument("--footprint", required=True); ap.add_argument("--data", required=True)
ap.add_argument("--prompt"); ap.add_argument("--no-rembg", action="store_true")
a = ap.parse_args()
cw, ch = (int(x) for x in a.footprint.lower().split("x"))
src = Image.open(a.image).convert("RGBA")

def flood_cut(im):
    px = im.load(); W, H = im.size; seen = set(); q = deque([(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)])
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < W and 0 <= y < H): continue
        seen.add((x, y)); r, g, b, _ = px[x, y]
        if min(r, g, b) < 236: continue
        px[x, y] = (0, 0, 0, 0); q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    for y in range(H):
        for x in range(W):
            r, g, b, al = px[x, y]
            if al and min(r, g, b) > 200: px[x, y] = (r, g, b, max(0, min(255, int((245 - min(r, g, b)) * 255 / 45))))
    return im

cut = None
if not a.no_rembg:
    try:
        from rembg import remove
        cut = remove(src, alpha_matting=True, alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=10, alpha_matting_erode_size=4)
        method = "rembg"
    except Exception as e:
        print("rembg failed, using flood fill:", str(e)[:80])
if cut is None:
    cut = flood_cut(src); method = "flood"
bbox = cut.getbbox(); cut = cut.crop(bbox)

canvas = (128 * cw, 128 * ch); pad = 0.06
inner = (int(canvas[0] * (1 - 2 * pad)), int(canvas[1] * (1 - 2 * pad)))
ic = cut.copy(); ic.thumbnail(inner, Image.LANCZOS)
out = Image.new("RGBA", canvas, (0, 0, 0, 0))
out.alpha_composite(ic, ((canvas[0] - ic.width) // 2, (canvas[1] - ic.height) // 2))

icons = os.path.join(a.data, "images", "icons"); os.makedirs(os.path.join(icons, "preview"), exist_ok=True)
out.save(os.path.join(icons, f"{a.slug}.png"))
prev = out.copy(); prev.thumbnail((56 * cw, 56 * ch), Image.LANCZOS); prev.save(os.path.join(icons, "preview", f"{a.slug}.png"))
if a.prompt:
    text = open(a.prompt, encoding="utf-8").read().rstrip()  # read fully before any write: the prompt may be the log itself
    with open(os.path.join(icons, f"{a.slug}.prompt.txt"), "w", encoding="utf-8") as g:
        g.write(text + f"\nCut: {method}; canvas {canvas[0]}x{canvas[1]}; source {os.path.basename(a.image)}\n")

p = os.path.join(a.data, "inventory.json"); inv = json.load(open(p, encoding="utf-8")); items = inv["items"]
if a.slug not in items: sys.exit(f"{a.slug} is not in inventory.json")
it = items[a.slug]; it["footprint"] = [cw, ch]; it.setdefault("images", {})["icon"] = f"icons/{a.slug}.png"
h = it.get("home")
if h and h["kind"] == "stash":
    occ = set()
    for k, o in items.items():
        oh = o.get("home")
        if k != a.slug and oh and oh["kind"] == "stash" and oh["location"] == h["location"]:
            w, hh = o.get("footprint") or [1, 1]; occ.update((oh["x"] + i, oh["y"] + j) for i in range(w) for j in range(hh))
    W = inv["settings"]["stashWidth"]
    def fits(x, y): return x + cw <= W and all((x + i, y + j) not in occ for i in range(cw) for j in range(ch))
    if not fits(h["x"], h["y"]):
        y = 0
        while True:
            x = next((x for x in range(W) if fits(x, y)), None)
            if x is not None: break
            y += 1
        it["home"] = {"kind": "stash", "location": h["location"], "x": x, "y": y, "rotated": False}
json.dump(inv, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"{a.slug}: {method} cut, {canvas[0]}x{canvas[1]}, home {it.get('home')}")
