# Starscape Editor — MVP UI Spec (for AI Dev, chunked)

Below is a clear, minimal-but-solid blueprint. It builds from a stable foundation into three core surfaces: **(A) Canvas**, **(B) Library Pane**, **(C) Timeline**.

Assumptions (tweak as needed):

* **React + TypeScript**, **Vite/Next.js**, **Tailwind** for layout, **Zustand** (or Redux) for state, **dnd-kit** for drag/drop, **React Aria** (or Headless UI) for a11y, **ffmpeg.wasm** later.
* Pixel-perfect snap/drag uses your chosen **resolution space** (e.g., timeline pixels per second).

---

## 0) Foundation (Layout, State, Events)

### 0.1 Layout regions (app shell)

* **TopBar** (fixed)
* **LeftRail** (thin icon menu, fixed)
* **LeftPane** (collapsible drawer, scrollable content)
* **Stage** (center; interactive **Canvas**)
* **TimelineDock** (bottom; timeline + transport)

Flexible grid:

* `grid-rows: [TopBar auto] [Main 1fr] [Timeline auto]`
* `grid-cols: [LeftRail auto] [LeftPane 300–360px collapsible] [Stage 1fr]`

### 0.2 Global state (Zustand example shape)

```ts
type AssetId = string;
type TrackId = string;
type ClipId = string;
type Ms = number;

type Asset = {
  id: AssetId;
  kind: 'video' | 'image' | 'audio' | 'text';
  name: string;
  src: string;         // blob/object URL
  durationMs?: Ms;     // if known (video/audio)
  thumbSrc?: string;
  meta?: Record<string, any>;
};

type CanvasNodeId = string;
type CanvasNode = {
  id: CanvasNodeId;
  assetId: AssetId;
  x: number; y: number; // canvas coords (center-anchored or top-left—choose one and stick to it)
  width: number; height: number;
  rotationDeg: number;
  zIndex: number;
  locked?: boolean;
  visible?: boolean;
};

type Clip = {
  id: ClipId;
  assetId: AssetId;
  trackId: TrackId;
  startMs: Ms;         // timeline start
  endMs: Ms;           // timeline end (exclusive)
  inMs: Ms;            // trim in (source offset)
  outMs: Ms;           // trim out (source offset)
};

type Track = {
  id: TrackId;
  role: 'main' | 'overlay'; // MVP: at least 2 tracks
  clipOrder: ClipId[];      // render order left->right
};

type Project = {
  id: string;
  name: string;
  stage: { width: number; height: number; background: string };
  assets: Record<AssetId, Asset>;
  canvasNodes: Record<CanvasNodeId, CanvasNode>;
  tracks: Record<TrackId, Track>;
  clips: Record<ClipId, Clip>;
  primaryTrackId: TrackId;
  overlayTrackId: TrackId;
};

type Transport = {
  playing: boolean;
  playheadMs: Ms;
  zoom: number; // timeline zoom scalar
  snap: { enabled: boolean; thresholdMs: Ms };
};

type UIState = {
  leftPane: { open: boolean; tab: 'media' | 'text' | 'edit' };
  modals: { uploadOpen: boolean; settingsOpen: boolean; commentsOpen: boolean; aiOpen: boolean };
  selection: { canvasNodeIds: CanvasNodeId[]; clipIds: ClipId[] };
  hover: { target?: { type: 'clip'|'handle'|'canvasNode'|'guide'; id?: string } };
};

type RootState = {
  project: Project;
  transport: Transport;
  ui: UIState;
  // actions... (see 0.3)
};
```

### 0.3 Core actions (event contracts)

* Transport: `play()`, `pause()`, `seek(ms)`, `togglePlay()`, `setZoom(v)`, `setSnap(on)`
* Project: `renameProject(name)`
* Assets: `addAssets(files[])`, `removeAsset(id)`
* Canvas:

  * `addCanvasNode(assetId)`
  * `transformNode(id, {x,y,width,height,rotationDeg})`
  * `bringToFront(id)`, `sendToBack(id)` (normalize `zIndex`)
  * `deleteNode(id)`, `selectNodes(ids)`, `nudge(id, dx, dy)`
* Timeline:

  * `createClip(assetId, trackId, atMs)`
  * `moveClip(clipId, toMs)`
  * `trimClip(clipId, {startMs?, endMs?, inMs?, outMs?})`
  * `splitClip(clipId, atMs)` → returns `[leftId, rightId]`
  * `deleteClip(clipId)`
  * `reorderClipWithinTrack(clipId, beforeClipId?)`
