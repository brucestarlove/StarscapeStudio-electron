A tight, UI-level spec + TypeScript utilities for **dragging clips on the timeline with snapping**. It covers time↔px math, snap candidates, overlap policy, trim handles, and a small state machine you can drop into components.

---

# 1) Time ⇄ Pixels

```ts
// Keep in one place so ruler, clips, and hit-tests agree.
export interface TimelineGeom {
  pxPerMs: number;          // derived from zoom
  scrollLeftPx: number;     // scroll container
  viewportLeftPx: number;   // boundingClientRect().left of the scrolling area
}

export const msToPx = (ms: number, g: TimelineGeom) => ms * g.pxPerMs;
export const pxToMs = (px: number, g: TimelineGeom) => px / g.pxPerMs;

/** Client X -> timeline milliseconds (accounts for scroll and container offset). */
export const clientXToMs = (clientX: number, g: TimelineGeom) =>
  pxToMs((clientX - g.viewportLeftPx) + g.scrollLeftPx, g);
```

Compute `pxPerMs` from your zoom slider:

```ts
const BASE = 0.10; // px per ms at zoom=1
const pxPerMs = BASE * zoom;  // zoom ∈ [0.25…4]
```

---

# 2) Snap Candidates

Snap to (when enabled):

* **Grid**: `gridMs` intervals (e.g., 100ms) near the pointer
* **Clip edges on the same track** (excluding the active clip)
* **Playhead** position
* **Timeline origin** `0 ms`
* (Later) **Markers** and **region boundaries**

### Building an index once per drag

```ts
export interface SnapConfig {
  enabled: boolean;
  thresholdMs: number;   // e.g., 80ms
  gridMs: number;        // e.g., 100ms
}

export function buildSnapEdgesForTrack(trackClipRanges: Array<{id: string; startMs: number; endMs: number}>, activeId: string) {
  const edges: number[] = [];
  for (const c of trackClipRanges) {
    if (c.id === activeId) continue;
    edges.push(c.startMs, c.endMs);
  }
  edges.push(0); // origin
  return edges.sort((a,b)=>a-b);
}

export function nearestSnap(valueMs: number, cfg: SnapConfig, dynamic: { playheadMs?: number; markers?: number[] }, edges: number[]) {
  if (!cfg.enabled) return { snappedMs: valueMs, snappedTo: null as null | 'grid' | 'edge' | 'playhead' | 'marker' };

  const cands: Array<{ms: number; tag: 'grid'|'edge'|'playhead'|'marker'}> = [];

  // Grid near value
  const grid = Math.round(valueMs / cfg.gridMs) * cfg.gridMs;
  cands.push({ ms: grid, tag: 'grid' });

  // Edges
  for (const e of edges) cands.push({ ms: e, tag: 'edge' });

  // Playhead & markers
  if (dynamic.playheadMs != null) cands.push({ ms: dynamic.playheadMs, tag: 'playhead' });
  if (dynamic.markers) for (const m of dynamic.markers) cands.push({ ms: m, tag: 'marker' });

  // Choose closest within threshold
  let best = { ms: valueMs, tag: null as any };
  let bestDist = cfg.thresholdMs + 1;

  for (const c of cands) {
    const d = Math.abs(c.ms - valueMs);
    if (d < bestDist && d <= cfg.thresholdMs) {
      best = { ms: c.ms, tag: c.tag };
      bestDist = d;
    }
  }
  return { snappedMs: best.tag ? best.ms : valueMs, snappedTo: best.tag };
}
```

---

# 3) Overlap Rules (Main vs Overlay)

**Policy suggestion (MVP):**

* **Main track** clips **cannot overlap**. Clamp movement so the moved clip fits between immediate neighbors.
* **Overlay track** allows overlap (typical for PiP). You can still clamp to `>= 0`.

Helpers:

