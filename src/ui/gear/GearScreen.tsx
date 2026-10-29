/**
 * The Gear tab: person | carried | stash, the Quick Use row and the status footer.
 * The container windows and the drag ghost are drawn by the app Overlays (one shared window layer).
 */
import { PersonColumn } from './PersonColumn';
import { CarriedColumn } from './CarriedColumn';
import { StashColumn } from './StashColumn';
import { QuickUseRow } from './QuickUseRow';
import { Footer } from './Footer';
import './gear.css';

export function GearScreen() {
  return (
    <div className="gear">
      <div className="gear__cols">
        <PersonColumn />
        <div className="gear__middle">
          <CarriedColumn />
        </div>
        <StashColumn />
      </div>
      <QuickUseRow />
      <Footer />
    </div>
  );
}

export default GearScreen;
