use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::{Command, Stdio, Child};
use std::sync::Mutex;
use tauri::{AppHandle, State};

use crate::cache::CacheDirs;
use crate::ffmpeg::resolve_ffmpeg_path;

#[derive(Default)]
pub struct RecorderState {
    pub processes: Mutex<HashMap<String, (Child, String)>>,
}

#[derive(Debug, Serialize)]
pub struct ListDevices {
    pub displays: Vec<String>,
    pub audio_inputs: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct RecordSettings {
    pub display_index: Option<u32>,
    pub audio_index: Option<u32>,
    pub fps: Option<u32>,
}

#[tauri::command]
pub async fn list_capture_devices(app: AppHandle) -> Result<ListDevices, String> {
    let ffmpeg = resolve_ffmpeg_path(&app)?;
    let out = Command::new(&ffmpeg)
        .arg("-f").arg("avfoundation")
        .arg("-list_devices").arg("true")
        .arg("-i").arg("")
        .output()
        .map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&out.stderr);
    let mut displays = Vec::new();
    let mut audio_inputs = Vec::new();
    for line in text.lines() {
        if line.contains("AVFoundation video devices:") { /* section marker */ }
        if let Some(idx) = line.find(']') {
            // Format: [0] FaceTime HD Camera ...
            let entry = line[idx+1..].trim();
            if line.contains("AVFoundation video devices:") || entry.is_empty() { continue; }
            if line.contains("AVFoundation audio devices:") { continue; }
        }
        if line.contains("AVFoundation video devices:") || line.contains("AVFoundation audio devices:") {
            // handled by simple parsing below
        }
        if let Some(num_start) = line.find('[') {
            if let Some(num_end) = line[num_start+1..].find(']') {
                let _num = &line[num_start+1..num_start+1+num_end];
                let _after = line[num_start+1+num_end+1..].trim();
                if text.contains("AVFoundation audio devices:") && line.contains("audio devices:") {
                    // skip header line
                }
                if line.contains("AVFoundation video devices:") {
                    // skip header
                }
            }
        }
        // naive: classify by keywords
        if line.contains("[AVFoundation input device @") { continue; }
        if line.contains("]") && line.contains("video devices:") == false && line.contains("audio devices:") == false {
            let after_bracket = line.split(']').nth(1).unwrap_or("").trim().to_string();
            if line.to_lowercase().contains("audio") {
                audio_inputs.push(after_bracket);
            } else {
                displays.push(after_bracket);
            }
        }
    }
    Ok(ListDevices { displays, audio_inputs })
}

#[tauri::command]
pub async fn start_screen_record(app: AppHandle, state: State<'_, RecorderState>, settings: RecordSettings) -> Result<(String, String), String> {
    let ffmpeg = resolve_ffmpeg_path(&app)?;
    let dirs = CacheDirs::new(&app).map_err(|e| e.to_string())?;
    let out_path = dirs.capture_output_path("mp4");
    let out_str = out_path.to_string_lossy().to_string();
    let display = settings.display_index.unwrap_or(1);
    let audio = settings.audio_index.unwrap_or(0);
    let fps = settings.fps.unwrap_or(30);

    let input_device = if audio > 0 {
        format!("{}:{}", display, audio)
    } else {
        format!("{}:none", display)
    };

    let child = Command::new(&ffmpeg)
        .arg("-f").arg("avfoundation")
        .arg("-framerate").arg(format!("{}", fps))
        .arg("-i").arg(input_device)
        .arg("-pix_fmt").arg("yuv420p")
        .arg("-preset").arg("veryfast")
        .arg("-crf").arg("23")
        .arg(&out_str)
        .stdin(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let id = format!("rec_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    state.processes.lock().unwrap().insert(id.clone(), (child, out_str.clone()));
    Ok((id, out_str))
}

#[tauri::command]
pub async fn stop_screen_record(_app: AppHandle, state: State<'_, RecorderState>, recording_id: String) -> Result<String, String> {
    if let Some((mut child, out_path)) = state.processes.lock().unwrap().remove(&recording_id) {
        if let Some(mut stdin) = child.stdin.take() {
            use std::io::Write;
            let _ = stdin.write_all(b"q\n");
        }
        let _ = child.wait();
        return Ok(out_path);
    }
    Err("recording id not found".to_string())
}