* Library → Canvas/Timeline bridge:

  * Drop-to-Canvas: `addCanvasNode(assetId)` at drop coordinates
  * Drop-to-Timeline: `createClip(assetId, targetTrack, atMs)`

### 0.4 Precision & snapping constants

* **Timeline grid**: `gridMs = 100` (MVP), snap threshold `<= 80ms`
* **Canvas snap** (later): to bounds, centers, and node edges (MVP off; keep interface ready)

---

## 1) Top Bar (MVP)

**Left:** Logo, `[input] Project name`, (AI Modal icon — stub)
**Right:** “Last edited …” (stub), Comments icon (stub), Settings icon (opens a settings modal), **Export** button (stub)

**Acceptance**

* Project name edits persist in state.
* Settings modal opens/closes; no settings needed yet.

---

## 2) Left Rail (MVP)

Vertical buttons:

* **Media** (default)
* **Text** (stub)
* **Edit** (stub)

**Acceptance**

* Clicking a button switches the **LeftPane** tab.
* LeftPane collapsible via chevron toggle.

---

## 3) Left Pane — Library (B)

### 3.1 UI

* Scrollable grid of same-sized cards.
* **First card pinned:** “Upload Media” → opens **Upload Modal**.
* Cards show thumbnail + filename; click = **insert** (see 3.3).

### 3.2 Upload Modal (critical drag-drop test)

* Big “Click to upload” button + system file picker (accept: video/image/audio).
* **Drag & drop from OS** onto modal to upload (multi-file).
* Show a short queue; on success, assets appear in Library.
* Close with **X** top-right or `Esc`.

### 3.3 Insertion behaviors

* **Click a library card:**

  * Create a **clip** at **current playhead** on **primary track**, length = `min(asset.duration, defaultClipMs)`.
  * Also add a **CanvasNode** centered on stage sized to fit within stage (contain).
* **Drag from Library → Canvas:** adds a **CanvasNode** at drop point (preserve aspect ratio).
* **Drag from Library → Timeline:** adds a **Clip** to the hovered track at hovered time.

### 3.4 Acceptance

* Upload works via both picker and drag-drop.
* New assets receive generated thumbnails (stub acceptable).
* Click/drag behaviors create corresponding node/clip with correct defaults.
* Library grid virtualizes if > ~200 assets (optional; stub fine for MVP).

---

## 4) Stage — Interactive Canvas (A)

### 4.1 Behavior (MVP)

* Renders background (solid color or image).
* Renders **CanvasNodes** sorted by `zIndex`.
* **Select** with click; **Shift+Click** multi-select.
* **Transform**: drag to move; corner handles for **resize** (lock aspect ratio with `Shift`); rotation handle for **rotate**.
* **Delete** key removes selected nodes.
* **Bring to Front / Send to Back** via context menu or `]` / `[` shortcuts.

### 4.2 Hit testing & transforms

* Node frame has hit regions: body (move), corners (resize), top arc (rotate).
* Keep transforms numerically stable (single source of truth; apply transform matrix or maintained props—not both).

### 4.3 Acceptance

* Can add, select, move, resize, rotate, delete nodes smoothly at 60fps on moderate scenes (≤ 20 nodes).
* z-order controls work deterministically (highest `zIndex` renders on top).

---

## 5) Bottom Timeline (C)

### 5.1 Transport & ruler

* **Play/Pause** button, **current time** readout (mm:ss.ff), **Zoom** slider, **Snap** toggle.
* **Ruler** showing time ticks dependent on zoom (e.g., 1s/500ms/100ms).
* **Playhead** draggable; clicking the ruler seeks.

### 5.2 Tracks & clips

* At least **2 tracks**: Main (video) and Overlay (PiP).
* Clips render as bars with:

  * Trim handles at left/right.
  * Label = asset name.
* **Drag from Library** to add a clip at hover time/track.
* **Reorder** clips by dragging within the same track.
* **Move** clip horizontally; snap to grid/clip edges when Snap is on.
* **Trim** by dragging edges; **Split** at playhead (button or `S`).
* **Delete** via `Del` or context menu.

### 5.3 Zoom & snap rules

* Zoom scales pixels-per-millisecond.
* Snap checks:

  * Near ruler gridlines (`gridMs`),
  * Other clip edges on same track,
  * Playhead position.

### 5.4 Acceptance

