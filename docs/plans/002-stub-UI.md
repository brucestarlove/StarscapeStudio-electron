Here’s a tiny but real scaffold for an AI coding agent. A runnable UI shell, typed state, and clear function signatures to fill in. Tech: React + TypeScript + Tailwind + Zustand. (Web-first; drop-in Tauri later.)

---

# File tree

```
src/
  main.tsx
  App.tsx
  types.ts
  store.ts
  hooks/
    useSnap.ts
  components/
    TopBar.tsx
    LeftRail.tsx
    LeftPane/
      LeftPane.tsx
      LibraryGrid.tsx
      UploadModal.tsx
    Stage/
      Stage.tsx
      CanvasNode.tsx
    Timeline/
      TimelineDock.tsx
      Ruler.tsx
      Track.tsx
      ClipView.tsx
```

---

## `src/types.ts`

```ts
export type Ms = number;

export type AssetId = string;
export type CanvasNodeId = string;
export type TrackId = string;
export type ClipId = string;

export type AssetKind = 'video' | 'image' | 'audio' | 'text';

export interface Asset {
  id: AssetId;
  kind: AssetKind;
  name: string;
  src: string;            // object URL or file:// path via Tauri
  durationMs?: Ms;
  width?: number;
  height?: number;
  thumbSrc?: string;
  meta?: Record<string, unknown>;
}

export interface CanvasNode {
  id: CanvasNodeId;
  assetId: AssetId;
  x: number;              // stage-space coords
  y: number;
  width: number;
  height: number;
  rotationDeg: number;
  zIndex: number;
  locked?: boolean;
  visible?: boolean;
}

export interface Clip {
  id: ClipId;
  assetId: AssetId;
  trackId: TrackId;
  startMs: Ms;            // timeline start
  endMs: Ms;              // timeline end (exclusive)
  inMs: Ms;               // trim in (source offset)
  outMs: Ms;              // trim out (source offset)
}

export interface Track {
  id: TrackId;
  role: 'main' | 'overlay';
  clipOrder: ClipId[];
}

export interface Project {
  id: string;
  name: string;
  stage: { width: number; height: number; background: string };
  assets: Record<AssetId, Asset>;
  canvasNodes: Record<CanvasNodeId, CanvasNode>;
  tracks: Record<TrackId, Track>;
  clips: Record<ClipId, Clip>;
  primaryTrackId: TrackId;
  overlayTrackId: TrackId;
}

export interface Transport {
  playing: boolean;
  playheadMs: Ms;
  zoom: number;           // scalar affecting px per ms
  snap: { enabled: boolean; thresholdMs: Ms; gridMs: Ms };
}

export interface UIState {
  leftPane: { open: boolean; tab: 'media' | 'text' | 'edit' };
  modals: { uploadOpen: boolean; settingsOpen: boolean; commentsOpen: boolean; aiOpen: boolean };
  selection: { canvasNodeIds: CanvasNodeId[]; clipIds: ClipId[] };
  hover: { target?: { type: 'clip' | 'handle' | 'canvasNode' | 'guide'; id?: string } };
}

export interface RootState {
  project: Project;
  transport: Transport;
  ui: UIState;

  // Actions
  renameProject: (name: string) => void;

  // Assets
  addAssets: (files: File[]) => Promise<void>;
  removeAsset: (id: AssetId) => void;

  // Canvas
  addCanvasNode: (assetId: AssetId, at?: { x?: number; y?: number }) => CanvasNodeId;
  transformNode: (id: CanvasNodeId, p: Partial<Pick<CanvasNode, 'x'|'y'|'width'|'height'|'rotationDeg'>>) => void;
  bringToFront: (id: CanvasNodeId) => void;
  sendToBack: (id: CanvasNodeId) => void;
  deleteNode: (id: CanvasNodeId) => void;
  selectNodes: (ids: CanvasNodeId[]) => void;

  // Timeline
  createClip: (assetId: AssetId, trackId: TrackId, atMs: Ms) => ClipId;
  moveClip: (clipId: ClipId, toMs: Ms) => void;
  trimClip: (clipId: ClipId, p: Partial<Pick<Clip, 'startMs'|'endMs'|'inMs'|'outMs'>>) => void;
  splitClip: (clipId: ClipId, atMs: Ms) => { leftId: ClipId; rightId: ClipId } | null;
  deleteClip: (clipId: ClipId) => void;
  reorderClipWithinTrack: (clipId: ClipId, beforeClipId?: ClipId) => void;

  // Transport
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (ms: Ms) => void;
  setZoom: (z: number) => void;
  setSnap: (enabled: boolean) => void;

  // UI
  openUpload: () => void;
  closeUpload: () => void;
  setLeftTab: (tab: UIState['leftPane']['tab']) => void;
  toggleLeftPane: () => void;
}
```

