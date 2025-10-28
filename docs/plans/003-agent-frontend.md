# Prompt — **Frontend Agent (React + Vite + shadcn/tailwind + Zustand)**

**Context**

* App: “Starscape Video Editor” (Tauri shell; this task is the web UI that drops into Tauri).
* Use the Starscape shadcn/tailwind theme tokens and utilities already generated.
* Follow the UI/interaction blueprint in `001-meta-UI.md` and the scaffold & contracts in `002-stub-UI.md`. Also mirror structure/decisions recorded in `docs.md`.   
* Tauri/React meta constraints live in `001-meta-TauriReact.md`; keep interop contracts compatible. 

**Goals (MVP)**

1. App shell (TopBar, LeftRail, LeftPane/Library, Stage/Canvas, TimelineDock) with responsive grid.
2. Library upload modal (picker + OS drag-drop) → assets show as cards.
3. Click asset card ⇒ insert **Clip** at playhead on **Main track** AND **CanvasNode** centered on Stage.
4. Stage: render CanvasNodes; select & focus; (handles can be stubbed but slots must exist).
5. Timeline: display tracks, clips; move/trim/split/delete **stubs** with clear function signatures + state updates.
6. Transport controls (play/pause toggle, zoom slider, snap toggle) wired to state only (rendering preview is a later backend concern).
7. Persist project state to localStorage; “Last edited …” stub.

**Tech**

* React + TypeScript + Vite.
* State: **Zustand** (shape/actions from the spec).
* DnD: **dnd-kit** (set up zones for Library→Canvas and Library→Timeline; it’s ok if first pass is click-to-insert with DnD TODO).
* Audio waveform & composites are **out of scope** for this pass (stubs ok).

**Deliverables**

* A working UI that compiles and runs (`pnpm dev` or `npm run dev`) with:

  ```
  src/
    main.tsx
    App.tsx
    types.ts            // matches spec types
    store.ts            // Zustand store with actions
    hooks/useSnap.ts    // snap util scaffold
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

  (Adapt/extend only if required by shadcn/tailwind setup from your theme files—use Starscape tokens, gradients, and glass utilities.)

**Implementation Notes**

* **State model & actions**: Use the concrete shapes and signatures from the scaffold (addAssets, addCanvasNode, createClip, moveClip, trimClip, splitClip, deleteClip, reorderClipWithinTrack, play/pause/seek, setZoom, setSnap). Keep milliseconds as the canonical timeline unit. (See `002-stub-UI.md`.) 
* **Layout grid**: 3 rows (TopBar / Main / Timeline), 3 cols (LeftRail / LeftPane / Stage). LeftPane collapsible.
* **Library**: First card = “Upload Media” button → modal; accept image/video/audio; create object URLs; push to store; stub thumbs.
* **Insert behaviors**:

  * Click card: create Clip at playhead on primary track + create centered CanvasNode with contain sizing.
  * DnD zones: set up boundaries and collision detection; initial version may only log drop targets and call existing actions.
* **Stage**: Render nodes sorted by zIndex; selection UX; handles may be TODO but add DOM anchors & data-ids so we can wire transform math in a later pass.
* **Timeline**:

  * Show ruler (zoom text stub is okay), tracks, and clip bars (width = (end-start)×scale).
  * Add trim handle divs (left/right) and emit action calls; movement & split can be button/shortcut stubs that call actions.
* **Theme**: All controls should use your Starscape shadcn component classes & Tailwind tokens; no raw inline colors—pull from your theme (Buttons, Dialog, Slider, etc.).

**Interop Contracts (with Backend)**

* Define TS types for commands (invoke names only; calls stubbed until backend lands):

  * `tauri.invoke('get_media_metadata', { path })`
  * `tauri.invoke('apply_edits', { projectJson })`
  * `tauri.invoke('generate_preview', { projectJson, atMs })`
  * `tauri.invoke('export_project', { projectJson, settings })`
* Keep a single **Project JSON** (serialized Zustand) to hand to backend. File format `.starproj` (JSON).

**Acceptance Criteria**

* Import, view assets, insert into canvas/timeline with one click.
* Move playhead; zoom and snap toggles update state.
* Split/trim/delete call store actions and update UI immediately.
* UI uses Starscape theme components; no visual regressions on dark backgrounds.
* Autosave to localStorage; TopBar shows name edit and “Export Project” stub.

**Where to look / align**

* UI spec & contracts: `001-meta-UI.md` (flow/regions), `002-stub-UI.md` (types/actions/scaffold), global docs in `docs.md`.   

**Log everything**

* Append a brief build log and any TODOs to `docs/logs/frontend-<date>.md`.

## Shared Notes (for both agents)

* **Theme & UI kit**: Always use Starscape shadcn components & Tailwind tokens; no inline ad-hoc colors. Reference the theme config files already in your repo. (See `docs.md` index and brand/theme docs.) 
* **Project format**: `.starproj` = serialized frontend state JSON. Keep it stable and backward-compatible.
* **Foldering**:

  * User-visible projects: `<appData>/projects/<id>/project.starproj`
  * Cache: `<appData>/cache/{thumbs,proxies,previews,segments}`
  * Renders: `<appData>/projects/<id>/renders/…`
* **Out of scope for MVP** (leave extension points): keyframes, transitions, overlays compositing, audio waveform, multi-select group ops, GPU pipelines.
