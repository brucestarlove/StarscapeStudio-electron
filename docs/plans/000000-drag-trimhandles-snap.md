Drop-in updates to wire **drag, trim handles, and snapping** into the timeline. It’s compact but complete enough for the agent to extend.

---

# 1) New utils

## `src/utils/timeline.ts`

```ts
export interface TimelineGeom {
  pxPerMs: number;
  scrollLeftPx: number;
  viewportLeftPx: number; // bounding rect left of scroll container
}
export const msToPx = (ms: number, g: TimelineGeom) => ms * g.pxPerMs;
export const pxToMs = (px: number, g: TimelineGeom) => px / g.pxPerMs;
export const clientXToMs = (clientX: number, g: TimelineGeom) =>
  pxToMs((clientX - g.viewportLeftPx) + g.scrollLeftPx, g);
```

## `src/utils/snap.ts`

```ts
export type SnapTag = 'grid'|'edge'|'playhead'|'marker'|null;

export interface SnapConfig {
  enabled: boolean;
  thresholdMs: number; // e.g. 80
  gridMs: number;      // e.g. 100
}

export function buildSnapEdgesForTrack(
  ranges: Array<{id: string; startMs: number; endMs: number}>,
  activeId: string
) {
  const edges: number[] = [0];
  for (const r of ranges) if (r.id !== activeId) edges.push(r.startMs, r.endMs);
  return edges.sort((a,b)=>a-b);
}

export function nearestSnap(
  valueMs: number,
  cfg: SnapConfig,
  dynamic: { playheadMs?: number; markers?: number[] },
  edges: number[]
): { snappedMs: number; snappedTo: SnapTag } {
  if (!cfg.enabled) return { snappedMs: valueMs, snappedTo: null };
  const cands: Array<{ms:number; tag: Exclude<SnapTag,null>}> = [];
  const grid = Math.round(valueMs / cfg.gridMs) * cfg.gridMs;
  cands.push({ ms: grid, tag: 'grid' });
  for (const e of edges) cands.push({ ms: e, tag: 'edge' });
  if (dynamic.playheadMs != null) cands.push({ ms: dynamic.playheadMs, tag: 'playhead' });
  if (dynamic.markers) for (const m of dynamic.markers) cands.push({ ms: m, tag: 'marker' });

  let best: {ms:number; tag: SnapTag} = { ms: valueMs, tag: null };
  let bestDist = cfg.thresholdMs + 1;
  for (const c of cands) {
    const d = Math.abs(c.ms - valueMs);
    if (d < bestDist && d <= cfg.thresholdMs) { best = c; bestDist = d; }
  }
  return { snappedMs: best.tag ? best.ms : valueMs, snappedTo: best.tag };
}
```

## `src/utils/drag.ts`