---

## `src/store.ts` (Zustand minimal implementation)

```ts
import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type {
  RootState, Project, Track, Ms,
  Asset, AssetId, CanvasNodeId, ClipId
} from './types';

const DEFAULT_STAGE = { width: 1080, height: 1920, background: '#000' };
const DEFAULT_GRID_MS = 100;

export const useStore = create<RootState>((set, get) => {
  // helper creators
  const mkTrack = (role: Track['role']): Track => ({ id: nanoid(), role, clipOrder: [] });

  // initial project
  const main = mkTrack('main');
  const overlay = mkTrack('overlay');
  const project: Project = {
    id: nanoid(),
    name: 'Untitled Project',
    stage: DEFAULT_STAGE,
    assets: {},
    canvasNodes: {},
    tracks: { [main.id]: main, [overlay.id]: overlay },
    clips: {},
    primaryTrackId: main.id,
    overlayTrackId: overlay.id,
  };

  return {
    project,
    transport: { playing: false, playheadMs: 0, zoom: 1, snap: { enabled: true, thresholdMs: 80, gridMs: DEFAULT_GRID_MS } },
    ui: { leftPane: { open: true, tab: 'media' }, modals: { uploadOpen: false, settingsOpen: false, commentsOpen: false, aiOpen: false }, selection: { canvasNodeIds: [], clipIds: [] }, hover: {} },

    // Project
    renameProject: (name) => set(s => { s.project.name = name; }),

    // Assets
    addAssets: async (files: File[]) => {
      const assets: Asset[] = await Promise.all(files.map(async f => ({
        id: nanoid(),
        kind: f.type.startsWith('video') ? 'video' : f.type.startsWith('image') ? 'image' : f.type.startsWith('audio') ? 'audio' : 'text',
        name: f.name,
        src: URL.createObjectURL(f),
      })));
      set(s => {
        for (const a of assets) s.project.assets[a.id] = a;
      });
    },
    removeAsset: (id) => set(s => { delete s.project.assets[id]; }),

    // Canvas
    addCanvasNode: (assetId, at) => {
      const id: CanvasNodeId = nanoid();
      const stage = get().project.stage;
      const w = Math.min(stage.width * 0.6, 800);
      const h = Math.min(stage.height * 0.6, 800);
      set(s => {
        s.project.canvasNodes[id] = {
          id, assetId,
          x: at?.x ?? stage.width / 2,
          y: at?.y ?? stage.height / 2,
          width: w, height: h,
          rotationDeg: 0,
          zIndex: Object.values(s.project.canvasNodes).length,
        };
        s.ui.selection.canvasNodeIds = [id];
      });
      return id;
    },
    transformNode: (id, p) => set(s => { Object.assign(s.project.canvasNodes[id], p); }),
    bringToFront: (id) => set(s => {
      const nodes = Object.values(s.project.canvasNodes).sort((a,b)=>a.zIndex-b.zIndex);
      nodes.forEach((n,i)=> n.zIndex = i);
      s.project.canvasNodes[id].zIndex = nodes.length;
    }),
    sendToBack: (id) => set(s => {
      const nodes = Object.values(s.project.canvasNodes).sort((a,b)=>a.zIndex-b.zIndex);
      nodes.forEach((n,i)=> n.zIndex = i + 1);
      s.project.canvasNodes[id].zIndex = 0;
    }),
    deleteNode: (id) => set(s => { delete s.project.canvasNodes[id]; }),
    selectNodes: (ids) => set(s => { s.ui.selection.canvasNodeIds = ids; }),

    // Timeline
    createClip: (assetId, trackId, atMs) => {
      const id: ClipId = nanoid();
      const asset = get().project.assets[assetId];
      const defaultLen: Ms = Math.min(asset?.durationMs ?? 3000, 3000);
      set(s => {
        s.project.clips[id] = { id, assetId, trackId, startMs: atMs, endMs: atMs + defaultLen, inMs: 0, outMs: defaultLen };
        s.project.tracks[trackId].clipOrder.push(id);
        s.ui.selection.clipIds = [id];
      });
      return id;
    },
    moveClip: (clipId, toMs) => set(s => { s.project.clips[clipId].endMs -= (s.project.clips[clipId].startMs - toMs); s.project.clips[clipId].startMs = toMs; }),
    trimClip: (clipId, p) => set(s => { Object.assign(s.project.clips[clipId], p); }),
    splitClip: (clipId, atMs) => {
      const clip = get().project.clips[clipId];
      if (!clip || atMs <= clip.startMs || atMs >= clip.endMs) return null;
      const leftId = nanoid(); const rightId = nanoid();
      set(s => {
        const t = s.project.tracks[clip.trackId];
        const idx = t.clipOrder.indexOf(clipId);
        // left
        s.project.clips[leftId] = { ...clip, id: leftId, endMs: atMs, outMs: clip.outMs - (clip.endMs - atMs) };
        // right
        s.project.clips[rightId] = { ...clip, id: rightId, startMs: atMs, inMs: clip.inMs + (atMs - clip.startMs) };
        // replace ordering
        t.clipOrder.splice(idx, 1, leftId, rightId);
        delete s.project.clips[clipId];
        s.ui.selection.clipIds = [rightId];
      });
      return { leftId, rightId };
    },
    deleteClip: (clipId) => set(s => {
      const clip = s.project.clips[clipId];
      if (!clip) return;
      const t = s.project.tracks[clip.trackId];
      t.clipOrder = t.clipOrder.filter(id => id !== clipId);
      delete s.project.clips[clipId];
    }),
    reorderClipWithinTrack: (clipId, beforeClipId) => set(s => {
      const clip = s.project.clips[clipId]; if (!clip) return;
      const arr = s.project.tracks[clip.trackId].clipOrder;
      const old = arr.indexOf(clipId); if (old >= 0) arr.splice(old, 1);
      const idx = beforeClipId ? Math.max(0, arr.indexOf(beforeClipId)) : arr.length;
      arr.splice(idx, 0, clipId);
    }),

    // Transport
    play: () => set(s => { s.transport.playing = true; }),
    pause: () => set(s => { s.transport.playing = false; }),
    togglePlay: () => set(s => { s.transport.playing = !s.transport.playing; }),
    seek: (ms) => set(s => { s.transport.playheadMs = ms; }),
    setZoom: (z) => set(s => { s.transport.zoom = z; }),
    setSnap: (enabled) => set(s => { s.transport.snap.enabled = enabled; }),

    // UI
    openUpload: () => set(s => { s.ui.modals.uploadOpen = true; }),
    closeUpload: () => set(s => { s.ui.modals.uploadOpen = false; }),
    setLeftTab: (tab) => set(s => { s.ui.leftPane.tab = tab; }),
    toggleLeftPane: () => set(s => { s.ui.leftPane.open = !s.ui.leftPane.open; }),
  };
});
```

