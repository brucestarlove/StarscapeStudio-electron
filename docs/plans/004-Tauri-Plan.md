# Tauri Rust Backend Plan (MVP)

## Scope

Implement a Rust backend that supports MVP features: import, preview, basic trim, and export. Integrate a background job queue (progress events) and bundle FFmpeg as a per-OS sidecar.

## Key Decisions

- **FFmpeg**: Bundle per-OS static binaries as Tauri sidecars (`ffmpeg`/`ffprobe`).
- **Jobs**: Background job queue with progress via events/channels; non-blocking UI.

## Commands (IPC)

- `get_media_metadata(path: String) -> MediaMeta`
- `apply_edits(project_json: String) -> Ok` (build + cache `EditPlan`)
- `generate_preview(project_json: String, at_ms: u64) -> PreviewResult`
- `export_project(project_json: String, settings: ExportSettings) -> ExportResult`
- `subscribe_export_progress(channel: Channel<ProgressEvent>)` (optional; or emit events `export_progress`)

## Data Models (Rust)

- `MediaMeta { duration_ms, width, height, has_audio, vcodec, acodec, rotation_deg }`
- `SeqClip { src_path, in_ms, out_ms, start_ms, end_ms }`
- `EditPlan { id, main_track: Vec<SeqClip>, overlay_track: Vec<SeqClip> }`
- `ExportSettings { format, width, height, fps, bitrate }`
- `PreviewResult { url: String, ts: u64 }`
- `ExportResult { path: String, duration_ms: u64, size_bytes: u64 }`
- `ProgressEvent { phase: String, current: u32, total: u32, message: String }`

## Files to Add/Change

- `src-tauri/src/main.rs`: register commands, app setup (state, listeners), progress event wiring.
- `src-tauri/src/lib.rs`: shared modules.
- `src-tauri/src/ffmpeg.rs`: resolve bundled sidecar path; run `ffmpeg`/`ffprobe` safely.
- `src-tauri/src/metadata.rs`: parse `ffprobe` JSON -> `MediaMeta`.
- `src-tauri/src/edit_plan.rs`: parse project JSON (serde) -> `EditPlan` with validation.
- `src-tauri/src/cache.rs`: app data dirs; layout creation; helpers for `thumbs/`, `previews/`, `segments/`, `renders/`.
- `src-tauri/src/jobs.rs`: background queue (tokio), job types, progress events.
- Frontend helper: `src/lib/bindings.ts` with `invoke` typings and channels.
- Config: `src-tauri/tauri.conf.json` sidecars and ACL updates (allow reading sidecar, emitting events, file dialog).

## Cache Layout

- `<appData>/cache/{thumbs,proxies,previews,segments}`
- `<appData>/projects/<id>/{project.starproj,renders/}`

## FFmpeg Bundling (Sidecar)

- Place binaries:
  - `src-tauri/bin/ffmpeg/macos/ffmpeg`, `src-tauri/bin/ffmpeg/macos/ffprobe`
  - `src-tauri/bin/ffmpeg/windows/ffmpeg.exe`, `ffprobe.exe`
- `tauri.conf.json` sidecars:
  - macOS: `{ "id": "ffmpeg", "path": "bin/ffmpeg/macos/ffmpeg" }` and `ffprobe`
  - Windows: similar with `.exe`
- Resolve at runtime:
  - Use `AppHandle.path().resolve_resource("bin/ffmpeg/<os>/ffmpeg")` or `tauri::api::process::Command::new_sidecar("ffmpeg")`.

## Implementation Notes (Essential Snippets)

- Command registration in `main.rs`:
  ```
  tauri::Builder::default()
    .setup(|app| { jobs::init(app.handle().clone()); Ok(()) })
    .invoke_handler(tauri::generate_handler![
      get_media_metadata, apply_edits, generate_preview, export_project, subscribe_export_progress
    ])
    .run(tauri::generate_context!())?;
  ```

- FFprobe call (safe):
  ```
  let mut cmd = Command::new_sidecar("ffprobe")?;
  cmd.arg("-v").arg("error")
     .arg("-print_format").arg("json")
     .arg("-show_streams").arg(&input);
  let output = cmd.output()?; // parse JSON
  ```

- Preview frame:
  ```
  ffmpeg -ss {t} -i {clip} -frames:v 1 -q:v 5 <cache>/previews/{id}_{t}.jpg
  ```

- Export (concat with stream copy, fallback transcode):

1) Per-clip trim to segments (copy or transcode)

2) Build `concat.txt`

3) Final `ffmpeg -f concat -safe 0 -i concat.txt -c copy <renders>/<ts>.mp4`

## Events/Channels

- Prefer `Channel<ProgressEvent>` for live progress.
- Also emit `export_progress` events (`app.emit`), so UI can subscribe without channels.

## Security/ACL

- Update `capabilities/default.json` to permit: file read/write in app data dirs, sidecar execution, dialogs.
- Validate and sanitize input paths; never shell-interpolate strings.

## Logging

- Optional: On approval, write short logs to `docs/logs/backend-<date>.md` (ask first per user rule). Until then, console-only.

## Build Strategy

- Implement metadata first, then `EditPlan`, then preview, then export.
- Test on macOS with bundled sidecar; verify `tauri build` packaging includes binaries.
