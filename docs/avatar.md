# Avatar and worn layers

The character on the Gear screen is dressed by what the active loadout equips. It is a base figure plus one transparent layer per worn item, all drawn on the same fixed pose, stacked in slot order.

## Base figure

- One drawing, `images/avatar/base.png`, 768x1536 (a 3:6 portrait frame), transparent background.
- Full-length, standing, facing forward, feet slightly apart, arms held a little away from the body so sleeves and wrists read. The same pose forever: every layer is drawn to it.
- Wearing only a plain fitted grey base: a plain short-sleeve undershirt and plain shorts, barefoot, no accessories, no glasses. Everything else comes from layers.
- Slightly anime inspired: clean linework, soft cel shading, muted natural colors, no exaggerated features. Short dark hair, calm half smile, in the manner of the Shen Wen portrait.

## Worn layers

- One file per wearable item, `images/worn/<slug>.png`, same 768x1536 canvas as the base, transparent everywhere except the garment.
- Drawn as worn by the base figure, same pose, same scale, same camera, same light. The figure itself is not in the file; only the garment, with the folds and shadows the body gives it.
- Stack order, bottom to top: base, Underwear, Socks, Legs, Torso Base, Torso Mid, Torso Outer, Feet, Hands, Neck, Eyes, Head, Wrist. A later layer covers an earlier one where they overlap, so a jacket covers a shirt collar.
- Alignment: the script `scripts/worn-fit.py` (part of v1) takes Grok's output of the figure wearing the garment, removes the white background, and saves the layer at base size. Because Grok cannot leave the body out reliably, the prompt asks for the figure wearing the garment over the plain grey base; the script then keeps only pixels that differ from the base figure by more than a threshold, which isolates the garment. Items with no worn layer yet show in their slot box only, and the figure wears the base.

## Prompting

Base and layers are generated in one Grok conversation so the layers can reference the base image. First message produces the base. Each later message: "Draw the figure from image 1 wearing {garment}, same pose, same scale, same framing, same style; the garment exactly as in the maker's product photos; everything else unchanged."

## Script

Run from the repo folder. Grok's downloads go in `images/grok/avatar/` first.

- `python -I -X utf8 scripts/worn-fit.py --install-base <grok-image> --data ../ragman-data` cuts the white background, fits the whole frame onto the 768x1536 canvas, saves `images/avatar/base.png` and a preview on `--page` grey (`--paper #RRGGBB` overrides) in `images/avatar/preview/`.
- `python -I -X utf8 scripts/worn-fit.py <slug> [<slug2> ...] <grok-image> --data ../ragman-data` fits the figure-wearing-the-garment image the same way, aligns the head to the base, keeps the pixels that differ from the base (`--threshold`, default 48 RGB distance; `--open 0` for wire glasses frames), saves `images/worn/<first slug>.png` with a preview, and sets `images.worn` on every listed slug.
- `python -I -X utf8 scripts/worn-fit.py --selftest` runs the pipeline on synthetic images and prints pass or fail.

## Schema

`images.worn` on an item: path under the images folder, optional. Containers and electronics never have one.