```ts
import { TimelineGeom, clientXToMs } from './timeline';
import { SnapConfig, buildSnapEdgesForTrack, nearestSnap } from './snap';

export function findNeighbors(
  trackOrder: string[],
  clipId: string,
  getClip: (id: string)=>{startMs:number; endMs:number}
){
  const idx = trackOrder.indexOf(clipId);
  const leftId = idx>0 ? trackOrder[idx-1] : null;
  const rightId = idx>=0 && idx<trackOrder.length-1 ? trackOrder[idx+1] : null;
  return {
    left:  leftId  ? getClip(leftId)  : null,
    right: rightId ? getClip(rightId) : null,
    index: idx
  };
}

export function clampToNeighbors(
  proposedStart: number,
  duration: number,
  neighbors: {left: {endMs:number}|null; right: {startMs:number}|null}
){
  let lo = 0;
  let hi = Number.POSITIVE_INFINITY;
  if (neighbors.left)  lo = Math.max(lo, neighbors.left.endMs);
  if (neighbors.right) hi = Math.min(hi, neighbors.right.startMs - duration);
  if (!Number.isFinite(hi)) hi = Math.max(proposedStart, lo);
  return Math.min(Math.max(proposedStart, lo), Math.max(lo, hi));
}

/* MOVE */
export interface DragMoveState {
  clipId: string; trackId: string;
  initialClientX: number;
  initialStartMs: number; initialEndMs: number; durationMs: number;
  geom: TimelineGeom; snapCfg: SnapConfig; snapEdges: number[];
  playheadMs?: number;
  allowOverlap: boolean;
  neighbors: ReturnType<typeof findNeighbors>;
}

export function beginClipDrag(p: {
  clipId: string; trackId: string; clientX: number;
  geom: TimelineGeom; snapCfg: SnapConfig;
  trackClipRanges: Array<{id:string; startMs:number; endMs:number}>;
  getClip: (id:string)=>{startMs:number; endMs:number};
  trackOrder: string[]; isOverlay: boolean; playheadMs?: number;
  initialStartMs: number; initialEndMs: number;
}): DragMoveState {
  return {
    clipId: p.clipId, trackId: p.trackId,
    initialClientX: p.clientX,
    initialStartMs: p.initialStartMs, initialEndMs: p.initialEndMs,
    durationMs: p.initialEndMs - p.initialStartMs,
    geom: p.geom, snapCfg: p.snapCfg,
    snapEdges: buildSnapEdgesForTrack(p.trackClipRanges, p.clipId),
    playheadMs: p.playheadMs,
    allowOverlap: p.isOverlay,
    neighbors: findNeighbors(p.trackOrder, p.clipId, p.getClip)
  };
}

export function updateClipDrag(state: DragMoveState, clientX: number) {
  const dxMs = clientXToMs(clientX, state.geom) - clientXToMs(state.initialClientX, state.geom);
  let start = state.initialStartMs + dxMs;

  const { snappedMs } = nearestSnap(start, state.snapCfg, { playheadMs: state.playheadMs }, state.snapEdges);
  start = snappedMs;

  if (!state.allowOverlap) start = clampToNeighbors(start, state.durationMs, state.neighbors);
  return { startMs: start, endMs: start + state.durationMs };
}

/* TRIM */
export interface TrimState {
  clipId: string; edge: 'left'|'right';
  initialClientX: number; geom: TimelineGeom;
  snapCfg: SnapConfig; snapEdges: number[]; playheadMs?: number;
  startMs0: number; endMs0: number; inMs0: number; outMs0: number;
  minDurationMs: number;
  neighbors: ReturnType<typeof findNeighbors>;
  allowOverlap: boolean;
}

export function beginTrim(p: {
  clipId: string; edge: 'left'|'right'; clientX: number;
  geom: TimelineGeom; snapCfg: SnapConfig;
  trackClipRanges: Array<{id:string; startMs:number; endMs:number}>;
  playheadMs?: number; startMs0: number; endMs0: number; inMs0: number; outMs0: number;
  minDurationMs: number; neighbors: ReturnType<typeof findNeighbors>;
  allowOverlap: boolean;
}): TrimState {
  return {
    clipId: p.clipId, edge: p.edge, initialClientX: p.clientX,
    geom: p.geom, snapCfg: p.snapCfg,
    snapEdges: buildSnapEdgesForTrack(p.trackClipRanges, p.clipId),
    playheadMs: p.playheadMs,
    startMs0: p.startMs0, endMs0: p.endMs0, inMs0: p.inMs0, outMs0: p.outMs0,
    minDurationMs: p.minDurationMs,
    neighbors: p.neighbors,
    allowOverlap: p.allowOverlap
  };
}

export function updateTrim(state: TrimState, clientX: number) {
  const raw = clientXToMs(clientX, state.geom);
  const { snappedMs } = nearestSnap(raw, state.snapCfg, { playheadMs: state.playheadMs }, state.snapEdges);

  if (state.edge === 'left') {
    const maxStart = state.endMs0 - state.minDurationMs;
    const leftBound = (!state.allowOverlap && state.neighbors.left) ? state.neighbors.left.endMs : -Infinity;
    const startMs = Math.max(Math.min(snappedMs, maxStart), leftBound);
    const delta = startMs - state.startMs0;
    return { startMs, endMs: state.endMs0, inMs: state.inMs0 + delta, outMs: state.outMs0 };
  } else {
    const minEnd = state.startMs0 + state.minDurationMs;
    const rightBound = (!state.allowOverlap && state.neighbors.right) ? state.neighbors.right.startMs : Infinity;
    const endMs = Math.min(Math.max(snappedMs, minEnd), rightBound);
    const delta = endMs - state.endMs0;
    return { startMs: state.startMs0, endMs, inMs: state.inMs0, outMs: state.outMs0 + delta };
  }
}
```

---

# 2) Timeline geometry context (to share scroll/zoom)

## `src/components/Timeline/TimelineContext.tsx`

