use tauri::AppHandle;

pub fn resolve_ffmpeg_path(_app: &AppHandle) -> Result<String, String> {
    Ok("/opt/homebrew/bin/ffmpeg".to_string())
}

pub fn resolve_ffprobe_path(_app: &AppHandle) -> Result<String, String> {
    Ok("/opt/homebrew/bin/ffprobe".to_string())
}