```ts
export function findNeighbors(trackOrder: string[], clipId: string, getClip: (id: string) => {startMs:number; endMs:number}) {
  const idx = trackOrder.indexOf(clipId);
  const leftId  = idx > 0 ? trackOrder[idx-1] : null;
  const rightId = idx >= 0 && idx < trackOrder.length-1 ? trackOrder[idx+1] : null;
  const left  = leftId  ? getClip(leftId)  : null;
  const right = rightId ? getClip(rightId) : null;
  return { left, right, leftId, rightId, index: idx };
}

/** Clamp a proposed start so duration fits between neighbors (non-overlap). */
export function clampToNeighbors(proposedStart: number, duration: number, neighbors: {left: {startMs:number; endMs:number}|null, right: {startMs:number; endMs:number}|null}) {
  let minStart = 0;
  let maxStart = Number.POSITIVE_INFINITY;
  if (neighbors.left)  minStart = Math.max(minStart, neighbors.left.endMs);
  if (neighbors.right) maxStart = Math.min(maxStart, neighbors.right.startMs - duration);
  if (maxStart === Number.POSITIVE_INFINITY) maxStart = Math.max(proposedStart, minStart); // open-ended right side
  return Math.min(Math.max(proposedStart, minStart), Math.max(minStart, maxStart));
}
```

---

# 4) Dragging a Clip (Move)

State machine per drag:

```ts
export interface DragMoveState {
  clipId: string;
  trackId: string;
  initialClientX: number;
  initialStartMs: number;
  initialEndMs: number;
  durationMs: number;

  geom: TimelineGeom;
  snapCfg: SnapConfig;
  snapEdges: number[]; // built once
  playheadMs?: number;

  allowOverlap: boolean; // false for main, true for overlay
  neighbors: ReturnType<typeof findNeighbors>;
}

export function beginClipDrag(params: {
  clipId: string; trackId: string; clientX: number;
  geom: TimelineGeom; snapCfg: SnapConfig;
  trackClipRanges: Array<{id:string; startMs:number; endMs:number}>;
  getClip: (id: string) => {startMs:number; endMs:number};
  trackOrder: string[];
  isOverlay: boolean;
  playheadMs?: number;
  initialStartMs: number; initialEndMs: number;
}): DragMoveState {
  return {
    clipId: params.clipId,
    trackId: params.trackId,
    initialClientX: params.clientX,
    initialStartMs: params.initialStartMs,
    initialEndMs: params.initialEndMs,
    durationMs: params.initialEndMs - params.initialStartMs,
    geom: params.geom,
    snapCfg: params.snapCfg,
    snapEdges: buildSnapEdgesForTrack(params.trackClipRanges, params.clipId),
    playheadMs: params.playheadMs,
    allowOverlap: params.isOverlay,
    neighbors: findNeighbors(params.trackOrder, params.clipId, params.getClip),
  };
}

export function updateClipDrag(state: DragMoveState, clientX: number) {
  const deltaMs = clientXToMs(clientX, state.geom) - clientXToMs(state.initialClientX, state.geom);
  let proposedStart = state.initialStartMs + deltaMs;

  // Snap proposal
  const { snappedMs } = nearestSnap(
    proposedStart,
    state.snapCfg,
    { playheadMs: state.playheadMs },
    state.snapEdges
  );

  proposedStart = snappedMs;

  // No-overlap clamp for main track
  if (!state.allowOverlap) {
    proposedStart = clampToNeighbors(proposedStart, state.durationMs, state.neighbors);
  }

  const proposedEnd = proposedStart + state.durationMs;
  return { startMs: proposedStart, endMs: proposedEnd };
}
```

**Integration in `ClipView`** (sketch):

```tsx
// inside ClipView
const onMouseDown: React.MouseEventHandler = (e) => {
  e.preventDefault();
  const st = beginClipDrag({
    clipId, trackId: clip.trackId, clientX: e.clientX,
    geom: currentGeom(), snapCfg, trackClipRanges: rangesForTrack(trackId),
    getClip: (id)=>store.project.clips[id], trackOrder: store.project.tracks[trackId].clipOrder,
    isOverlay: store.project.tracks[trackId].role === 'overlay',
    playheadMs: store.transport.playheadMs,
    initialStartMs: clip.startMs, initialEndMs: clip.endMs
  });
  setLocalDrag(st);
};

useEffect(() => {
  if (!localDrag) return;
  const move = (ev: MouseEvent) => {
    const { startMs, endMs } = updateClipDrag(localDrag, ev.clientX);
    useStore.getState().moveClip(clipId, startMs);
    // Optional: keep endMs consistent if your moveClip doesn’t compute it
    useStore.setState(s => { s.project.clips[clipId].endMs = endMs; });
  };
  const up = () => setLocalDrag(null);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up, { once: true });
  return () => { window.removeEventListener('mousemove', move); };
}, [localDrag]);
```