```tsx
import React, { createContext, useContext, useMemo, useRef, useLayoutEffect, useState } from 'react';
import { TimelineGeom } from '../../utils/timeline';
import { useStore } from '../../store';

const Ctx = createContext<{ scrollerRef: React.RefObject<HTMLDivElement>; geom: TimelineGeom } | null>(null);
export const useTimelineGeom = () => useContext(Ctx)!;

export function TimelineProvider({ children }: { children: React.ReactNode }) {
  const zoom = useStore(s => s.transport.zoom);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [viewportLeft, setViewportLeft] = useState(0);
  const pxPerMs = 0.1 * zoom;

  useLayoutEffect(() => {
    const el = scrollerRef.current!;
    const update = () => setViewportLeft(el.getBoundingClientRect().left);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const geom: TimelineGeom = useMemo(() => ({
    pxPerMs,
    scrollLeftPx: scrollerRef.current?.scrollLeft ?? 0,
    viewportLeftPx: viewportLeft
  }), [pxPerMs, viewportLeft, scrollerRef.current?.scrollLeft]);

  return <Ctx.Provider value={{ scrollerRef, geom }}>{children}</Ctx.Provider>;
}
```

---

# 3) Update `TimelineDock` to provide context + horizontal scroller

## `src/components/Timeline/TimelineDock.tsx`

```tsx
import { useStore } from '../../store';
import Ruler from './Ruler';
import Track from './Track';
import { TimelineProvider, useTimelineGeom } from './TimelineContext';

function TracksArea() {
  const tracks = useStore(s => Object.values(s.project.tracks));
  const { scrollerRef } = useTimelineGeom();
  return (
    <div ref={scrollerRef} className="flex-1 overflow-x-auto overflow-y-auto relative">
      <div className="min-w-[3000px] relative"> {/* large canvas; later compute from project length */}
        {tracks.map(t => <Track key={t.id} trackId={t.id} />)}
      </div>
    </div>
  );
}

export default function TimelineDock() {
  const toggle = useStore(s => s.togglePlay);
  const playing = useStore(s => s.transport.playing);
  const zoom = useStore(s => s.transport.zoom);
  const setZoom = useStore(s => s.setZoom);
  const snap = useStore(s => s.transport.snap);
  const setSnap = useStore(s => s.setSnap);

  return (
    <TimelineProvider>
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2">
          <button onClick={toggle} className="px-2 py-1 rounded bg-white/10">{playing ? 'Pause' : 'Play'}</button>
          <div className="ml-auto flex items-center gap-3">
            <label className="text-xs">Zoom
              <input type="range" min={0.25} max={4} step={0.05} value={zoom} onChange={e=>setZoom(Number(e.target.value))} />
            </label>
            <label className="text-xs flex items-center gap-1">
              <input type="checkbox" checked={snap.enabled} onChange={e=>setSnap(e.target.checked)} />
              Snap
            </label>
          </div>
        </div>
        <Ruler />
        <TracksArea />
      </div>
    </TimelineProvider>
  );
}
```

---

# 4) Update `Track` (no logic changes, just styling)

## `src/components/Timeline/Track.tsx`

```tsx
import { useStore } from '../../store';
import ClipView from './ClipView';

export default function Track({ trackId }: { trackId: string }) {
  const track = useStore(s => s.project.tracks[trackId]);
  const clips = useStore(s => track.clipOrder.map(id => s.project.clips[id]));
  if (!track) return null;
  return (
    <div className="h-20 border-b border-white/10 relative">
      {clips.map(c => <ClipView key={c.id} clipId={c.id} />)}
    </div>
  );
}
```

---

# 5) Wire drag + trim in `ClipView` with handles

## `src/components/Timeline/ClipView.tsx`

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useTimelineGeom } from './TimelineContext';
import { msToPx } from '../../utils/timeline';
import { beginClipDrag, updateClipDrag, beginTrim, updateTrim, findNeighbors } from '../../utils/drag';
import { buildSnapEdgesForTrack } from '../../utils/snap';

