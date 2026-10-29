import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../primitives/Button';
import { Chip } from '../primitives/Chip';
import type { ChipTone } from '../primitives/Chip';
import { EmptyState } from '../primitives/EmptyState';
import { SegmentedControl } from '../primitives/SegmentedControl';
import { TextField } from '../primitives/TextField';
import { Select } from '../primitives/Select';
import type { SelectOption } from '../primitives/Select';
import { Tile } from '../primitives/Tile';
import { useUi } from '../uiStore';
import { getStore, kebab, uniqueSlug, useImagesTick, useInv, useInventory } from '../app/useStore';
import type { Inventory, Objective, Task } from '../../model/types';
import './tasks.css';

const STATUS_TONE: Record<Task['status'], ChipTone> = { active: 'accent', completed: 'ok', locked: 'muted' };
const STATUS_LABEL: Record<Task['status'], string> = { active: 'Active', completed: 'Completed', locked: 'Locked' };

function TaskChip({ status }: { status: Task['status'] }) {
  return <Chip tone={STATUS_TONE[status]} size="sm">{STATUS_LABEL[status]}</Chip>;
}

/** Every item as a select option, by name (a chore's linked item, an auto objective's item). Blank first. */
function itemOptions(inv: Inventory | null, blank: string): SelectOption[] {
  if (!inv) return [{ value: '', label: blank }];
  const ids = Object.keys(inv.items).sort((a, b) => inv.items[a].name.localeCompare(inv.items[b].name) || a.localeCompare(b));
  return [{ value: '', label: blank }, ...ids.map((id) => ({ value: id, label: inv.items[id].name }))];
}

/** Where an auto objective can point: every container (by id) and every slot name of any loadout. */
function placeOptions(inv: Inventory | null): SelectOption[] {
  if (!inv) return [{ value: '', label: '' }];
  const containers = Object.keys(inv.items).filter((id) => (inv.items[id].panels ?? []).length)
    .sort((a, b) => inv.items[a].name.localeCompare(inv.items[b].name));
  const slots: string[] = [...inv.settings.defaultSlots];
  for (const lo of Object.values(inv.loadouts)) for (const s of lo.slots) if (!slots.includes(s)) slots.push(s);
  return [
    { value: '', label: '' },
    ...containers.map((id) => ({ value: id, label: `In ${inv.items[id].nickname || inv.items[id].name}` })),
    ...slots.map((s) => ({ value: s, label: `Slot: ${s}` })),
  ];
}

/** Inline "New task" form at the top of the list. A chore can be linked to an item. */
function NewTaskForm({ onDone }: { onDone: (id: string | null) => void }) {
  const inv = useInv();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [itemId, setItemId] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const s = getStore();
    const ids = new Set((s.inv?.tasks ?? []).map((x) => x.id));
    const id = uniqueSlug(kebab(t) || 'task', (k) => ids.has(k));
    s.addTask({ id, title: t, description: description.trim(), status: 'active', itemId: itemId || null, objectives: [] });
    onDone(id);
  };
  return (
    <form className="rg-tasks__new" onSubmit={submit}>
      <TextField variant="plain" value={title} onChange={setTitle} placeholder="Title" autoFocus aria-label="Task title" />
      <textarea className="rg-tasks__area" rows={2} value={description} placeholder="Description"
        onChange={(e) => setDescription(e.target.value)} aria-label="Task description" />
      <Select size="sm" prefix="Item" value={itemId} onChange={setItemId} options={itemOptions(inv, 'none')} aria-label="Linked item" />
      <div className="rg-tasks__row">
        <Button type="submit" variant="accent" size="sm" disabled={!title.trim()}>Add task</Button>
        <Button size="sm" onClick={() => onDone(null)}>Cancel</Button>
      </div>
    </form>
  );
}

function LinkedItem({ id }: { id: string }) {
  const inv = useInv();
  useImagesTick();
  const item = inv?.items[id];
  if (!item) return null;
  const s = getStore();
  return (
    <button type="button" className="rg-tasks__linked" onClick={() => useUi.getState().inspect(id)} title="Inspect">
      <Tile name={item.name} art={s.imageUrl(id, 'cell')} w={1} h={1} rotated={false}
        container={s.isContainer(id)} size={40} />
      <span className="rg-tasks__lname">{item.name}</span>
    </button>
  );
}

/** "unlocks: X, Y" from a task's `unlocks` ids; '' when it unlocks nothing. Unknown ids are skipped. */
function chainOf(t: Task, all: Task[]): string {
  const names = (t.unlocks ?? []).map((id) => all.find((x) => x.id === id)?.title).filter(Boolean);
  return names.length ? `unlocks: ${names.join(', ')}` : '';
}

/**
 * Unlocks: a multi-select of the other tasks. Completing this task makes each listed task that is locked active
 * (the engine does it in setTaskStatus).
 */
