/** Status footer: carried weight left, save badge right. */
import { CarriedReadout } from '../primitives/WeightReadout';
import { SaveBadge } from '../primitives/SaveBadge';
import { getStore, useInventory } from '../hooks/useInv';

export function Footer() {
  const w = useInventory((s) => s.carriedWeight());
  const saveState = useInventory((s) => s.saveState);
  return (
    <footer className="gear-footer">
      <CarriedReadout grams={w.grams} unweighed={w.unweighed} />
      <SaveBadge state={saveState} onRetry={() => { void getStore().saveNow(); }} />
    </footer>
  );
}
