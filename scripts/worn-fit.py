"""Fit Grok's avatar art to the 768x1536 figure canvas: install the base figure, or cut a worn layer and register it in inventory.json.

Usage:
  python -I -X utf8 scripts/worn-fit.py --install-base <grok-image> --data <ragman-data dir> [--prompt <text file>] [--paper #RRGGBB] [--no-rembg]
  python -I -X utf8 scripts/worn-fit.py <slug> [<slug2> ...] <grok-image> --data <ragman-data dir> [--threshold N] [--open N] [--min-area N] [--prompt <text file>] [--no-align] [--no-rembg]
  python -I -X utf8 scripts/worn-fit.py --selftest

Steps (docs/avatar.md):
  1. Remove the white background with rembg (alpha matting on); fall back to a flood fill from the corners if rembg is unavailable.
  2. Scale the whole Grok frame to fit a transparent 768x1536 canvas, keeping aspect, and center it. Base and layers use the
     same rule, so a layer drawn in the same framing lands on the base.
  3. Base: save images/avatar/base.png and a preview on the app's light grey under images/avatar/preview/base.png. Stop.
  4. Layer: refuse if images/avatar/base.png is missing. Shift the image up to 20 px so the head outline matches the base
     (skip with --no-align).
  5. Keep the pixels that are outside the base figure, or whose RGB distance from the base is above --threshold (default 48 of 441).
  6. Clean the mask: an opening of --open px (default 3; 0 for wire frames) removes outline ghosts from a sub-pixel misfit,
     then drop opaque specks under --min-area pixels (default 150), fill holes under that size, grow 1 px into the soft edge.
  7. Save images/worn/<first slug>.png once, write <first slug>.prompt.txt beside it, and a preview over the base under images/worn/preview/.
  8. Set images.worn on every listed item in inventory.json. Several slugs share one layer (same garment in two sizes or units).
"""
import argparse, json, math, os, re, shutil, sys, tempfile
from collections import deque
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageMath, ImageStat

try:
    import numpy as np  # optional, only for speed
except ImportError:
    np = None

CW, CH = 768, 1536
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def flood_cut(im):
    """White background to transparent, from the four corners. Soft alpha only on light pixels next to the cut."""
    W, H = im.size; px = im.load(); bg = bytearray(W * H); q = deque([(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)])
    while q:
        x, y = q.popleft()
        if not (0 <= x < W and 0 <= y < H) or bg[y * W + x]: continue
        r, g, b, _ = px[x, y]
        if min(r, g, b) < 236: continue
        bg[y * W + x] = 1; px[x, y] = (0, 0, 0, 0); q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    for y in range(H):
        for x in range(W):
            if bg[y * W + x]: continue
            if not any(0 <= x + i < W and 0 <= y + j < H and bg[(y + j) * W + x + i] for i, j in ((1, 0), (-1, 0), (0, 1), (0, -1))): continue
            r, g, b, al = px[x, y]
            if al and min(r, g, b) > 200: px[x, y] = (r, g, b, max(0, min(255, int((245 - min(r, g, b)) * 255 / 45))))
    return im


def cut_bg(path, no_rembg):
    src = Image.open(path).convert("RGBA")
    if not no_rembg:
        try:
            from rembg import remove
            return remove(src, alpha_matting=True, alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=10, alpha_matting_erode_size=4), "rembg"
        except Exception as e:
            print("rembg failed, using flood fill:", str(e)[:80])
    return flood_cut(src), "flood"