function UnlocksField({ task, all }: { task: Task; all: Task[] }) {
  const s = getStore();
  const others = all.filter((t) => t.id !== task.id);
  const on = new Set(task.unlocks ?? []);
  const toggle = (id: string) => {
    const next = on.has(id) ? (task.unlocks ?? []).filter((k) => k !== id) : [...(task.unlocks ?? []), id];
    s.updateTask(task.id, { unlocks: next });
  };
  return (
    <>
      <div className="rg-quest__label">Unlocks</div>
      <div className="rg-unlocks" role="group" aria-label="Unlocks">
        {others.map((t) => (
          <button
            key={t.id}
            type="button"
            className={on.has(t.id) ? 'rg-unlocks__opt rg-unlocks__opt--on' : 'rg-unlocks__opt'}
            aria-pressed={on.has(t.id)}
            onClick={() => toggle(t.id)}
          >
            <span className="rg-unlocks__box" aria-hidden>
              {on.has(t.id) ? <svg viewBox="0 0 12 12" width="10" height="10"><path d="M2 6.5 5 9.5 10 3" fill="none" stroke="currentColor" strokeWidth="2" /></svg> : null}
            </span>
            {t.title}
            <TaskChip status={t.status} />
          </button>
        ))}
        {others.length === 0 ? <span className="rg-unlocks__none">No other tasks</span> : null}
      </div>
    </>
  );
}

/** The auto rule of a new objective: ticks itself when `item` is in container/slot `in` (in `loadout`, blank = on screen). */
interface AutoDraft { on: boolean; item: string; in: string; loadout: string }
const NO_AUTO: AutoDraft = { on: false, item: '', in: '', loadout: '' };

function QuestSheet({ task, raw, all }: { task: Task; raw: Task; all: Task[] }) {
  const s = getStore();
  const inv = useInv();
  const [newObj, setNewObj] = useState('');
  const [auto, setAuto] = useState<AutoDraft>(NO_AUTO);
  const autoReady = !auto.on || (!!auto.item && !!auto.in);
  const [confirmDel, setConfirmDel] = useState(false);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  useEffect(() => { setConfirmDel(false); setNewObj(''); setAuto(NO_AUTO); }, [task.id]);

  const setObjectives = (objectives: Objective[]) => s.updateTask(task.id, { objectives });
  const addObjective = (e: FormEvent) => {
    e.preventDefault();
    const text = newObj.trim();
    if (!text || !autoReady) return;
    const rule = auto.on ? { item: auto.item, in: auto.in, ...(auto.loadout ? { loadout: auto.loadout } : {}) } : null;
    setObjectives([...raw.objectives, { text, done: false, auto: rule }]);
    setNewObj('');
    setAuto((a) => ({ ...NO_AUTO, on: a.on, loadout: a.loadout }));
  };
  const exportList = async () => {
    try {
      await navigator.clipboard.writeText(s.exportTaskChecklist(task.id));
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 1400);
  };

  return (
    <article className="rg-quest">
      <header className="rg-quest__head">
        <h2 className="rg-quest__title">{task.title}</h2>
        <SegmentedControl<Task['status']>
          size="sm"
          aria-label="Task status"
          value={task.status}
          onChange={(v) => s.setTaskStatus(task.id, v)}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'completed', label: 'Completed' },
            { value: 'locked', label: 'Locked' },
          ]}
        />
      </header>
      {task.description ? <p className="rg-quest__desc">{task.description}</p> : null}
      {task.itemId ? <LinkedItem id={task.itemId} /> : null}
      <div className="rg-quest__link">
        <Select size="sm" prefix="Item" value={raw.itemId ?? ''} options={itemOptions(inv, 'none')} aria-label="Linked item"
          onChange={(v) => s.updateTask(task.id, { itemId: v || null })} />
      </div>

      <div className="rg-quest__label">Objectives</div>
      <ul className="rg-quest__objs">
        {task.objectives.map((o, i) => {
          const auto = !!o.auto;
          return (
            <li key={i} className={o.done ? 'rg-obj rg-obj--done' : 'rg-obj'}>
              <button
                type="button"
                role="checkbox"
                aria-checked={o.done}
                aria-readonly={auto || undefined}
                disabled={auto}
                className="rg-obj__box"
                title={auto ? 'Ticks itself from where the item is placed' : undefined}
                onClick={() => s.setObjectiveDone(task.id, i, !o.done)}
              >
                {o.done ? <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden><path d="M2 6.5 5 9.5 10 3" fill="none" stroke="currentColor" strokeWidth="2" /></svg> : null}
              </button>
              <span className="rg-obj__text">{o.text}</span>
              {auto ? <Chip tone="region" size="sm">Auto</Chip> : null}
              <button type="button" className="rg-obj__rm" aria-label={`Remove objective ${o.text}`}
                onClick={() => setObjectives(raw.objectives.filter((_, j) => j !== i))}>×</button>
            </li>
          );
        })}
        {task.objectives.length === 0 ? <li className="rg-obj rg-obj--empty">No objectives yet</li> : null}
      </ul>
      <form className="rg-quest__add" onSubmit={addObjective}>
        <TextField variant="plain" size="sm" value={newObj} onChange={setNewObj} placeholder="New objective" aria-label="New objective" />
        <label className={auto.on ? 'rg-quest__auto rg-quest__auto--on' : 'rg-quest__auto'}>
          <input type="checkbox" checked={auto.on} onChange={(e) => setAuto((a) => ({ ...a, on: e.target.checked }))} />
          Auto
        </label>
        <Button type="submit" size="sm" disabled={!newObj.trim() || !autoReady} icon="plus">Add</Button>
        {auto.on ? (
          <div className="rg-quest__rule" role="group" aria-label="Auto rule">
            <Select size="sm" prefix="Item" value={auto.item} options={itemOptions(inv, '')} aria-label="Auto item"
              onChange={(v) => setAuto((a) => ({ ...a, item: v }))} />
            <Select size="sm" prefix="Is" value={auto.in} options={placeOptions(inv)} aria-label="Auto place"
              onChange={(v) => setAuto((a) => ({ ...a, in: v }))} />
            <Select size="sm" prefix="Loadout" value={auto.loadout} aria-label="Auto loadout"
              options={[{ value: '', label: 'on screen' }, ...Object.keys(inv?.loadouts ?? {})]}
              onChange={(v) => setAuto((a) => ({ ...a, loadout: v }))} />
          </div>
        ) : null}
      </form>

      <UnlocksField task={raw} all={all} />

      <footer className="rg-quest__foot">
        <Button variant="ink" onClick={exportList}>
          {copied === 'ok' ? 'Copied' : copied === 'fail' ? 'Copy failed' : 'Export checklist'}
        </Button>
        <span className="rg-quest__spacer" />
        {confirmDel ? (
          <span className="rg-quest__confirm">
            Delete task?
            <Button size="sm" className="rg-quest__yes" onClick={() => { s.deleteTask(task.id); }}>Yes</Button>
            <Button size="sm" onClick={() => setConfirmDel(false)}>No</Button>
          </span>
        ) : (
          <Button size="sm" className="rg-quest__del" onClick={() => setConfirmDel(true)}>Delete task</Button>
        )}
      </footer>
    </article>
  );
}

