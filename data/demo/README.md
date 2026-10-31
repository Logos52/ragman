# Demo data

This folder feeds the public build at logos52.github.io/ragman. `inventory.json` is generated from the owner's private file by `scripts/make-demo.py`: it keeps the shape (categories, counts, footprints, weights, containers, loadouts, tasks) and replaces every fact (ids and names become "Top 12", colours come from a generic list; makers, URLs, notes, lessons, nicknames, images and hidden fields are dropped). `src/model/demo.test.ts` fails if any string from the private file survives.

Regenerate after the private file changes:

```
python -I -X utf8 scripts/make-demo.py ../ragman-data/inventory.json data/demo/inventory.json
```

Images for demo items would go in `images/icons/` and `images/photos/` beside this file; there are none, so every tile draws the grey placeholder with its name.