---

# 5) Trimming (Handles)

Trimming uses the same snapping but affects **start** or **end** and the **in/out** offsets.

```ts
export interface TrimState {
  clipId: string;
  edge: 'left'|'right';
  initialClientX: number;
  geom: TimelineGeom;
  snapCfg: SnapConfig;
  snapEdges: number[];
  playheadMs?: number;

  // frozen clip at start
  startMs0: number; endMs0: number; inMs0: number; outMs0: number;
  minDurationMs: number; // e.g., 50ms
  // neighbors for non-overlap when trimming left/right
  neighbors: ReturnType<typeof findNeighbors>;
  allowOverlap: boolean;
}

export function beginTrim(/* similar to beginClipDrag, but with edge + in/out */): TrimState { /* ... */ }

export function updateTrim(state: TrimState, clientX: number) {
  const tMs = clientXToMs(clientX, state.geom);
  const { snappedMs } = nearestSnap(tMs, state.snapCfg, { playheadMs: state.playheadMs }, state.snapEdges);

  if (state.edge === 'left') {
    // New start cannot exceed end - minDuration, and (if !allowOverlap) cannot cross left neighbor end
    const maxStart = state.endMs0 - state.minDurationMs;
    const leftBound = (!state.allowOverlap && state.neighbors.left) ? state.neighbors.left.endMs : -Infinity;
    const newStart = Math.max(Math.min(snappedMs, maxStart), leftBound);

    const delta = newStart - state.startMs0;
    return {
      startMs: newStart,
      endMs: state.endMs0,
      inMs: state.inMs0 + delta,
      outMs: state.outMs0
    };
  } else {
    // edge === 'right'
    const minEnd = state.startMs0 + state.minDurationMs;
    const rightBound = (!state.allowOverlap && state.neighbors.right) ? state.neighbors.right.startMs : Infinity;
    const newEnd = Math.min(Math.max(snappedMs, minEnd), rightBound);

    const delta = newEnd - state.endMs0;
    return {
      startMs: state.startMs0,
      endMs: newEnd,
      inMs: state.inMs0,
      outMs: state.outMs0 + delta
    };
  }
}
```

Apply to store:

```ts
// while dragging trim:
const r = updateTrim(trimState, e.clientX);
useStore.setState(s => {
  const c = s.project.clips[clipId];
  c.startMs = r.startMs; c.endMs = r.endMs;
  c.inMs = r.inMs; c.outMs = r.outMs;
});
```

---

# 6) Playhead Scrub + Snap

When dragging the playhead, reuse the same `nearestSnap` (grid + clip edges + markers). That makes splitting on the playhead naturally align.

```ts
export function updatePlayheadFromPointer(clientX: number, geom: TimelineGeom, cfg: SnapConfig, edges: number[]) {
  const raw = clientXToMs(clientX, geom);
  const { snappedMs } = nearestSnap(raw, cfg, {}, edges);
  return Math.max(0, snappedMs);
}
```

---

# 7) Keyboard Modifiers

* **Hold `Alt/Option`**: temporarily **disable snap** during a drag (pass `cfg.enabled=false`).
* **Hold `Shift`**: increase snap strength (halve threshold), or restrict dragging to X.
* **Hold `Cmd/Ctrl`**: allow overlap temporarily (for main track) or duplicate-on-drag (optional).

You can read modifiers off the mouse events and tweak the `DragMoveState.snapCfg`/`allowOverlap`.

---

# 8) Edge Cases & Acceptance

* **Very low zoom**: ensure `thresholdMs` doesn’t become < 1px—compute a **px threshold** too and accept snap iff both pass (optional).
* **Negative time**: clamp to `>= 0`.
* **Neighbors with zero space**: clamp to the only valid start; cursor still moves without visual jumps.
* **Clip reorder**: when a dragged clip crosses the center of a neighbor, you may (optionally) reorder in track; MVP can **not** reorder—require explicit reorder handle.

Acceptance checklist:

* Dragging a main-track clip cannot overlap neighbors.
* With Snap on, the clip “sticks” to grid, edges, and playhead within ~80ms.
* Holding Alt disables snapping instantly.
* Trimming respects min duration, neighbor bounds, and updates in/out correctly.
* Zooming changes scale without messing up hit tests.