---

## `src/main.tsx`

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
```

---

## `src/App.tsx`

```tsx
import TopBar from './components/TopBar';
import LeftRail from './components/LeftRail';
import LeftPane from './components/LeftPane/LeftPane';
import Stage from './components/Stage/Stage';
import TimelineDock from './components/Timeline/TimelineDock';
import { useStore } from './store';

export default function App() {
  const leftOpen = useStore(s => s.ui.leftPane.open);
  return (
    <div className="h-screen w-screen grid"
         style={{ gridTemplateRows: '48px 1fr 220px', gridTemplateColumns: `56px ${leftOpen ? '340px' : '0px'} 1fr` }}>
      <div className="row-start-1 col-span-3 border-b border-white/10"><TopBar /></div>
      <div className="row-start-2 col-start-1"><LeftRail /></div>
      <div className="row-start-2 col-start-2 overflow-hidden"><LeftPane /></div>
      <div className="row-start-2 col-start-3 bg-black"><Stage /></div>
      <div className="row-start-3 col-span-3 border-t border-white/10 bg-zinc-950"><TimelineDock /></div>
    </div>
  );
}
```

---

## Top bar

### `src/components/TopBar.tsx`

```tsx
import { useStore } from '../store';

export default function TopBar() {
  const name = useStore(s => s.project.name);
  const rename = useStore(s => s.renameProject);
  const openUpload = useStore(s => s.openUpload);
  return (
    <div className="flex items-center gap-3 px-3 h-full bg-zinc-900">
      <div className="font-semibold">✦</div>
      <input
        className="bg-transparent outline-none border-b border-white/10 px-1"
        value={name}
        onChange={e => rename(e.target.value)}
      />
      <div className="ml-auto flex items-center gap-2">
        <button className="px-3 py-1 rounded bg-white/10">Comments</button>
        <button className="px-3 py-1 rounded bg-white/10">Settings</button>
        <button onClick={openUpload} className="px-3 py-1 rounded bg-indigo-600">Export Project</button>
      </div>
    </div>
  );
}
```

---

## Left rail & pane

### `src/components/LeftRail.tsx`

```tsx
import { useStore } from '../store';

