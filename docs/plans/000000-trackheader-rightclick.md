A compact, drop-in **Track Header Context Menu** with **Insert Above/Below, Mute, Solo, Delete** wired to store stubs. Included the minimal type/store tweaks and a simple right-click popup that closes on outside click/escape.

---

# 0) Type tweaks

### `types.ts`

```ts
export interface Track {
  id: TrackId;
  role: 'main' | 'overlay';
  clipOrder: ClipId[];
  muted?: boolean;
  solo?: boolean;
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
  trackOrder: TrackId[];           // NEW: explicit render order
}

export interface RootState {
  // …
  // Track ops (NEW)
  insertTrackRelative: (refId: TrackId, where: 'above'|'below', role?: Track['role']) => TrackId;
  deleteTrack: (trackId: TrackId) => void;
  toggleTrackMute: (trackId: TrackId) => void;
  toggleTrackSolo: (trackId: TrackId) => void;
  setActiveTrack: (id: TrackId) => void;
}
```

---

# 1) Store additions

### `store.ts`

```ts
// inside create<RootState>((set, get) => { … })

// initial tracks + order
const main = mkTrack('main');
const overlay = mkTrack('overlay');
const project: Project = {
  // …
  tracks: { [main.id]: main, [overlay.id]: overlay },
  trackOrder: [main.id, overlay.id],       // NEW
  primaryTrackId: main.id,
  overlayTrackId: overlay.id,
};

// helper: make a new track
const mkTrack = (role: Track['role']): Track => ({ id: nanoid(), role, clipOrder: [], muted: false, solo: false });

return {
  // …existing state/actions…

  insertTrackRelative: (refId, where, role='overlay') => {
    const id = nanoid();
    set(s => {
      const t = mkTrack(role);
      t.id = id;
      s.project.tracks[id] = t;
      const arr = s.project.trackOrder;
      const idx = Math.max(0, arr.indexOf(refId));
      const at = where === 'above' ? idx : idx + 1;
      arr.splice(at, 0, id);
      s.ui.activeTrackId = id;
    });
    return id;
  },

  deleteTrack: (trackId) => set(s => {
    const { trackOrder, tracks, clips } = s.project;
    if (trackOrder.length <= 1) return; // keep at least one
    // move clips off the track (simple: delete them)
    for (const clipId of tracks[trackId].clipOrder) delete clips[clipId];
    delete tracks[trackId];
    const idx = trackOrder.indexOf(trackId);
    if (idx>=0) trackOrder.splice(idx,1);
    if (s.ui.activeTrackId === trackId) s.ui.activeTrackId = trackOrder[ Math.max(0, idx-1) ] ?? trackOrder[0];
    // maintain primary/overlay refs if needed (optional)
    if (s.project.primaryTrackId === trackId) s.project.primaryTrackId = trackOrder[0];
    if (s.project.overlayTrackId === trackId) s.project.overlayTrackId = trackOrder.find(id => tracks[id]?.role==='overlay') ?? trackOrder[0];
  }),

  toggleTrackMute: (trackId) => set(s => { s.project.tracks[trackId].muted = !s.project.tracks[trackId].muted; }),

  toggleTrackSolo: (trackId) => set(s => {
    const cur = s.project.tracks[trackId].solo = !s.project.tracks[trackId].solo;
    // optional UX: if turning solo on, unmute that track and optionally clear others’ solo
    if (cur) s.project.tracks[trackId].muted = false;
  }),
};
```

> Note: playback mixing isn’t implemented here; we just store `muted/solo`. Later, your render/preview will respect: if any track has `solo=true`, only those play; else exclude `muted=true`.

---

# 2) Render tracks in declared order

Update **anywhere** you read tracks (e.g., `TimelineDock`, `TracksArea`) to use `project.trackOrder`:

### `TimelineDock.tsx` (TracksArea)

```tsx
const order = useStore(s => s.project.trackOrder);
const tracks = useStore(s => s.project.tracks);
{/* … */}
{order.map(id => <Track key={id} trackId={id} />)}
```

---

# 3) Context menu component

### `src/components/Timeline/TrackContextMenu.tsx`

