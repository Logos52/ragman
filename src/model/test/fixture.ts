/** A small hand-made inventory for engine tests. Fresh copy per call. */
import type { Inventory } from '../types';

const SLOTS = ['Head', 'Eyes', 'Ears', 'Neck', 'Wrist', 'Torso Base', 'Torso Mid', 'Torso Outer', 'Hands', 'Legs',
  'Underwear', 'Socks', 'Feet', 'Pockets', 'Backpack', 'Carry-on', 'Pouch'];

export function fixture(): Inventory {
  return {
    version: 1,
    settings: {
      statuses: ['Daily', 'Rotation', 'Seasonal', 'Travel Only', 'Not Worn', 'Retired'],
      categories: ['tops', 'bottoms', 'accessories', 'electronics', 'bags and cubes'],
      locations: ['USA', 'Vietnam'],
      defaultSlots: SLOTS,
      stashWidth: 10,
    },
    items: {
      filson: {
        name: 'Filson', category: 'bags and cubes', footprint: [3, 4], weight_g: 1000, weightLimit_g: 2600, location: 'USA',
        panels: [
          { name: 'Main', grid: [6, 8], accepts: null, regions: [{ name: 'Laptop sleeve', at: [0, 0], size: [4, 3], accepts: ['laptop'] }] },
          { name: 'Glasses pocket', grid: [3, 3], accepts: null, regions: [] },
        ],
        home: { kind: 'stash', location: 'USA', x: 0, y: 0, rotated: false },
      },
      macbook: {
        name: 'MacBook', category: 'electronics', tags: ['laptop', 'flat'], footprint: [4, 3], weight_g: 1500, location: 'USA',
        home: { kind: 'panel', in: 'filson', panel: 'Main', x: 0, y: 0, rotated: false },
        hidden: { source: 'secret receipt' },
      },
      tee: {
        name: 'Tee', category: 'tops', footprint: [2, 2], weight_g: 200, location: 'USA', status: 'Daily',
        home: { kind: 'stash', location: 'USA', x: 3, y: 0, rotated: false },
      },
      cable: {
        name: 'Cable', category: 'electronics', footprint: [1, 2], location: 'USA',
        home: { kind: 'stash', location: 'USA', x: 5, y: 0, rotated: false },
      },
      watch: {
        name: 'Watch', category: 'accessories', footprint: [2, 2], weight_g: 60, attachmentSlots: ['band'], location: 'USA',
        home: { kind: 'stash', location: 'USA', x: 6, y: 0, rotated: false },
      },
      band: { name: 'Band', category: 'accessories', tags: ['band'], weight_g: 20, attachedTo: { to: 'watch', slot: 'band' }, home: null },
      'glasses-case': {
        name: 'Glasses case', category: 'accessories', footprint: [2, 1], location: 'USA',
        panels: [{ name: 'Main', grid: [2, 1], accepts: ['eyewear'], regions: [] }],
        home: { kind: 'stash', location: 'USA', x: 8, y: 0, rotated: false },
      },
      glasses: {
        name: 'Glasses', category: 'accessories', tags: ['eyewear'], footprint: [2, 1], weight_g: 25, location: 'USA',
        home: { kind: 'panel', in: 'glasses-case', panel: 'Main', x: 0, y: 0, rotated: false },
      },
      shirt: {
        name: 'Old shirt', category: 'tops', footprint: [2, 2], status: 'Not Worn', location: 'Vietnam',
        home: { kind: 'stash', location: 'Vietnam', x: 0, y: 0, rotated: false },
      },
    },
    loadouts: {
      Work: {
        slots: SLOTS.filter((s) => s !== 'Carry-on'),
        placements: { filson: { kind: 'slot', slot: 'Backpack' }, watch: { kind: 'slot', slot: 'Wrist' } },
      },
      Plane: {
        slots: SLOTS, pocketsGrid: [4, 1],
        placements: { filson: { kind: 'slot', slot: 'Backpack' }, tee: { kind: 'slot', slot: 'Torso Base' } },
      },
    },
    activeLoadout: 'Work',
    archive: { width: 10 },
    quickUse: ['macbook', null, null],
    tasks: [{
      id: 'pack', title: 'Pack', status: 'active', itemId: null,
      objectives: [
        { text: 'MacBook in the Filson', done: false, auto: { item: 'macbook', in: 'filson', loadout: 'Plane' } },
        { text: 'Tee worn', done: false, auto: { item: 'tee', in: 'Torso Base' } },
        { text: 'Loose one', done: true, auto: null },
      ],
    }],
    skills: [],
  } as Inventory;
}