const tabs = [
  { key: 'media', label: 'Media' },
  { key: 'text', label: 'Text' },
  { key: 'edit', label: 'Edit' },
] as const;

export default function LeftRail() {
  const tab = useStore(s => s.ui.leftPane.tab);
  const setTab = useStore(s => s.setLeftTab);
  const toggle = useStore(s => s.toggleLeftPane);

  return (
    <div className="h-full w-14 bg-zinc-950 flex flex-col items-center py-2 gap-2">
      {tabs.map(t => (
        <button key={t.key}
          onClick={() => setTab(t.key as any)}
          className={`w-12 h-12 text-xs rounded ${tab===t.key?'bg-white/10':'hover:bg-white/5'}`}>
          {t.label}
        </button>
      ))}
      <div className="mt-auto">
        <button onClick={toggle} className="w-12 h-12 rounded hover:bg-white/5">⇔</button>
      </div>
    </div>
  );
}
```

### `src/components/LeftPane/LeftPane.tsx`

```tsx
import { useStore } from '../../store';
import LibraryGrid from './LibraryGrid';
import UploadModal from './UploadModal';

export default function LeftPane() {
  const tab = useStore(s => s.ui.leftPane.tab);
  const open = useStore(s => s.ui.modals.uploadOpen);

  return (
    <div className="h-full w-full bg-zinc-900 overflow-y-auto">
      {tab === 'media' && <LibraryGrid />}
      {tab !== 'media' && (
        <div className="p-4 text-white/70 text-sm">Coming soon: {tab}</div>
      )}
      {open && <UploadModal />}
    </div>
  );
}
```

### `src/components/LeftPane/LibraryGrid.tsx`

```tsx
import { useStore } from '../../store';
import { Asset } from '../../types';