def fit(cut):
    """Whole frame (not the bounding box) scaled to fit the canvas and centered: the same rule for base and layers."""
    s = min(CW / cut.width, CH / cut.height)
    im = cut.resize((max(1, round(cut.width * s)), max(1, round(cut.height * s))), Image.LANCZOS)
    out = Image.new("RGBA", (CW, CH), (0, 0, 0, 0)); out.alpha_composite(im, ((CW - im.width) // 2, (CH - im.height) // 2))
    return out


def shifted(im, dx, dy):
    out = Image.new(im.mode, im.size, 0); out.paste(im, (dx, dy)); return out


def align(base, layer, reach=20):
    """Translate layer so its head outline (top 18% of the base figure) matches the base. Returns (image, dx, dy)."""
    bb = base.getchannel("A").point(lambda v: 255 if v >= 128 else 0); box = bb.getbbox()
    if not box: return layer, 0, 0
    band = (max(0, box[0] - reach), box[1], min(CW, box[2] + reach), box[1] + int((box[3] - box[1]) * 0.18))
    lb = layer.getchannel("A").point(lambda v: 255 if v >= 128 else 0)

    def score(dx, dy, f=1):
        b = bb.crop(band); l = shifted(lb, dx, dy).crop(band)
        if f > 1: b = b.resize((b.width // f, b.height // f)); l = l.resize((l.width // f, l.height // f))
        return ImageStat.Stat(ImageChops.difference(b, l)).sum[0]

    best = min(((dx, dy) for dx in range(-reach, reach + 1, 4) for dy in range(-reach, reach + 1, 4)), key=lambda d: score(*d, f=2))
    best = min(((best[0] + i, best[1] + j) for i in range(-3, 4) for j in range(-3, 4)), key=lambda d: score(*d))
    return shifted(layer, *best), best[0], best[1]


def diff_mask(base, layer, threshold):
    """L image, 255 where the layer is opaque and either the base is transparent or the RGB distance exceeds threshold."""
    if np is not None:
        b = np.asarray(base, dtype=np.int32); l = np.asarray(layer, dtype=np.int32)
        d2 = ((l[..., :3] - b[..., :3]) ** 2).sum(axis=2)
        m = (l[..., 3] >= 128) & ((b[..., 3] < 128) | (d2 > threshold * threshold))
        return Image.fromarray((m * 255).astype(np.uint8), "L")
    br, bg_, bb, ba = base.split(); lr, lg, lb, la = layer.split()
    d2 = ImageMath.lambda_eval(lambda a: (a["r1"] - a["r2"]) * (a["r1"] - a["r2"]) + (a["g1"] - a["g2"]) * (a["g1"] - a["g2"]) + (a["b1"] - a["b2"]) * (a["b1"] - a["b2"]),
                               r1=lr.convert("I"), r2=br.convert("I"), g1=lg.convert("I"), g2=bg_.convert("I"), b1=lb.convert("I"), b2=bb.convert("I"))
    t2 = int(threshold * threshold)
    far = ImageMath.lambda_eval(lambda a: a["min"](a["max"](a["d"] - t2, 0), 1) * 255, d=d2).convert("L")
    outside = ba.point(lambda v: 255 if v < 128 else 0)
    return ImageChops.multiply(la.point(lambda v: 255 if v >= 128 else 0), ImageChops.lighter(far, outside))


def drop_small(mask, value, min_area):
    """Set every 4-connected region of `value` smaller than min_area to the other value; for 0, only regions off the border (holes)."""
    W, H = mask.size; data = bytearray(mask.tobytes()); seen = bytearray(W * H); other = 255 - value
    for start in range(W * H):
        if seen[start] or data[start] != value: continue
        comp = [start]; seen[start] = 1; i = 0; edge = False
        while i < len(comp):
            p = comp[i]; i += 1; x, y = p % W, p // W
            if x in (0, W - 1) or y in (0, H - 1): edge = True
            for n in (p - 1 if x else -1, p + 1 if x < W - 1 else -1, p - W, p + W):
                if 0 <= n < W * H and not seen[n] and data[n] == value: seen[n] = 1; comp.append(n)
        if len(comp) < min_area and not (value == 0 and edge):
            for p in comp: data[p] = other
    return Image.frombytes("L", (W, H), bytes(data))


def make_layer(base, layer, threshold, min_area, open_px):
    mask = diff_mask(base, layer, threshold)
    if open_px > 1: mask = mask.filter(ImageFilter.MinFilter(open_px)).filter(ImageFilter.MaxFilter(open_px))  # drops outline ghosts thinner than open_px
    mask = drop_small(mask, 255, min_area); mask = drop_small(mask, 0, min_area)
    soft = layer.getchannel("A").point(lambda v: 255 if v else 0)
    mask = ImageChops.lighter(mask, ImageChops.multiply(mask.filter(ImageFilter.MaxFilter(3)), soft))
    out = layer.copy(); out.putalpha(ImageChops.multiply(layer.getchannel("A"), mask))
    return out


def paper_color(arg):
    if arg: return arg, "--paper"
    css = open(os.path.join(ROOT, "src", "styles", "tokens.css"), encoding="utf-8").read()
    m = re.search(r"--page:\s*(#[0-9A-Fa-f]{6})", css)
    return (m.group(1), "--page in src/styles/tokens.css") if m else ("#F5F7FA", "fallback #F5F7FA")


def write_prompt(prompt, path, note):
    text = open(prompt, encoding="utf-8").read().rstrip()  # read fully before any write: the prompt may be the log itself
    with open(path, "w", encoding="utf-8") as g: g.write(text + note)


def install_base(a):
    cut, method = cut_bg(a.image, a.no_rembg); out = fit(cut)
    av = os.path.join(a.data, "images", "avatar"); os.makedirs(os.path.join(av, "preview"), exist_ok=True)
    out.save(os.path.join(av, "base.png"))
    hexc, src = paper_color(a.paper)
    prev = Image.new("RGBA", (CW, CH), hexc); prev.alpha_composite(out); prev.convert("RGB").save(os.path.join(av, "preview", "base.png"))
    if a.prompt: write_prompt(a.prompt, os.path.join(av, "base.prompt.txt"), f"\nCut: {method}; canvas {CW}x{CH}; source {os.path.basename(a.image)}\n")
    print(f"base: {method} cut, {CW}x{CH}, preview on {hexc} ({src})")


def fit_layer(a, slugs):
    base_p = os.path.join(a.data, "images", "avatar", "base.png")
    if not os.path.exists(base_p): sys.exit(f"{base_p} is missing. Install the base figure first: worn-fit.py --install-base <grok-image> --data {a.data}")
    p = os.path.join(a.data, "inventory.json"); inv = json.load(open(p, encoding="utf-8")); items = inv["items"]
    missing = [s for s in slugs if s not in items]
    if missing: sys.exit(f"not in inventory.json: {', '.join(missing)}")
    base = Image.open(base_p).convert("RGBA")
    if base.size != (CW, CH): sys.exit(f"{base_p} is {base.size[0]}x{base.size[1]}, expected {CW}x{CH}")
    cut, method = cut_bg(a.image, a.no_rembg); layer = fit(cut); dx = dy = 0
    if not a.no_align: layer, dx, dy = align(base, layer)
    out = make_layer(base, layer, a.threshold, a.min_area, a.open)
    worn = os.path.join(a.data, "images", "worn"); os.makedirs(os.path.join(worn, "preview"), exist_ok=True)
    name = slugs[0]; out.save(os.path.join(worn, f"{name}.png"))
    prev = base.copy(); prev.alpha_composite(out); prev.save(os.path.join(worn, "preview", f"{name}.png"))
    if a.prompt:
        write_prompt(a.prompt, os.path.join(worn, f"{name}.prompt.txt"),
                     f"\nCut: {method}; canvas {CW}x{CH}; shift {dx},{dy}; threshold {a.threshold}; open {a.open}; min area {a.min_area}; source {os.path.basename(a.image)}; items {', '.join(slugs)}\n")
    for s in slugs: items[s].setdefault("images", {})["worn"] = f"worn/{name}.png"
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        json.dump(inv, f, ensure_ascii=False, indent=2); f.write("\n")
    cover = out.getchannel("A").point(lambda v: 1 if v else 0).histogram()[1] * 100 / (CW * CH)
    print(f"{name}: {method} cut, shift {dx},{dy}, threshold {a.threshold}, layer covers {cover:.1f}% of the canvas; images.worn set on {', '.join(slugs)}")


def selftest():
    """Synthetic figure on white, then the same figure shifted 2 px with a red rectangle on the torso. Expect the rectangle back."""
    tmp = tempfile.mkdtemp(prefix="worn-fit-selftest-")
    try:
        def figure(path, rect, shift=(0, 0), specks=False):
            im = Image.new("RGB", (512, 1024), "white"); d = ImageDraw.Draw(im); sx, sy = shift
            grey = (150, 150, 155)
            d.ellipse((216 + sx, 60 + sy, 296 + sx, 160 + sy), fill=grey)                    # head
            d.rectangle((196 + sx, 170 + sy, 316 + sx, 520 + sy), fill=grey)                 # torso
            d.rectangle((150 + sx, 180 + sy, 186 + sx, 500 + sy), fill=grey)                 # arms, away from the body
            d.rectangle((326 + sx, 180 + sy, 362 + sx, 500 + sy), fill=grey)
            d.rectangle((200 + sx, 520 + sy, 248 + sx, 960 + sy), fill=grey)                 # legs, feet apart
            d.rectangle((264 + sx, 520 + sy, 312 + sx, 960 + sy), fill=grey)
            if rect: d.rectangle(tuple(v + (sx if i % 2 == 0 else sy) for i, v in enumerate(rect)), fill=(200, 40, 40))
            if specks:
                for x, y in ((230, 300), (280, 700), (220, 850)): d.point((x + sx, y + sy), fill=(60, 60, 60))
            im.save(path)
        rect = (210, 250, 300, 400)
        figure(os.path.join(tmp, "base-grok.png"), None)
        figure(os.path.join(tmp, "worn-grok.png"), rect, shift=(2, 1), specks=True)
        data = os.path.join(tmp, "data"); os.makedirs(data)
        json.dump({"items": {"tee-m": {"name": "Tee", "images": {}}, "tee-l": {"name": "Tee"}}}, open(os.path.join(data, "inventory.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        ns = argparse.Namespace(data=data, no_rembg=True, paper=None, prompt=None, threshold=48, min_area=150, open=3, no_align=False)
        install_base(argparse.Namespace(**vars(ns), image=os.path.join(tmp, "base-grok.png")))
        fit_layer(argparse.Namespace(**vars(ns), image=os.path.join(tmp, "worn-grok.png")), ["tee-m", "tee-l"])
        alpha = Image.open(os.path.join(data, "images", "worn", "tee-m.png")).getchannel("A")
        s = CH / 1024; r = (round(rect[0] * s), round(rect[1] * s), round((rect[2] + 1) * s) - 1, round((rect[3] + 1) * s) - 1)  # canvas px
        m = 2  # resampling blurs the rectangle's edge by up to 2 px; those pixels count as neither inside nor outside
        inside = outside = 0; px = alpha.load()
        for y in range(CH):
            for x in range(CW):
                if px[x, y] >= 128:
                    if r[0] <= x <= r[2] and r[1] <= y <= r[3]: inside += 1
                    elif not (r[0] - m <= x <= r[2] + m and r[1] - m <= y <= r[3] + m): outside += 1
        area = (r[2] - r[0] + 1) * (r[3] - r[1] + 1)
        inv = json.load(open(os.path.join(data, "inventory.json"), encoding="utf-8"))["items"]
        checks = [
            (f"layer covers the rectangle: {inside / area:.1%} (need 97%)", inside / area >= 0.97),
            (f"pixels outside the rectangle: {outside} = {outside / area:.2%} of its area (need under 1%)", outside / area < 0.01),
            ("both slugs point at worn/tee-m.png", inv["tee-m"]["images"].get("worn") == inv["tee-l"]["images"].get("worn") == "worn/tee-m.png"),
            ("one layer file written", sorted(os.listdir(os.path.join(data, "images", "worn"))) == ["preview", "tee-m.png"]),
        ]
        for text, ok in checks: print(("ok   " if ok else "FAIL ") + text)
        print("selftest " + ("pass" if all(ok for _, ok in checks) else "fail") + (" (numpy)" if np is not None else " (pure PIL)"))
        return all(ok for _, ok in checks)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


ap = argparse.ArgumentParser()
ap.add_argument("args", nargs="*", help="<slug> [<slug2> ...] <grok-image>")
ap.add_argument("--install-base", dest="install_base", metavar="GROK_IMAGE")
ap.add_argument("--data"); ap.add_argument("--prompt"); ap.add_argument("--paper", help="preview background, #RRGGBB")
ap.add_argument("--threshold", type=float, default=48); ap.add_argument("--min-area", dest="min_area", type=int, default=150)
ap.add_argument("--open", type=int, default=3, help="opening size in px (odd); 0 keeps hairlines such as wire glasses frames")
ap.add_argument("--no-align", dest="no_align", action="store_true"); ap.add_argument("--no-rembg", action="store_true")
ap.add_argument("--selftest", action="store_true")
a = ap.parse_args()
if a.selftest:
    sys.exit(0 if selftest() else 1)
if not a.data: ap.error("--data is required")
if a.install_base:
    if a.args: ap.error("--install-base takes no slugs")
    a.image = a.install_base; install_base(a)
else:
    if len(a.args) < 2: ap.error("give at least one slug and the Grok image")
    a.image = a.args[-1]; fit_layer(a, a.args[:-1])
