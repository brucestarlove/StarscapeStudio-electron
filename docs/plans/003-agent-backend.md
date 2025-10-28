# Prompt — **Backend Agent (Tauri + Rust + FFmpeg orchestration)**

**Context**

* Desktop app powered by **Tauri**; Rust side performs media I/O, metadata, previews, and final export.
* Must match the React contracts and project JSON produced by the frontend.
* Use structure & constraints from `001-meta-TauriReact.md` and capture decisions in `docs.md`.  

**Goals (MVP)**

1. Tauri project skeleton with Rust commands exposed to JS:

   * `get_media_metadata(path: String) -> MediaMeta`
   * `generate_preview(project_json: String, at_ms: u64) -> PreviewResult`  *(stub: return poster frame path or short LQ mp4)*
   * `apply_edits(project_json: String) -> Ok` *(validate & cache plan only)*
   * `export_project(project_json: String, settings: ExportSettings) -> ExportResult`
2. Internal **EditPlan** builder: parse the Project JSON (timeline, clips, trims) into a deterministic operation graph.
3. FFmpeg integration: either **ffmpeg-next** crate bindings or **spawn system ffmpeg** with safe args. For day-1, prefer `Command` with defensively escaped args; keep bindings as a later improvement.
4. A local cache layout under app data dir:

   ```
   <appData>/cache/
     thumbs/
     proxies/
     previews/
   <appData>/projects/
     <id>/
       project.starproj
       renders/
   ```
5. **Poster/preview** strategy (MVP): generate a poster JPG (or 1–2s LQ segment) at requested timecode for top track composition *or* simply the active clip frame (first pass). Return `file://` URL to UI.

**Tech**

* Tauri: commands (`#[tauri::command]`) + async runtime (tokio).
* Media tools: system FFmpeg required (document install check); later we can add static packaging.
* JSON: serde + schema struct that mirrors frontend’s Project/Clip/Track types.

**Command Contracts (IPC)**

* `get_media_metadata(path)`

  * Returns `{ duration_ms, width, height, has_audio, codec_video, codec_audio, rotation_deg? }` (best effort; some fields optional).
* `apply_edits(project_json)`

  * Validate media paths exist; build and memoize **EditPlan** (in memory + cache file). Return `{"status":"ok"}`.
* `generate_preview(project_json, at_ms)`

  * Use **EditPlan** to select visible clip(s) at t=at_ms.
  * MVP: select topmost visible video clip and extract a frame:
    `ffmpeg -ss {t} -i {clip} -frames:v 1 -q:v 5 <cache>/previews/{id}_{t}.jpg`
  * Return `{"url":"file://.../previews/..jpg","ts":at_ms}`.
* `export_project(project_json, settings)`

  * Settings: `{ format: "mp4"|"mov", width, height, fps, bitrate? }`
  * MVP: linear concat for sequential clips on main track (ignore overlays/transitions day-1).
  * Produce output in `<appData>/projects/<id>/renders/<timestamp>.<ext>` and return `{ "path":"file://...", "duration_ms":..., "size_bytes":... }`.

**EditPlan (MVP design)**

```rust
struct EditPlan {
  id: String,
  main_track: Vec<SeqClip>, // in timeline order, validated (no overlaps for MVP)
  overlay_track: Vec<SeqClip>, // reserved
}

struct SeqClip {
  src_path: PathBuf,
  in_ms: u64,
  out_ms: u64,
  start_ms: u64, // timeline position
  end_ms: u64,
}
```

* Build from the Project JSON (clips, tracks). Fail early on invalid timings or missing assets.

**Export pipeline (MVP)**

* **Simplest path**: generate temporary trimmed segments per clip, then concat:

  1. For each main-track clip:
     `ffmpeg -ss {in} -i {src} -t {len} -c copy <cache>/segments/{idx}.mp4` *(if codecs allow; otherwise transcode H.264 baseline for uniformity)*
  2. Create `concat.txt` and run:
     `ffmpeg -f concat -safe 0 -i concat.txt -c copy <renders>/<ts>.mp4`
* If stream copy fails across heterogeneous inputs, fallback: re-encode with common settings.

**Performance & Safety**

* All commands run on worker threads (`tokio::task::spawn_blocking`) to keep UI responsive.
* Sanitize paths; never interpolate unescaped user strings into shell; use `Command` arg vectors.
* Cache busting by content hash (later). For MVP, time-stamped filenames are fine.
* Report progress via `tauri::Window::emit("export_progress", …)` (optional stub).

**Tests / Acceptance**

* Metadata returns for common files (mp4, mov, mp3, wav, png, jpg).
* `apply_edits` accepts a valid sample `.starproj` and writes a cache file.
* `generate_preview` returns a valid `file://` path; file exists.
* `export_project` produces playable mp4 at requested resolution (fallback to source if not specified).

**Interop with Frontend**

* Frontend will **serialize the same Project state** (clips, tracks, trims) as JSON and send to these commands.
* Leave a `bindings.ts` helper with type signatures for `invoke()` usage (string literal command names must match).

**Where to look / align**

* Tauri + React meta: `001-meta-TauriReact.md`.
* Global docs/logs structure: `docs.md` (record assumptions, ffmpeg presence check, cache paths).  

**Log everything**

* Append a brief build log and TODOs to `docs/logs/backend-<date>.md`.

---

## Shared Notes (for both agents)

* **Theme & UI kit**: Always use Starscape shadcn components & Tailwind tokens; no inline ad-hoc colors. Reference the theme config files already in your repo. (See `docs.md` index and brand/theme docs.) 
* **Project format**: `.starproj` = serialized frontend state JSON. Keep it stable and backward-compatible.
* **Foldering**:

  * User-visible projects: `<appData>/projects/<id>/project.starproj`
  * Cache: `<appData>/cache/{thumbs,proxies,previews,segments}`
  * Renders: `<appData>/projects/<id>/renders/…`
* **Out of scope for MVP** (leave extension points): keyframes, transitions, overlays compositing, audio waveform, multi-select group ops, GPU pipelines.

---

If you want, I can also drop in:

* A **sample `.starproj`** JSON with two clips on the main track (for backend tests), and
* A tiny **`bindings.ts`** for `invoke()` calls on the frontend.