export default function LibraryGrid() {
  const assets = useStore(s => Object.values(s.project.assets));
  const addNode = useStore(s => s.addCanvasNode);
  const createClip = useStore(s => s.createClip);
  const playhead = useStore(s => s.transport.playheadMs);
  const mainTrackId = useStore(s => s.project.primaryTrackId);
  const openUpload = useStore(s => s.openUpload);

  const onCardClick = (a: Asset) => {
    createClip(a.id, mainTrackId, playhead);
    addNode(a.id);
  };

  return (
    <div className="p-3 grid grid-cols-2 gap-3">
      <button onClick={openUpload}
        className="h-24 rounded-lg border border-dashed border-white/20 text-white/70 hover:bg-white/5">
        + Upload Media
      </button>
      {assets.map(a => (
        <button key={a.id} onClick={() => onCardClick(a)} className="h-24 rounded-lg bg-zinc-800 overflow-hidden">
          {a.thumbSrc ? <img src={a.thumbSrc} className="w-full h-full object-cover" /> :
            <div className="w-full h-full flex items-center justify-center text-white/70">{a.name}</div>}
        </button>
      ))}
    </div>
  );
}
```

### `src/components/LeftPane/UploadModal.tsx`

```tsx
import { useStore } from '../../store';
import React from 'react';

export default function UploadModal() {
  const close = useStore(s => s.closeUpload);
  const add = useStore(s => s.addAssets);

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    await add(Array.from(files));
    close();
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    await add(Array.from(e.dataTransfer.files));
    close();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center" onClick={close}>
      <div
        onClick={e => e.stopPropagation()}
        onDragOver={e => e.preventDefault()}
        onDrop={onDrop}
        className="w-[520px] rounded-xl bg-zinc-900 border border-white/10 p-6 text-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Upload Media</h3>
          <button onClick={close} className="opacity-70 hover:opacity-100">✕</button>
        </div>
        <label className="block h-40 rounded-lg border border-dashed border-white/20 hover:bg-white/5 cursor-pointer
                           flex items-center justify-center">
          <input type="file" accept="video/*,image/*,audio/*" multiple className="hidden"
                 onChange={e => onFiles(e.target.files)} />
          <span>Click or drag files here</span>
        </label>
      </div>
    </div>
  );
}
```

---

## Stage (interactive canvas — just a skeleton)

### `src/components/Stage/Stage.tsx`

```tsx
import { useStore } from '../../store';
import CanvasNodeView from './CanvasNode';

export default function Stage() {
  const stage = useStore(s => s.project.stage);
  const nodes = useStore(s => Object.values(s.project.canvasNodes).sort((a,b)=>a.zIndex-b.zIndex));

  return (
    <div className="h-full w-full flex items-center justify-center bg-black">
      <div className="relative"
           style={{ width: stage.width, height: stage.height, background: stage.background }}>
        {nodes.map(n => <CanvasNodeView key={n.id} nodeId={n.id} />)}
      </div>
    </div>
  );
}
```

### `src/components/Stage/CanvasNode.tsx`

```tsx
import { useStore } from '../../store';
import React from 'react';

export default function CanvasNodeView({ nodeId }: { nodeId: string }) {
  const node = useStore(s => s.project.canvasNodes[nodeId]);
  const asset = useStore(s => s.project.assets[node.assetId]);
  const select = useStore(s => s.selectNodes);

  if (!node || !asset) return null;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: node.x - node.width/2,
    top: node.y - node.height/2,
    width: node.width,
    height: node.height,
    transform: `rotate(${node.rotationDeg}deg)`,
  };

  const body =
    asset.kind === 'image' ? <img src={asset.src} className="w-full h-full object-contain" /> :
    asset.kind === 'video' ? <video src={asset.src} className="w-full h-full object-contain" muted /> :
    <div className="w-full h-full bg-white/10" />;

  return (
    <div style={style} className="outline outline-1 outline-white/10 hover:outline-indigo-400"
         onMouseDown={(e) => { e.stopPropagation(); select([nodeId]); }}>
      {body}
      {/* TODO: handles for move/resize/rotate */}
    </div>
  );
}
```

---

## Timeline (skeleton with signatures)

### `src/components/Timeline/TimelineDock.tsx`

```tsx
import { useStore } from '../../store';
import Ruler from './Ruler';
import Track from './Track';