```tsx
import { useEffect } from 'react';

export interface TrackMenuProps {
  x: number; y: number;
  role: 'main'|'overlay';
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  muted: boolean; solo: boolean;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function TrackContextMenu(p: TrackMenuProps) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') p.onClose(); };
    const onClick = (e: MouseEvent) => {
      // close if clicking outside menu
      const el = document.getElementById('track-menu');
      if (el && !el.contains(e.target as Node)) p.onClose();
    };
    window.addEventListener('keydown', onEsc);
    window.addEventListener('mousedown', onClick);
    return () => { window.removeEventListener('keydown', onEsc); window.removeEventListener('mousedown', onClick); };
  }, []);

  return (
    <div id="track-menu"
         className="fixed z-50 min-w-48 rounded-lg border border-white/10 bg-zinc-900 shadow-xl"
         style={{ left: p.x, top: p.y }}>
      <div className="py-1 text-sm">
        <Item onClick={p.onInsertAbove}>Insert track above</Item>
        <Item onClick={p.onInsertBelow}>Insert track below</Item>
        <Sep />
        <Item onClick={p.onToggleMute}>{p.muted ? 'Unmute' : 'Mute'}</Item>
        <Item onClick={p.onToggleSolo}>{p.solo ? 'Unsolo' : 'Solo'}</Item>
        <Sep />
        <Item danger onClick={p.onDelete}>Delete track</Item>
      </div>
    </div>
  );
}

function Item({ children, onClick, danger=false }: { children: React.ReactNode; onClick: ()=>void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-2 hover:bg-white/10 ${danger ? 'text-rose-400' : 'text-white'}`}>
      {children}
    </button>
  );
}
function Sep() { return <div className="my-1 h-px bg-white/10" />; }
```

---

# 4) Hook the menu to the track header

### `src/components/Timeline/Track.tsx`

```tsx
import { useState } from 'react';
import { useStore } from '../../store';
import ClipView from './ClipView';
import TrackContextMenu from './TrackContextMenu';

export default function Track({ trackId }: { trackId: string }) {
  const track = useStore(s => s.project.tracks[trackId]);
  const clips = useStore(s => track.clipOrder.map(id => s.project.clips[id]));
  const activeId = useStore(s => s.ui.activeTrackId);
  const setActive = useStore(s => s.setActiveTrack);

  const insertRel = useStore(s => s.insertTrackRelative);
  const delTrack  = useStore(s => s.deleteTrack);
  const toggleMute = useStore(s => s.toggleTrackMute);
  const toggleSolo = useStore(s => s.toggleTrackSolo);

  const [menu, setMenu] = useState<null | { x:number; y:number }>(null);

  if (!track) return null;
  const isActive = activeId === trackId;

  const openMenu: React.MouseEventHandler = (e) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className={`h-20 relative flex border-b border-white/10 ${isActive ? 'bg-white/3' : ''}`}>
      {/* Track header / gutter */}
      <button
        onClick={() => setActive(trackId)}
        onContextMenu={openMenu}
        className={`w-28 shrink-0 text-left px-3 text-xs uppercase tracking-wide
                    border-r border-white/10 ${isActive ? 'text-white' : 'text-white/60'}`}
        title="Right-click for more • Click to focus"
      >
        <div className="flex items-center gap-2">
          <span>{track.role === 'main' ? 'Main' : 'Overlay'}</span>
          {track.muted && <span className="text-amber-400">M</span>}
          {track.solo && <span className="text-emerald-400">S</span>}
        </div>
        {isActive && <span className="text-[10px] rounded px-1 bg-white/10 mt-1 inline-block">Active</span>}
      </button>

      {/* Clip lane */}
      <div className="flex-1 relative">
        {clips.map(c => <ClipView key={c.id} clipId={c.id} />)}
      </div>

      {/* Active accent */}
      {isActive && <div className="absolute inset-y-0 left-0 w-1 bg-indigo-500" />}

      {menu && (
        <TrackContextMenu
          x={menu.x} y={menu.y}
          role={track.role}
          muted={!!track.muted} solo={!!track.solo}
          onInsertAbove={() => { insertRel(trackId, 'above'); setMenu(null); }}
          onInsertBelow={() => { insertRel(trackId, 'below'); setMenu(null); }}
          onToggleMute={() => { toggleMute(trackId); setMenu(null); }}
          onToggleSolo={() => { toggleSolo(trackId); setMenu(null); }}
          onDelete={() => { delTrack(trackId); setMenu(null); }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
```

---

# 5) (Optional) “Insert from Library” uses active track

You already wired this earlier, but just to confirm:

### `LibraryGrid.tsx`

```tsx
const activeTrackId = useStore(s => s.ui.activeTrackId);
const defaultTrackId = useStore(s => s.project.primaryTrackId);
const trackId = activeTrackId ?? defaultTrackId;
// createClip(a.id, trackId, playhead) …
```

---

## Acceptance (MVP)

* Right-clicking a track header opens the menu at cursor.
* **Insert above/below** creates a new track, focuses it, and keeps order stable.
* **Mute/Solo** toggle flags (visible “M/S” badges).
* **Delete** removes the track and its clips (cannot delete the last track).
* The **active track** remains highlighted; library inserts target it by default.
