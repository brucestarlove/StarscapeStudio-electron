use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use tokio::fs;

use crate::cache::CacheDirs;
use crate::metadata::probe_media;
use crate::ffmpeg::resolve_ffprobe_path;

#[derive(Debug, Serialize, Deserialize)]
pub struct IngestResult {
    pub asset_id: String,
    pub file_path: String,
    pub metadata: crate::MediaMeta,
}

#[derive(Debug, Deserialize)]
pub struct IngestRequest {
    pub file_paths: Vec<String>,
}

/// Ingest files from external paths into the app's cache directory
/// This handles copying files and extracting metadata
#[tauri::command]
pub async fn ingest_files(
    app: AppHandle,
    request: IngestRequest,
) -> Result<Vec<IngestResult>, String> {
    let cache_dirs = CacheDirs::new(&app).map_err(|e| e.to_string())?;
    let ffprobe = resolve_ffprobe_path(&app)?;
    
    // Ensure the media directory exists
    fs::create_dir_all(&cache_dirs.media_dir)
        .await
        .map_err(|e| format!("Failed to create media directory: {}", e))?;
    
    let mut results = Vec::new();
    
    for file_path in request.file_paths {
        let source_path = Path::new(&file_path);
        
        // Validate that the file exists and is readable
        if !source_path.exists() {
            return Err(format!("File does not exist: {}", file_path));
        }
        
        if !source_path.is_file() {
            return Err(format!("Path is not a file: {}", file_path));
        }
        
        // Generate a unique filename to avoid conflicts
        let file_name = source_path
            .file_name()
            .ok_or_else(|| format!("Invalid file name: {}", file_path))?
            .to_string_lossy();
        
        let asset_id = generate_asset_id();
        let extension = source_path
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("");
        
        let cached_filename = format!("{}.{}", asset_id, extension);
        let cached_path = cache_dirs.media_dir.join(&cached_filename);
        
        // Copy the file to the cache directory
        fs::copy(source_path, &cached_path)
            .await
            .map_err(|e| format!("Failed to copy file {}: {}", file_path, e))?;
        
        // Extract metadata using ffprobe
        let metadata = probe_media(&ffprobe, cached_path.to_string_lossy().as_ref())
            .await
            .map_err(|e| format!("Failed to extract metadata for {}: {}", file_path, e))?;
        
        results.push(IngestResult {
            asset_id,
            file_path: cached_path.to_string_lossy().to_string(),
            metadata,
        });
    }
    
    Ok(results)
}

/// Generate a unique asset ID
fn generate_asset_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    format!("asset_{}", timestamp)
}

/// Get file type from extension
pub fn get_file_type_from_path(path: &Path) -> Result<String, String> {
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    match extension.as_str() {
        // Video formats
        "mp4" | "mov" | "avi" | "mkv" | "webm" | "m4v" => Ok("video".to_string()),
        // Audio formats
        "mp3" | "wav" | "aac" | "flac" | "ogg" | "m4a" => Ok("audio".to_string()),
        // Image formats
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" => Ok("image".to_string()),
        _ => Err(format!("Unsupported file type: {}", extension)),
    }
}
