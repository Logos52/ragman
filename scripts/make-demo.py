"""Build the public demo inventory from a private ragman-data file, keeping the shape and dropping the facts.

    python -I -X utf8 scripts/make-demo.py ../ragman-data/inventory.json data/demo/inventory.json

Kept: settings, loadouts (slots, pockets, placements), archive, quick use, the task and objective structure, and for
every item its category, status, location, size, footprint, weight (and the estimate flag), tags, flags, quantity,
home, panels, attachment slots and attachment. Replaced: ids and names become "<kind> <n>", colours come from a
short generic list, tasks become "Task n" with "Objective n". Dropped: maker, maker URL, English name, note, lesson,
nickname, verified, images and hidden. `src/model/demo.test.ts` checks that nothing from the private file survives.
"""
import json, sys
from collections import OrderedDict

src, dst = sys.argv[1], sys.argv[2]
inv = json.load(open(src, encoding='utf-8'), object_pairs_hook=OrderedDict)

KIND = {
    'tops': 'Top', 'bottoms': 'Pants', 'outerwear': 'Jacket', 'underwear': 'Underwear', 'footwear': 'Shoes',
    'accessories': 'Accessory', 'electronics': 'Device', 'bags and cubes': 'Bag', 'consumables': 'Consumable',
    'furniture': 'Furniture',
}
COLORS = ['black', 'navy', 'grey', 'olive', 'white', 'tan', 'charcoal', 'sand']
KEEP = ['category', 'status', 'location', 'size', 'footprint', 'weight_g', 'weightEstimated', 'tags', 'staple',
        'consumable', 'specialCare', 'quantity', 'pinned', 'locked', 'home', 'panelLayout', 'panels',
        'attachmentSlots', 'attachedTo']

counts = {}
idmap = {}
for old, it in inv['items'].items():
    kind = KIND.get(it.get('category', ''), 'Item')
    counts[kind] = counts.get(kind, 0) + 1
    idmap[old] = f"{kind.lower().replace(' ', '-')}-{counts[kind]}"

def place(p):
    """Remap the item id inside a home or placement (panel homes name their container in `in`)."""
    if not isinstance(p, dict): return p
    q = OrderedDict(p)
    if q.get('kind') == 'panel' and q.get('in') in idmap: q['in'] = idmap[q['in']]
    return q

items = OrderedDict()
for n, (old, it) in enumerate(inv['items'].items()):
    new = OrderedDict()
    new['name'] = f"{KIND.get(it.get('category', ''), 'Item')} {idmap[old].rsplit('-', 1)[1]}"
    for k in KEEP:
        if k not in it: continue
        v = it[k]
        if k == 'home': v = place(v)
        if k == 'attachedTo' and isinstance(v, dict): v = OrderedDict(v); v['to'] = idmap.get(v['to'], v['to'])
        new[k] = v
    if it.get('color', '') != '': new['color'] = COLORS[n % len(COLORS)]
    new['images'] = OrderedDict()
    items[idmap[old]] = new

loadouts = OrderedDict()
for name, lo in inv['loadouts'].items():
    l2 = OrderedDict(lo)
    l2['placements'] = OrderedDict((idmap[i], place(p)) for i, p in lo.get('placements', {}).items() if i in idmap)
    loadouts[name] = l2

tasks = []
for ti, t in enumerate(inv.get('tasks', []), 1):
    t2 = OrderedDict()
    t2['id'] = f'task-{ti}'
    t2['title'] = f'Task {ti}'
    t2['description'] = ''
    t2['status'] = t.get('status', 'active')
    t2['itemId'] = idmap.get(t.get('itemId')) if t.get('itemId') else None
    objs = []
    for oi, o in enumerate(t.get('objectives', []), 1):
        o2 = OrderedDict([('text', f'Objective {oi}'), ('done', bool(o.get('done')))])
        a = o.get('auto')
        if a: o2['auto'] = OrderedDict([('item', idmap.get(a['item'], a['item'])), ('in', idmap.get(a['in'], a['in']))] + ([('loadout', a['loadout'])] if a.get('loadout') else []))
        else: o2['auto'] = None
        objs.append(o2)
    t2['objectives'] = objs
    if t.get('unlocks'): t2['unlocks'] = [f'task-{i + 1}' for i, x in enumerate(inv['tasks']) if x['id'] in t['unlocks']]
    tasks.append(t2)

out = OrderedDict()
for k, v in inv.items():
    if k == 'items': out[k] = items
    elif k == 'loadouts': out[k] = loadouts
    elif k == 'quickUse': out[k] = [idmap.get(i) if i else None for i in v]
    elif k == 'tasks': out[k] = tasks
    elif k == 'skills': out[k] = []
    else: out[k] = v

open(dst, 'w', encoding='utf-8', newline='\n').write(json.dumps(out, indent=2, ensure_ascii=False) + '\n')
print(f'{len(items)} items, {len(tasks)} tasks -> {dst}')