/** Tasks tab: the quest log. Left the list, right the quest sheet. */
export function TasksScreen() {
  const inv = useInv();
  const loadError = useInventory((s) => s.loadError);
  const tasks = inv ? getStore().tasksView() : [];
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const current = tasks.find((t) => t.id === sel) ?? tasks[0] ?? null;
  const raw = current ? inv?.tasks.find((t) => t.id === current.id) ?? null : null;

  const newTask = (
    <Button variant="accent" icon="plus" disabled={!inv} onClick={() => setAdding(true)}>New task</Button>
  );

  return (
    <div className="rg-tasks">
      <section className="rg-tasks__list" aria-label="Tasks">
        <div className="rg-tasks__listhead">
          <span className="rg-tasks__h">Tasks</span>
          {tasks.length && !adding ? <Button size="sm" variant="accent" icon="plus" onClick={() => setAdding(true)}>New task</Button> : null}
          {/* no inventory file: the button stays drawn, disabled, so the pane reads as not loaded rather than broken */}
          {!inv && loadError ? <Button size="sm" variant="accent" icon="plus" disabled>New task</Button> : null}
        </div>
        {adding ? <NewTaskForm onDone={(id) => { setAdding(false); if (id) setSel(id); }} /> : null}
        <ul>
          {tasks.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className={current?.id === t.id ? 'rg-tasks__item rg-tasks__item--on' : 'rg-tasks__item'}
                onClick={() => setSel(t.id)}
              >
                <span className="rg-tasks__text">
                  <span className="rg-tasks__title">{t.title}</span>
                  {chainOf(t, tasks) ? <span className="rg-tasks__chain">{chainOf(t, tasks)}</span> : null}
                </span>
                <TaskChip status={t.status} />
              </button>
            </li>
          ))}
        </ul>
        {!tasks.length && !adding && inv ? (
          <EmptyState title="No tasks" hint="Packing lists and chores live here. Objectives can tick themselves when an item is placed." action={newTask} />
        ) : null}
        {!inv && !loadError ? <div className="rg-tasks__skel" aria-hidden /> : null}
      </section>
      <section className="rg-tasks__sheet" aria-label="Quest sheet">
        {current && raw ? <QuestSheet task={current} raw={raw} all={tasks} /> : (
          <div className="rg-tasks__none">{inv || loadError ? 'Select or add a task' : ''}</div>
        )}
      </section>
    </div>
  );
}