export default function ClipView({ clipId }: { clipId: string }) {
  const s = useStore.getState();
  const clip = useStore(st => st.project.clips[clipId]);
  const asset = useStore(st => st.project.assets[clip.assetId]);
  const zoom = useStore(st => st.transport.zoom);
  const snapCfg = useStore(st => st.transport.snap);
  const playheadMs = useStore(st => st.transport.playheadMs);
  const track = useStore(st => st.project.tracks[clip.trackId]);
  const tracks = useStore(st => st.project.tracks);
  const getClip = (id:string)=>useStore.getState().project.clips[id];
  const { geom } = useTimelineGeom();

  const [drag, setDrag] = useState<ReturnType<typeof beginClipDrag>|null>(null);
  const [trim, setTrim] = useState<ReturnType<typeof beginTrim>|null>(null);

  const ranges = useMemo(() => track.clipOrder.map(id => {
    const c = s.project.clips[id]; return { id, startMs: c.startMs, endMs: c.endMs };
  }), [track.clipOrder, s.project.clips]);

  if (!clip || !asset) return null;

  const scale = geom.pxPerMs; // 0.1 * zoom
  const style: React.CSSProperties = {
    position: 'absolute',
    left: msToPx(clip.startMs, geom),
    width: msToPx(clip.endMs - clip.startMs, geom),
    top: 6, bottom: 6,
  };

  // Begin MOVE drag
  const onBodyMouseDown: React.MouseEventHandler = (e) => {
    e.preventDefault();
    const isOverlay = track.role === 'overlay';
    const st = beginClipDrag({
      clipId, trackId: clip.trackId, clientX: e.clientX,
      geom, snapCfg: e.altKey ? { ...snapCfg, enabled: false } : snapCfg,
      trackClipRanges: ranges, getClip, trackOrder: track.clipOrder,
      isOverlay, playheadMs, initialStartMs: clip.startMs, initialEndMs: clip.endMs
    });
    setDrag(st);
  };

  // Begin TRIM drag (left/right)
  const onTrimMouseDown = (edge: 'left'|'right'): React.MouseEventHandler => (e) => {
    e.preventDefault();
    const neighbors = findNeighbors(track.clipOrder, clipId, getClip);
    setTrim(beginTrim({
      clipId, edge, clientX: e.clientX, geom,
      snapCfg: e.altKey ? { ...snapCfg, enabled: false } : snapCfg,
      trackClipRanges: ranges, playheadMs,
      startMs0: clip.startMs, endMs0: clip.endMs, inMs0: clip.inMs, outMs0: clip.outMs,
      minDurationMs: 50, neighbors,
      allowOverlap: track.role === 'overlay'
    }));
  };

  // Global mouse handlers
  useEffect(() => {
    if (!drag && !trim) return;
    const onMove = (ev: MouseEvent) => {
      if (drag) {
        const r = updateClipDrag(drag, ev.clientX);
        useStore.setState(st => {
          st.project.clips[clipId].startMs = r.startMs;
          st.project.clips[clipId].endMs = r.endMs;
        });
      } else if (trim) {
        const r = updateTrim(trim, ev.clientX);
        useStore.setState(st => {
          const c = st.project.clips[clipId];
          c.startMs = r.startMs; c.endMs = r.endMs; c.inMs = r.inMs; c.outMs = r.outMs;
        });
      }
    };
    const onUp = () => { setDrag(null); setTrim(null); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [drag, trim, clipId]);

  return (
    <div style={style} className="group rounded bg-indigo-600/50 border border-indigo-400/50 text-xs flex items-center relative">
      {/* Left trim handle */}
      <div
        onMouseDown={onTrimMouseDown('left')}
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-indigo-400/60 opacity-0 group-hover:opacity-100" />
      {/* Body (move) */}
      <div onMouseDown={onBodyMouseDown} className="flex-1 px-2 cursor-grab active:cursor-grabbing truncate">
        {asset.name}
      </div>
      {/* Right trim handle */}
      <div
        onMouseDown={onTrimMouseDown('right')}
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-indigo-400/60 opacity-0 group-hover:opacity-100" />
    </div>
  );
}
```

---

# 6) Small Ruler tweak (optional snap edges preview)

## `src/components/Timeline/Ruler.tsx`

```tsx
import { useStore } from '../../store';
import { useTimelineGeom } from './TimelineContext';
import { msToPx } from '../../utils/timeline';

export default function Ruler() {
  const zoom = useStore(s => s.transport.zoom);
  const { geom } = useTimelineGeom();
  // Simple visual ruler:
  const ticks = Array.from({length: 60}, (_,i)=>i*1000); // 60s
  return (
    <div className="h-6 bg-zinc-800 border-t border-b border-white/10 relative">
      {ticks.map(ms => (
        <div key={ms} className="absolute top-0 bottom-0 border-l border-white/10"
             style={{ left: msToPx(ms, geom) }}>
          <div className="text-[10px] text-white/50 -translate-x-1/2">{ms/1000}s</div>
        </div>
      ))}
    </div>
  );
}
```

---

## Notes

* **Alt/Option** while dragging temporarily disables snapping (already handled).
* The timeline width is mocked with `min-w-[3000px]`; later compute from project duration.
* This doesn’t reorder clips when crossing neighbors; movement is clamped on the main track (overlap off) and free on overlay.
