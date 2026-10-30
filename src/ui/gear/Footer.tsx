/** Status footer: carried weight left; save badge and sync state right. */
import { CarriedReadout } from '../primitives/WeightReadout';
import { SaveBadge } from '../primitives/SaveBadge';
import { SyncBadge } from '../primitives/SyncBadge';
import { getStore, useInventory } from '../hooks/useInv';

export function Footer() {
  const w = useInventory((s) => s.carriedWeight());
  const saveState = useInventory((s) => s.saveState);
  const syncState = useInventory((s) => s.syncState);
  const syncAt = useInventory((s) => s.syncAt);
  const syncMessage = useInventory((s) => s.syncMessage);
  const syncConflict = useInventory((s) => s.syncConflict);
  return (
    <footer className="gear-footer">
      <CarriedReadout grams={w.grams} unweighed={w.unweighed} estimated={w.estimated} />
      <span className="gear-footer__state">
        <SaveBadge state={saveState} onRetry={() => { void getStore().saveNow(); }} />
        <SyncBadge state={syncState} at={syncAt} message={syncMessage} conflict={syncConflict} onRetry={() => { void getStore().retrySync(); }} />
      </span>
    </footer>
  );
}
