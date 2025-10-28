## Drag-to-reorder tracks (drop-in)

This keeps your explicit `project.trackOrder` as the source of truth and uses native HTML5 drag events—no lib required.

### 1) Store actions

Add these to your `RootState` in `types.ts`:

```ts
moveTrack: (fromIndex: number, toIndex: number) => void;
setTrackRole: (trackId: TrackId, role: Track['role']) => void; // optional (for role convert)
```

Implement in `store.ts`:

```ts
moveTrack: (from, to) => set(s => {
  const arr = s.project.trackOrder;
  if (from < 0 || from >= arr.length) return;
  const [id] = arr.splice(from, 1);
  const clamped = Math.max(0, Math.min(to, arr.length));
  arr.splice(clamped, 0, id);

  // keep active track visible/sane (optional)
  if (!s.ui.activeTrackId) s.ui.activeTrackId = id;
}),

setTrackRole: (trackId, role) => set(s => {
  if (!s.project.tracks[trackId]) return;
  s.project.tracks[trackId].role = role;

  // optional policy tweaks:
  // If converting away from the current primary/overlay references, you can
  // reassign these pointers. MVP can skip to avoid surprise re-routing.
}),
```

---

### 2) Track list with drag handles

Create `src/components/Timeline/TrackList.tsx`:

```tsx
import { useMemo, useRef, useState } from 'react';
import { useStore } from '../../store';
import Track from './Track';

export default function TrackList() {
  const order = useStore(s => s.project.trackOrder);
  const tracks = useStore(s => s.project.tracks);
  const moveTrack = useStore(s => s.moveTrack);

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onDragStart = (idx: number) => (e: React.DragEvent) => {
    setDraggingIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
    // Needed for Firefox
    e.dataTransfer.setData('text/plain', String(idx));
  };

  const onDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault(); // allow drop
    if (draggingIndex === null) return;
    setOverIndex(idx);
  };

  const onDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggingIndex === null) return;
    // If dropping below the last row, idx may point to the hovered row;
    // Insert before hovered row for a predictable feel.
    moveTrack(draggingIndex, idx);
    setDraggingIndex(null);
    setOverIndex(null);
  };

  const onDragEnd = () => {
    setDraggingIndex(null);
    setOverIndex(null);
  };

  return (
    <div ref={containerRef} className="relative">
      {order.map((trackId, idx) => {
        const isDragging = draggingIndex === idx;
        const isOver = overIndex === idx;

        return (
          <div key={trackId}
               onDragOver={onDragOver(idx)}
               onDrop={onDrop(idx)}
               className={`relative ${isOver ? 'before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-indigo-500' : ''}`}>
            {/* Small drag handle at far left of each row */}
            <div
              draggable
              onDragStart={onDragStart(idx)}
              onDragEnd={onDragEnd}
              className={`absolute left-0 top-0 bottom-0 w-3 cursor-grab active:cursor-grabbing z-10`}
              title="Drag to reorder tracks"
            >
              {/* optional grip dots */}
            </div>

            {/* Indent Track by handle width */}
            <div className={`${isDragging ? 'opacity-60' : ''} pl-3`}>
              <Track trackId={trackId} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

> UX notes
>
> * A thin “grip” area (`w-3`) avoids accidental drags when clicking the header.
> * A blue line appears above the hovered row to indicate drop target.

---

### 3) Use the list in your timeline dock

Update `src/components/Timeline/TimelineDock.tsx`:

```tsx
import TrackList from './TrackList';
// …

function TracksArea() {
  const { scrollerRef } = useTimelineGeom();
  return (
    <div ref={scrollerRef} className="flex-1 overflow-x-auto overflow-y-auto relative">
      <div className="min-w-[3000px] relative">
        {/* Playhead stays above */}
        <Playhead />
        <TrackList />
      </div>
    </div>
  );
}
```

### 4) Acceptance checklist

* Dragging the **grip** on a track row reorders tracks; the blue indicator shows where it will land.
* Releasing the mouse updates `project.trackOrder` and the visual order immediately.
* No state corruption: active track and clip rendering still work after reordering.
