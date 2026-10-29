"""Link Grok item images to items: sets images.grok on each item whose slug has a file in images/grok/.
Exact slug matches are linked automatically. The few files named differently are listed explicitly below,
so nothing is guessed. Run from the ragman repo: python -I scripts/link-grok.py ../ragman-data
"""
import json, os, sys
root = sys.argv[1] if len(sys.argv) > 1 else '../ragman-data'
inv_path = os.path.join(root, 'inventory.json')
inv = json.load(open(inv_path, encoding='utf-8'))
grok = sorted(os.listdir(os.path.join(root, 'images', 'grok')))
# Files whose name is not the item slug. Checked by hand on Oct 29, 2026.
explicit = {
    'anker-733': 'anker-733-power-bank-gold-full.jpg',
    'apple-watch-ultra-4': 'apple-watch-ultra-4-natural-titanium-dark-umber-trail-loop-01.jpg',
    'macbook-pro-14': 'macbook-pro-14-silver-closed-lid.jpg',
    'jins-new-classic-221': 'jins-new-classic-no1-221.jpg',
    'mw-drift': 'mission-workshop-drift-black-camo.jpg',
}
linked = 0
for slug, item in inv['items'].items():
    f = explicit.get(slug)
    if f is None and f'{slug}.jpg' in grok:
        f = f'{slug}.jpg'
    if f is None:
        continue
    assert f in grok, f
    item.setdefault('images', {})['grok'] = f'grok/{f}'
    linked += 1
json.dump(inv, open(inv_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
open(inv_path, 'a', encoding='utf-8').write('\n')
print(f'linked {linked} of {len(inv["items"])} items')
