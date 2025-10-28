* **Active track:** a single timeline track marked as the current focus. When set, default actions (like splitting when nothing is selected, inserting a clip from the library, paste, etc.) target **that** track instead of *all tracks*.
* **Track header click:** a small clickable area at the left of each track that, when clicked, sets that track as the active one (and gives it a subtle highlight).

Here’s exactly how to add it to your scaffold:

---

## 1) Extend UI state + actions

**`types.ts`**

```ts
export interface UIState {
  leftPane: { open: boolean; tab: 'media' | 'text' | 'edit' };
  modals: { uploadOpen: boolean; settingsOpen: boolean; commentsOpen: boolean; aiOpen: boolean };
  selection: { canvasNodeIds: CanvasNodeId[]; clipIds: ClipId[] };
  hover: { target?: { type: 'clip' | 'handle' | 'canvasNode' | 'guide'; id?: string } };
  activeTrackId?: TrackId; // NEW
}
```

**`store.ts` (initial + action)**

```ts
// initial UI
ui: {
  leftPane: { open: true, tab: 'media' },
  modals: { uploadOpen: false, settingsOpen: false, commentsOpen: false, aiOpen: false },
  selection: { canvasNodeIds: [], clipIds: [] },
  hover: {},
  activeTrackId: main.id, // default focus main track
},

// action
setActiveTrack: (id: TrackId) => set(s => { s.ui.activeTrackId = id; }),
```

Add the signature to `RootState`:

```ts
setActiveTrack: (id: TrackId) => void;
```

---

## 2) Clickable track header + visual highlight

Give each track a left “gutter” that sets active and shows state.

**`components/Timeline/Track.tsx`**

```tsx
import { useStore } from '../../store';
import ClipView from './ClipView';

export default function Track({ trackId }: { trackId: string }) {
  const track = useStore(s => s.project.tracks[trackId]);
  const clips = useStore(s => track.clipOrder.map(id => s.project.clips[id]));
  const activeId = useStore(s => s.ui.activeTrackId);
  const setActive = useStore(s => s.setActiveTrack);

  if (!track) return null;
  const isActive = activeId === trackId;

  return (
    <div className={`h-20 relative flex border-b border-white/10 ${isActive ? 'bg-white/3' : ''}`}>
      {/* Track header / gutter */}
      <button
        onClick={() => setActive(trackId)}
        className={`w-24 shrink-0 text-left px-3 text-xs uppercase tracking-wide
                    border-r border-white/10 ${isActive ? 'text-white' : 'text-white/60'}`}
        title="Click to focus this track"
      >
        {track.role === 'main' ? 'Main' : 'Overlay'}
        {isActive && <span className="ml-2 text-[10px] rounded px-1 bg-white/10">Active</span>}
      </button>

      {/* Clip lane */}
      <div className="flex-1 relative">
        {clips.map(c => <ClipView key={c.id} clipId={c.id} />)}
      </div>

      {/* Left accent line when active */}
      {isActive && <div className="absolute inset-y-0 left-0 w-1 bg-indigo-500" />}
    </div>
  );
}
```

---

## 3) Make split (`S`) prefer the active track

**`components/Timeline/TimelineDock.tsx`** (replace the split section in the key handler)

```tsx
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() !== 's') return;
    const st = useStore.getState();
    const { clips, tracks } = st.project;
    const playhead = st.transport.playheadMs;

    const selected = st.ui.selection.clipIds;
    let targetIds: string[];

    if (selected.length > 0) {
      targetIds = selected.slice();
    } else if (st.ui.activeTrackId) {
      const t = tracks[st.ui.activeTrackId];
      targetIds = t ? t.clipOrder.slice() : [];
    } else {
      targetIds = Object.values(tracks).flatMap(t => t.clipOrder);
    }

    for (const id of targetIds) {
      const c = clips[id];
      if (c && playhead > c.startMs && playhead < c.endMs) {
        st.splitClip(id, playhead);
      }
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, []);
```

---

## 4) Make “insert from Library” target the active track

**`components/LeftPane/LibraryGrid.tsx`** (use active when present)

```tsx
const activeTrackId = useStore(s => s.ui.activeTrackId);
const defaultTrackId = useStore(s => s.project.primaryTrackId);

const onCardClick = (a: Asset) => {
  const trackId = activeTrackId ?? defaultTrackId;
  createClip(a.id, trackId, playhead);
  addNode(a.id);
};
```

---

## 5) Nice-to-have: keyboard to change active track

Add Up/Down to jump focus between tracks.

**`TimelineDock.tsx`** (in the same key handler useEffect, add:)

```tsx
if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
  e.preventDefault();
  const st = useStore.getState();
  const ids = Object.keys(st.project.tracks); // order you render them in; optionally keep a separate ordered array
  const cur = st.ui.activeTrackId;
  const idx = Math.max(0, ids.indexOf(cur ?? ids[0]));
  const next = e.key === 'ArrowUp' ? Math.max(0, idx-1) : Math.min(ids.length-1, idx+1);
  st.setActiveTrack(ids[next]);
  return;
}
```

---

### Why this helps

* Keeps destructive actions scoped (no accidental splits across every track).
* Gives the AI (and you) a deterministic default for “where should this go?”
* Sets you up for future ops like **Paste**, **Insert Silence**, **Record to track**, etc.
