use serde::Deserialize;
use std::process::Command;

use crate::MediaMeta;
use crate::edit_plan::EditPlan;
use crate::cache::CacheDirs;

#[derive(Debug, Deserialize)]
struct FFProbeStream {
    codec_type: Option<String>,
    codec_name: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    duration: Option<String>,
    r_frame_rate: Option<String>,
    sample_rate: Option<String>,
    tags: Option<serde_json::Value>,
    rotation: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct FFProbeResult {
    streams: Vec<FFProbeStream>,
    format: Option<serde_json::Value>,
}

pub async fn probe_media(ffprobe_path: &str, input: &str) -> Result<MediaMeta, String> {
    let output = Command::new(ffprobe_path)
        .arg("-v").arg("error")
        .arg("-print_format").arg("json")
        .arg("-show_streams")
        .arg(input)
        .output()
        .map_err(|e| format!("ffprobe failed to start: {}", e))?;

    if !output.status.success() {
        return Err(format!("ffprobe error: {}", String::from_utf8_lossy(&output.stderr)));
    }
    let parsed: FFProbeResult = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("ffprobe json parse error: {}", e))?;

    let mut meta = MediaMeta {
        duration_ms: 0,
        width: None,
        height: None,
        has_audio: None,
        codec_video: None,
        codec_audio: None,
        rotation_deg: None,
    };

    for s in parsed.streams.iter() {
        if let Some(t) = &s.codec_type {
            if t == "video" {
                meta.width = s.width;
                meta.height = s.height;
                meta.codec_video = s.codec_name.clone();
                meta.rotation_deg = s.rotation;
                if let Some(d) = &s.duration {
                    if let Ok(sec) = d.parse::<f64>() {
                        meta.duration_ms = (sec * 1000.0) as u64;
                    }
                }
            } else if t == "audio" {
                meta.has_audio = Some(true);
                meta.codec_audio = s.codec_name.clone();
            }
        }
    }
    Ok(meta)
}

pub async fn extract_poster_frame(
    ffmpeg_path: &str,
    plan: &EditPlan,
    at_ms: u64,
    cache: &CacheDirs,
) -> Result<String, String> {
    let visible = plan.top_visible_clip(at_ms).ok_or_else(|| "no clip visible at this time".to_string())?;
    let out_path = cache.preview_file(plan, at_ms);

    let timestamp = format!("{}.{:03}", at_ms / 1000, at_ms % 1000);
    let output = Command::new(ffmpeg_path)
        .arg("-ss").arg(timestamp)
        .arg("-i").arg(visible.src_path.to_string_lossy().to_string())
        .arg("-frames:v").arg("1")
        .arg("-q:v").arg("5")
        .arg(out_path.clone())
        .output()
        .map_err(|e| format!("ffmpeg failed to start: {}", e))?;

    if !output.status.success() {
        return Err(format!("ffmpeg error: {}", String::from_utf8_lossy(&output.stderr)));
    }
    Ok(format!("file://{}", out_path))
}

