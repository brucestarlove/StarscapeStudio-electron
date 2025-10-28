// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

mod ffmpeg;
mod metadata;
mod edit_plan;
mod cache;
mod jobs;
mod record;
mod ingest;
use record::{list_capture_devices, start_screen_record, stop_screen_record, RecorderState};
use ingest::ingest_files;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MediaMeta {
    pub duration_ms: u64,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub has_audio: Option<bool>,
    pub codec_video: Option<String>,
    pub codec_audio: Option<String>,
    pub rotation_deg: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PreviewResult {
    pub url: String,
    pub ts: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportSettings {
    pub format: String, // "mp4" | "mov"
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fps: Option<u32>,
    pub bitrate: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportResult {
    pub path: String,
    pub duration_ms: u64,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgressEvent {
    pub phase: String,
    pub current: u32,
    pub total: u32,
    pub message: String,
}

#[tauri::command]
async fn get_media_metadata(app: AppHandle, path: String) -> Result<MediaMeta, String> {
    let ffprobe = ffmpeg::resolve_ffprobe_path(&app)?;
    metadata::probe_media(&ffprobe, &path).await
}

#[tauri::command]
async fn apply_edits(app: AppHandle, project_json: String) -> Result<String, String> {
    let plan = edit_plan::build_plan(&project_json)?;
    cache::persist_plan(&app, &plan).map_err(|e| e.to_string())?;
    Ok("ok".to_string())
}

#[tauri::command]
async fn generate_preview(app: AppHandle, project_json: String, at_ms: u64) -> Result<PreviewResult, String> {
    let plan = edit_plan::build_plan(&project_json)?;
    let cache_dirs = cache::CacheDirs::new(&app).map_err(|e| e.to_string())?;
    let ffmpeg_bin = ffmpeg::resolve_ffmpeg_path(&app)?;
    let url = metadata::extract_poster_frame(&ffmpeg_bin, &plan, at_ms, &cache_dirs)
        .await?;
    Ok(PreviewResult { url, ts: at_ms })
}

#[tauri::command]
async fn export_project(app: AppHandle, project_json: String, settings: ExportSettings) -> Result<ExportResult, String> {
    let plan = edit_plan::build_plan(&project_json)?;
    let ffmpeg_bin = ffmpeg::resolve_ffmpeg_path(&app)?;
    let dirs = cache::CacheDirs::new(&app).map_err(|e| e.to_string())?;

    let (output_path, duration_ms, size_bytes) = jobs::spawn_export_job(
        app.clone(),
        ffmpeg_bin,
        plan,
        settings,
        dirs,
    )
    .await?;

    Ok(ExportResult {
        path: output_path,
        duration_ms,
        size_bytes,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            jobs::init(app.handle().clone());
            Ok(())
        })
        .manage(RecorderState::default())
        .invoke_handler(tauri::generate_handler![
            get_media_metadata,
            apply_edits,
            generate_preview,
            export_project,
            list_capture_devices,
            start_screen_record,
            stop_screen_record,
            ingest_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
