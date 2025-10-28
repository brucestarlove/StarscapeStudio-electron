Focused, drop-in additions for **playhead scrubbing (with snap)** and **split at playhead (`S`)**.

---

# 1) Snap the playhead while scrubbing

## `src/utils/playhead.ts`

```ts
import { TimelineGeom, clientXToMs } from './timeline';
import { SnapConfig } from './snap';
import { nearestSnap } from './snap';

/** Build edges from ALL clips across tracks for playhead snapping. */
export function buildAllClipEdges(project: {
  tracks: Record<string, { clipOrder: string[] }>,
  clips: Record<string, { startMs: number; endMs: number }>
}) {
  const edges = new Set<number>([0]);
  for (const t of Object.values(project.tracks)) {
    for (const id of t.clipOrder) {
      const c = project.clips[id];
      edges.add(c.startMs);
      edges.add(c.endMs);
    }
  }
  return Array.from(edges).sort((a,b)=>a-b);
}

/** Convert pointer → snapped playhead ms using grid + clip edges. */
export function scrubToMs(clientX: number, geom: TimelineGeom, cfg: SnapConfig, edges: number[]) {
  const raw = clientXToMs(clientX, geom);
  const { snappedMs } = nearestSnap(raw, cfg, {}, edges);
  return Math.max(0, snappedMs);
}
```

---

# 2) Playhead UI + scrubbing

## `src/components/Timeline/Playhead.tsx`

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useTimelineGeom } from './TimelineContext';
import { msToPx } from '../../utils/timeline';
import { buildAllClipEdges, scrubToMs } from '../../utils/playhead';

export default function Playhead() {
  const playhead = useStore(s => s.transport.playheadMs);
  const setSeek  = useStore(s => s.seek);
  const snapCfg  = useStore(s => s.transport.snap);
  const project  = useStore(s => s.project);
  const { geom, scrollerRef } = useTimelineGeom();

  const [dragging, setDragging] = useState(false);
  const edges = useMemo(() => buildAllClipEdges(project), [project.tracks, project.clips]);

  // Keep geom.scrollLeft up-to-date while dragging
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const ms = scrubToMs(e.clientX, {
        ...geom,
        scrollLeftPx: scrollerRef.current?.scrollLeft ?? 0
      }, e.altKey ? { ...snapCfg, enabled: false } : snapCfg, edges);
      setSeek(ms);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [dragging, geom, scrollerRef, snapCfg, edges, setSeek]);

  const left = msToPx(playhead, geom);

  return (
    <>
      {/* Click on ruler/track area to jump playhead */}
      <div
        className="absolute inset-0"
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('[data-clip]')) return; // ignore when grabbing a clip
          const ms = scrubToMs(e.clientX, {
            ...geom,
            scrollLeftPx: scrollerRef.current?.scrollLeft ?? 0
          }, e.altKey ? { ...snapCfg, enabled: false } : snapCfg, edges);
          setSeek(ms);
          setDragging(true);
        }}
      />
      {/* Visual playhead line */}
      <div
        className="absolute top-0 bottom-0 w-px bg-rose-400 pointer-events-none"
        style={{ left }}
      />
      {/* Grab handle */}
      <div
        className="absolute -top-2 w-3 h-3 bg-rose-400 rounded-full cursor-col-resize"
        style={{ left: left - 6 }}
        onMouseDown={() => setDragging(true)}
        title="Drag to scrub (Alt disables snap)"
      />
    </>
  );
}
```

### Mount the Playhead

Edit **`src/components/Timeline/TimelineDock.tsx`** — inside the scrollable area container, add the `Playhead` on top of tracks:

```tsx
// ...
import Playhead from './Playhead';

function TracksArea() {
  const tracks = useStore(s => Object.values(s.project.tracks));
  const { scrollerRef } = useTimelineGeom();

  return (
    <div ref={scrollerRef} className="flex-1 overflow-x-auto overflow-y-auto relative">
      <div className="min-w-[3000px] relative">
        {/* Playhead sits above tracks */}
        <Playhead />
        {tracks.map(t => <Track key={t.id} trackId={t.id} />)}
      </div>
    </div>
  );
}
```

---

# 3) Split at playhead (`S`)

**Behavior:** when the user presses **`S`**, split **selected clips** that intersect the playhead. If no selection, split **all clips** on the current track(s) that intersect the playhead (MVP: all tracks).

## `src/utils/split.ts`

```ts
export function clipIntersects(clip: {startMs:number; endMs:number}, ms: number) {
  return ms > clip.startMs && ms < clip.endMs; // strictly inside
}
```

### Keyboard handler

Add a global key handler when the timeline is mounted.

Edit **`src/components/Timeline/TimelineDock.tsx`**:

```tsx
import { useEffect } from 'react';
import { useStore } from '../../store';
// ...

export default function TimelineDock() {
  // existing hooks...
  const playhead = useStore(s => s.transport.playheadMs);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 's') return;
      // Split logic
      const st = useStore.getState();
      const { clips, tracks } = st.project;
      const selected = st.ui.selection.clipIds;
      const targetIds = (selected.length > 0)
        ? selected.slice()
        : Object.values(tracks).flatMap(t => t.clipOrder);

      for (const id of targetIds) {
        const c = clips[id];
        if (!c) continue;
        if (playhead > c.startMs && playhead < c.endMs) {
          st.splitClip(id, playhead); // uses your existing store action
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playhead]);

  // return (...unchanged)
}
```

> Tip: If you prefer “split only on the active track,” store an `activeTrackId` in UI state when the user last interacted with a track, and filter `targetIds` by that track.

---

# 4) Optional: playhead snap preview on ruler ticks

You already get snap from `buildAllClipEdges`. If you want a subtle visual when near a snap target, you can expose the last `snappedTo` tag from `nearestSnap` and briefly show a tiny glow on the target line—nice, but not required.

---

# 5) Acceptance checklist

* Clicking empty space in the timeline area moves the playhead (snaps to grid/edges unless **Alt** held).
* Dragging the round playhead handle scrubs; **Alt** disables snap while held.
* Pressing **`S`** splits all selected clips containing the playhead time; if none selected, splits all intersecting clips across tracks (or your chosen active track policy).
* Splitting preserves timing: `[left.start, playhead]` + `[playhead, right.end]`, updating `inMs/outMs` per your existing `splitClip` logic.
* No split occurs if the playhead is exactly on a clip’s start or end.

---