* Can drag, arrange, trim, split, delete clips.
* Zoom works without reflow glitches.
* Snap feels consistent and can be toggled.

---

## 6) Interaction Contracts (cross-surface)

* **Playhead ↔ Canvas preview:** moving playhead updates preview frame (stub: poster frame).
* **Library → Timeline:** create `Clip` at drop time (respect Snap).
* **Library → Canvas:** create `CanvasNode` at drop coordinates.
* **Click Library Card:** insert both Clip (at playhead on main track) **and** centered CanvasNode.

---

## 7) Minimal Rendering Contracts

* **Preview video** (for now) can be the asset’s `<video>` element muted, paused, seeking when playhead moves (later: composited render).
* **Image/Text** assets render as DOM/CSS transforms or canvas; pick one and keep consistent.
* **Audio**: list and duration only (no playback MVP).

---

## 8) Error States & Persistence

* If upload fails → toast + keep modal open.
* If an asset is missing → show “Missing” badge on card/clip.
* Persist project state to localStorage on change (MVP).
  Later: file-backed or cloud sync.

---

## 9) Keyboard Shortcuts (MVP)

* `Space` Play/Pause
* `S` Split at playhead
* `Del/Backspace` Delete selection
* `[` Send backward / `]` Bring forward
* `Cmd/Ctrl + =/-` Zoom in/out timeline
* Arrow keys nudge selected canvas node (1–5px; with Shift ×10)

---

## 10) Testing & Acceptance (per chunk)

### Chunk 0 — Shell

* Layout regions render; resizing window preserves proportions.
* LeftPane toggles; active tab persists.

### Chunk 1 — Library + Upload Modal

* DnD from OS adds files; cards appear; basic metadata captured.

### Chunk 2 — Canvas nodes

* Add node (from card click or drop). Transform + z-order works. Delete works.

### Chunk 3 — Timeline core

* Drop/insert clips, move, trim, split, delete. Playhead seek updates preview.

### Chunk 4 — Precision polish

* Zoom scales ruler & clip widths smoothly. Snap behaves per rules.

### Chunk 5 — Persistence & settings

* Project rename persists. Autosave (localStorage) with “Last edited …” indicator.

---

## 11) Developer Notes (precision engineering for DnD)

* Use **dnd-kit** with **custom collision detection**:

  * Distinguish **Canvas drop zone** vs **Timeline drop zone**.
  * Convert client coordinates → canvas coordinates (account for stage scaling/letterboxing).
  * Timeline hit-test maps x → time using current zoom and scroll offset.
* Always keep **one canonical coordinate system** per surface:

  * Canvas: stage-space units (e.g., 0..width, 0..height)
  * Timeline: milliseconds
* Centralize **snap** in a utility: `snapTo({valueMs, gridMs, edgesMs[], playheadMs, thresholdMs})`.

---

## 12) Small UX touches (MVP-friendly)

* While dragging over Canvas, show ghost outline at expected size.
* While dragging over Timeline, show a vertical ghost playhead + clip shadow.
* Show a subtle edge-highlight when a drop zone is active.

---

## 13) Future (not in MVP, but keep hooks)

* Multi-select clips + group move.
* Transitions & keyframes.
* Audio waveform & scrubbing.
* AI modal (generate captions, B-roll, effects).
* Export (composition + ffmpeg pipeline).
* Guides/smart align on Canvas.
* Text assets with live editing.

---

### Hand-off Prompt Snippets

**Create app shell + state store**

* “Build a React + TS app shell with regions TopBar, LeftRail, LeftPane, Stage, TimelineDock using Tailwind CSS grid. Implement Zustand store with the `RootState` types above and stub actions. Wire LeftRail tabs to LeftPane.”

**Implement Upload Modal with DnD**

* “Add an Upload Modal. Use input[type=file] and OS drag-drop onto the modal. On drop/pick, create object URLs, populate `Asset` records, and push into `project.assets`. Create thumbnails (stub placeholder).”

**Library interactions**

* “Render a grid of Asset cards. On card click, insert a Clip at playhead on primary track and add a centered CanvasNode. Support drag from card into Canvas (node) and into Timeline (clip).”

**Canvas transforms**

* “Render CanvasNodes with move/resize/rotate handles (pointer events). Update store via `transformNode`. Maintain `zIndex`. Add Delete and bring/send shortcuts.”

**Timeline basics**

* “Render ruler, playhead, zoom slider. Tracks render clips with trim handles. Implement move, trim, split, delete. Add snap logic per spec. Scrollable horizontally.”