export default function TimelineDock() {
  const play = useStore(s => s.play);
  const pause = useStore(s => s.pause);
  const toggle = useStore(s => s.togglePlay);
  const playing = useStore(s => s.transport.playing);
  const zoom = useStore(s => s.transport.zoom);
  const setZoom = useStore(s => s.setZoom);
  const snap = useStore(s => s.transport.snap);
  const setSnap = useStore(s => s.setSnap);
  const tracks = useStore(s => Object.values(s.project.tracks));
  const ms = useStore(s => s.transport.playheadMs);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={toggle} className="px-2 py-1 rounded bg-white/10">{playing ? 'Pause' : 'Play'}</button>
        <div className="text-xs opacity-70">Time: {ms} ms</div>
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
      <div className="flex-1 overflow-auto">
        {tracks.map(t => <Track key={t.id} trackId={t.id} />)}
      </div>
    </div>
  );
}
```

### `src/components/Timeline/Ruler.tsx`

```tsx
import { useStore } from '../../store';

export default function Ruler() {
  const zoom = useStore(s => s.transport.zoom);
  // TODO: map zoom to tick spacing
  return <div className="h-6 bg-zinc-800 border-t border-b border-white/10 text-xs px-2 flex items-center">Ruler (zoom {zoom.toFixed(2)}x)</div>;
}
```

### `src/components/Timeline/Track.tsx`

```tsx
import { useStore } from '../../store';
import ClipView from './ClipView';

export default function Track({ trackId }: { trackId: string }) {
  const track = useStore(s => s.project.tracks[trackId]);
  const clips = useStore(s => track.clipOrder.map(id => s.project.clips[id]));
  if (!track) return null;
  return (
    <div className="h-16 border-b border-white/10 relative">
      {clips.map(c => <ClipView key={c.id} clipId={c.id} />)}
    </div>
  );
}
```

### `src/components/Timeline/ClipView.tsx`

```tsx
import { useStore } from '../../store';

const PX_PER_MS_BASE = 0.1; // placeholder

export default function ClipView({ clipId }: { clipId: string }) {
  const clip = useStore(s => s.project.clips[clipId]);
  const asset = useStore(s => s.project.assets[clip.assetId]);
  const zoom = useStore(s => s.transport.zoom);

  if (!clip || !asset) return null;

  const scale = PX_PER_MS_BASE * zoom;
  const style: React.CSSProperties = {
    position: 'absolute',
    left: clip.startMs * scale,
    width: (clip.endMs - clip.startMs) * scale,
    top: 8, bottom: 8,
  };

  return (
    <div style={style} className="rounded bg-indigo-600/50 border border-indigo-400/50 text-xs px-2 flex items-center">
      {asset.name}
      {/* TODO: trim handles, drag, split */}
    </div>
  );
}
```

---

## `src/hooks/useSnap.ts` (utility signature)

```ts
import { useStore } from '../store';
import type { Ms } from '../types';

export function useSnap() {
  const { enabled, thresholdMs, gridMs } = useStore(s => s.transport.snap);
  // Edges lookup would come from current track’s clips
  const snapTo = (valueMs: Ms, edgesMs: Ms[] = [], playheadMs?: Ms) => {
    if (!enabled) return valueMs;
    const candidates = [ ...edgesMs ];
    if (playheadMs != null) candidates.push(playheadMs);

    const grid = Math.round(valueMs / gridMs) * gridMs;
    candidates.push(grid);

    let best = valueMs;
    let bestDist = thresholdMs + 1;
    for (const c of candidates) {
      const d = Math.abs(c - valueMs);
      if (d < bestDist && d <= thresholdMs) { best = c; bestDist = d; }
    }
    return best;
  };
  return { snapTo };
}
```

---

### What’s intentionally stubbed (for the agent to fill next)

* Canvas node drag/resize/rotate handles & hit-testing.
* Timeline drag, trim handles, split (`S`), delete.
* Real ruler ticks + horizontal scroll/zoom mapping.
* DnD from Library → Canvas/Timeline (currently click-to-insert only).
* Keyboard shortcuts and playhead scrubbing.

When you’re ready, say the word and I’ll add the **drag/resize/rotate** contracts or the **timeline drag + snap math** in detail.
