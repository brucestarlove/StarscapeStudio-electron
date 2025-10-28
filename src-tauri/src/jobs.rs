use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use std::process::Command;

use crate::{ExportSettings, ProgressEvent};
use crate::edit_plan::EditPlan;
use crate::cache::CacheDirs;

pub fn init(_app: AppHandle) {
    // Placeholder: background workers could be set up here.
}

pub async fn spawn_export_job(
    app: AppHandle,
    ffmpeg_path: String,
    plan: EditPlan,
    settings: ExportSettings,
    cache: CacheDirs,
) -> Result<(String, u64, u64), String> {
    let total = plan.main_track.len() as u32 + 2; // segments + concat + finalize
    let mut current = 0u32;

    let mut segment_paths: Vec<PathBuf> = Vec::new();
    for (idx, clip) in plan.main_track.iter().enumerate() {
        app.emit("export_progress", ProgressEvent { phase: "segment".to_string(), current, total, message: format!("Trimming clip {}", idx) }).ok();
        let seg_path = cache.segment_path(idx);
        let start = format!("{}.{:03}", clip.in_ms / 1000, clip.in_ms % 1000);
        let duration_ms = clip.out_ms - clip.in_ms;
        let dur = format!("{}.{:03}", duration_ms / 1000, duration_ms % 1000);
        let start_copy = start.clone();
        let dur_copy = dur.clone();
        let output = Command::new(&ffmpeg_path)
            .arg("-ss").arg(start)
            .arg("-i").arg(clip.src_path.to_string_lossy().to_string())
            .arg("-t").arg(dur)
            .arg("-c").arg("copy")
            .arg(seg_path.to_string_lossy().to_string())
            .output()
            .map_err(|e| format!("ffmpeg trim failed: {}", e))?;
        if !output.status.success() {
            // Fallback: transcode to H.264/AAC
            let output = Command::new(&ffmpeg_path)
                .arg("-ss").arg(start_copy)
                .arg("-i").arg(clip.src_path.to_string_lossy().to_string())
                .arg("-t").arg(dur_copy)
                .arg("-c:v").arg("libx264")
                .arg("-preset").arg("veryfast")
                .arg("-crf").arg("23")
                .arg("-c:a").arg("aac")
                .arg("-b:a").arg("192k")
                .arg(seg_path.to_string_lossy().to_string())
                .output()
                .map_err(|e| format!("ffmpeg transcode failed: {}", e))?;
            if !output.status.success() {
                return Err(format!("ffmpeg error: {}", String::from_utf8_lossy(&output.stderr)));
            }
        }
        segment_paths.push(seg_path);
        current += 1;
    }

    app.emit("export_progress", ProgressEvent { phase: "concat".to_string(), current, total, message: "Concatenating".to_string() }).ok();
    let concat_path = cache.concat_list_path(&plan);
    let mut file = fs::File::create(&concat_path).map_err(|e| e.to_string())?;
    for seg in &segment_paths {
        writeln!(file, "file '{}'", seg.to_string_lossy()).map_err(|e| e.to_string())?;
    }
    current += 1;

    let ext = if settings.format == "mov" { "mov" } else { "mp4" };
    let out_path = cache.render_output_path(&plan, ext);

    app.emit("export_progress", ProgressEvent { phase: "finalize".to_string(), current, total, message: "Writing output".to_string() }).ok();
    let mut final_cmd = Command::new(&ffmpeg_path);
    final_cmd
        .arg("-f").arg("concat")
        .arg("-safe").arg("0")
        .arg("-i").arg(concat_path.to_string_lossy().to_string())
        .arg("-c").arg("copy")
        .arg(out_path.to_string_lossy().to_string());

    let output = final_cmd.output().map_err(|e| format!("ffmpeg concat failed: {}", e))?;
    if !output.status.success() {
        // Fallback to re-encode with common settings
        let mut reencode = Command::new(&ffmpeg_path);
        reencode
            .arg("-f").arg("concat")
            .arg("-safe").arg("0")
            .arg("-i").arg(concat_path.to_string_lossy().to_string())
            .arg("-c:v").arg("libx264")
            .arg("-preset").arg("veryfast")
            .arg("-crf").arg("23")
            .arg("-c:a").arg("aac")
            .arg("-b:a").arg("192k")
            .arg(out_path.to_string_lossy().to_string());
        let output = reencode.output().map_err(|e| format!("ffmpeg encode failed: {}", e))?;
        if !output.status.success() {
            return Err(format!("ffmpeg error: {}", String::from_utf8_lossy(&output.stderr)));
        }
    }
    current += 1;

    let rendered = out_path.to_string_lossy().to_string();
    let size_bytes = fs::metadata(&out_path).map(|m| m.len()).unwrap_or(0);
    // Duration best-effort: sum of main track durations
    let duration_ms: u64 = plan.main_track.iter().map(|c| c.out_ms - c.in_ms).sum();

    Ok((format!("file://{}", rendered), duration_ms, size_bytes as u64))
}

