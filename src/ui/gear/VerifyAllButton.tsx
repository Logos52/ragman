/**
 * Stash header: ticks `verified` on every item in the inventory (all locations, the Archive, everything carried) as
 * one undo step. Once nothing is left unverified it reads "Unverify all" and clears them all, so a bulk tick made
 * by mistake is one click (or Undo) away from gone.
 */
import { Button } from '../primitives/Button';
import { getStore, useInv } from '../app/useStore';

export function VerifyAllButton() {
  const inv = useInv();
  const store = getStore();
  if (!inv || Object.keys(inv.items).length === 0) return null;
  const left = store.unverifiedIds().length;
  const all = left === 0;
  return (
    <Button
      size="sm"
      icon="check"
      title={all ? 'Every item is verified. Click to clear the tick on all of them.' : `${left} unverified. Tick every item in the inventory, all locations and the Archive.`}
      onClick={() => store.setVerifiedAll(!all)}
    >
      {all ? 'Unverify all' : 'Verify all'}
    </Button>
  );
}
