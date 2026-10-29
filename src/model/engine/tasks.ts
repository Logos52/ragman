/**
 * Tasks: auto objectives resolve from placement; loose ones are ticked by hand.
 * auto = { item, in, loadout? }: done when the item's effective place in that loadout (default: active)
 * is inside container `in` (any panel, any depth) or in slot `in` (directly, or inside a container in that slot).
 * An auto objective's `done` is derived only; a missing item or loadout just never ticks.
 */
import type { Inventory, Objective, Task } from '../types';
import { ancestorsOf, effectivePlace, POCKETS_ID, POCKETS_PANEL, rootPlace } from './place';

export function objectiveDone(inv: Inventory, obj: Objective): boolean {
  const auto = obj.auto;
  if (!auto) return obj.done;
  const lo = auto.loadout ?? inv.activeLoadout;
  if (!inv.items[auto.item] || !inv.loadouts[lo]) return false;
  if (ancestorsOf(inv, auto.item, lo).includes(auto.in)) return true;
  const slotOf = (p: ReturnType<typeof effectivePlace>) =>
    !p ? null : p.kind === 'slot' ? p.slot : p.kind === 'panel' && p.in === POCKETS_ID ? POCKETS_PANEL : null;
  return slotOf(rootPlace(inv, auto.item, lo)) === auto.in;
}

export function tasksView(inv: Inventory): Task[] {
  return inv.tasks.map((t) => ({ ...t, objectives: t.objectives.map((o) => ({ ...o, done: objectiveDone(inv, o) })) }));
}

/** Plain text for paper or the phone: the title, then one "[ ] text" / "[x] text" line per objective. */
export function taskChecklist(task: Task): string {
  return [task.title, ...task.objectives.map((o) => `${o.done ? '[x]' : '[ ]'} ${o.text}`)].join('\n') + '\n';
}

/** When a task becomes completed, every task it lists in `unlocks` that is locked becomes active. MUTATES `inv`. */
function applyUnlocks(inv: Inventory, task: Task): void {
  for (const uid of task.unlocks ?? []) {
    const u = inv.tasks.find((t) => t.id === uid);
    if (u && u.status === 'locked') u.status = 'active';
  }
}

/** Set a task's status; a change to completed unlocks its `unlocks`. False when the task is missing or unchanged. */
export function setTaskStatus(inv: Inventory, id: string, status: Task['status']): boolean {
  const t = inv.tasks.find((x) => x.id === id);
  if (!t || t.status === status) return false;
  t.status = status;
  if (status === 'completed') applyUnlocks(inv, t);
  return true;
}

/** Edit a task; when the edit moves it to completed, its `unlocks` (as edited) unlock. False when it is missing. */
export function updateTask(inv: Inventory, id: string, patch: Partial<Task>): boolean {
  const t = inv.tasks.find((x) => x.id === id);
  if (!t) return false;
  const was = t.status;
  Object.assign(t, structuredClone(patch));
  if (t.status === 'completed' && was !== 'completed') applyUnlocks(inv, t);
  return true;
}
