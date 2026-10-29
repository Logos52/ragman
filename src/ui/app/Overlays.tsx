import { ItemTooltip } from '../menus/ItemTooltip';
import { ItemContextMenu } from '../menus/ItemContextMenu';
import { InspectWindows } from '../inspect/InspectCard';
import { AddForm, EditForm } from '../inspect/EditForm';
import { ContainerWindows } from '../gear/ContainerWindows';
import { DragLayer } from '../drag/DragLayer';
import { useUi } from '../uiStore';

/**
 * Every app-level overlay, rendered once. One shared window layer holds the container windows (Gear tab only)
 * and the Inspect windows, so their stacking interleaves (uiStore.zOrder). Edit and Add stay modal.
 * The drag ghost lives here too, so a tile in an Inspect window drags on any tab.
 */
export function Overlays() {
  const tab = useUi((s) => s.tab);
  return (
    <>
      <div className="gear-windows">
        {tab === 'gear' ? <ContainerWindows /> : null}
        <InspectWindows />
      </div>
      <EditForm />
      <AddForm />
      <ItemContextMenu />
      <ItemTooltip />
      <DragLayer />
    </>
  );
}
