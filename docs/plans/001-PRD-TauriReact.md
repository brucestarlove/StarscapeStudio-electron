Here’s a concise, production-ready **Product Requirements Document (PRD)** you can paste directly into your AI developer chat or project repo.

---

# 🎬 Lightweight Desktop Video Editor — Tauri + Rust + React/Vite

## 1. Overview

We are building a **lightweight desktop video editor** using **Tauri (Rust backend + React/Vite frontend)**.
The goal is to provide fast, low-resource local video editing with a clean UI for trimming, layering, transitions, and exporting.
All video processing will occur natively in Rust (via FFmpeg bindings) while the React frontend serves as a control panel.

---

## 2. Architecture Summary

| Layer              | Tech                  | Responsibility                                             |
| ------------------ | --------------------- | ---------------------------------------------------------- |
| **Frontend (UI)**  | React + Vite          | Timeline editing, clip arrangement, user actions, previews |
| **Backend (Core)** | Rust (Tauri commands) | Video processing, FFmpeg calls, edit staging, rendering    |
| **Bridge**         | Tauri API             | Invokes Rust commands from React, returns results/previews |

---

## 3. Functional Requirements

### 3.1. Core Editing Features

* **Clip Management**

  * Import local video/audio clips.
  * Display clips on a timeline (sortable + resizable).
  * Metadata stored: `id`, `file_path`, `duration`, `thumbnail`, `start_time`, `end_time`.

* **Editing Actions**

  * Trim (start/end timestamps)
  * Split clip
  * Merge clips
  * Fade in/out
  * Adjust volume, brightness, contrast (basic filters)
  * Mute/unmute audio
  * Add transition between clips (fade, crossfade)

* **Preview**

  * Generate low-resolution preview for fast playback.
  * Refresh preview after each edit action.
  * Render previews asynchronously via Rust backend.

* **Export**

  * Export edited sequence to `.mp4` (default) or `.mov`.
  * Allow user to choose resolution and bitrate.

---

## 4. Command/Action Flow

### 4.1. Frontend → Backend

The React app sends JSON instructions to Rust through Tauri commands.

Example:

```ts
await invoke("apply_edit", {
  edits: [
    { action: "trim", clip_id: 1, start: 10, end: 30 },
    { action: "fade_in", clip_id: 1, duration: 2 },
  ]
});
```

### 4.2. Backend → Frontend

Rust returns:

```json
{
  "status": "ok",
  "preview_url": "file:///tmp/preview_123.mp4"
}
```

---

## 5. Backend Logic (Rust)

### 5.1. Edit List

Maintain a list of edit operations:

```rust
struct Edit {
    action: String,
    clip_id: u32,
    params: HashMap<String, f64>
}

struct ProjectState {
    edits: Vec<Edit>,
    clips: Vec<Clip>,
}
```

### 5.2. Processing

* Each edit modifies a local file or temporary cache.
* Heavy operations run asynchronously via `tokio::spawn`.
* Use `ffmpeg-next` or system FFmpeg calls.
* Final export applies all edits in order using concatenated FFmpeg commands.

### 5.3. Undo System

* `undo_last_edit()` simply pops the last item from `ProjectState.edits` and re-applies the rest.
* Optionally maintain a redo stack.

---

## 6. Frontend UI Structure

### 6.1. Components

* `Timeline` – draggable clips
* `ClipItem` – visual representation of a video segment
* `VideoPreview` – renders live preview
* `ControlPanel` – trim buttons, transitions, effects
* `ExportModal` – export options (filename, format, quality)

### 6.2. State

Use Zustand or Redux for:

```ts
{
  clips: Clip[],
  edits: Edit[],
  currentPreview: string,
}
```

### 6.3. Communication

Use Tauri’s `invoke()` for calling backend commands:

* `load_clip(path)`
* `apply_edit(edits)`
* `undo_last_edit()`
* `export_video(settings)`

---

## 7. Non-Functional Requirements

* Lightweight (<100 MB app size, low CPU usage)
* Cross-platform (macOS + Windows)
* All processing is local; no cloud dependencies
* Asynchronous Rust backend ensures non-blocking UI
* Modular architecture for future AI-assisted editing

---

## 8. Stretch Goals

* AI auto-clip detection (via ML model)
* Color grading presets
* Audio waveform visualization
* GPU acceleration (Metal/Vulkan support)
* Timeline keyframe support
