use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SeqClip {
    pub src_path: PathBuf,
    pub in_ms: u64,
    pub out_ms: u64,
    pub start_ms: u64,
    pub end_ms: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EditPlan {
    pub id: String,
    pub main_track: Vec<SeqClip>,
    pub overlay_track: Vec<SeqClip>,
}

impl EditPlan {
    pub fn top_visible_clip(&self, t_ms: u64) -> Option<&SeqClip> {
        self.main_track.iter().find(|c| c.start_ms <= t_ms && t_ms < c.end_ms)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectJson {
    pub id: String,
    pub assets: std::collections::HashMap<String, ProjectAsset>,
    pub clips: std::collections::HashMap<String, ProjectClip>,
    pub tracks: std::collections::HashMap<String, ProjectTrack>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectAsset {
    pub id: String,
    pub kind: String,
    pub name: String,
    pub src: String,
    pub duration_ms: Option<f64>, // durationMs in input
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectTrack {
    pub id: String,
    pub role: String, // "main" | "overlay"
    pub clip_order: Vec<String>, // clipOrder in input
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectClip {
    pub id: String,
    pub asset_id: String,
    pub track_id: String,
    pub start_ms: u64,
    pub end_ms: u64,
    pub in_ms: u64,
    pub out_ms: u64,
}

pub fn build_plan(project_json: &str) -> Result<EditPlan, String> {
    let parsed: ProjectJson = serde_json::from_str(project_json)
        .map_err(|e| format!("invalid project json: {}", e))?;

    let mut main: Vec<SeqClip> = Vec::new();
    let mut overlay: Vec<SeqClip> = Vec::new();

    // Process clips by track role
    for (track_id, track) in &parsed.tracks {
        for clip_id in &track.clip_order {
            if let Some(clip) = parsed.clips.get(clip_id) {
                if let Some(asset) = parsed.assets.get(&clip.asset_id) {
                    // Convert file:// URLs to local paths
                    let src_path = if asset.src.starts_with("file://") {
                        asset.src.strip_prefix("file://").unwrap().to_string()
                    } else {
                        asset.src.clone()
                    };

                    if clip.out_ms <= clip.in_ms {
                        return Err(format!("clip {} out <= in", clip_id));
                    }

                    let seq = SeqClip {
                        src_path: PathBuf::from(src_path),
                        in_ms: clip.in_ms,
                        out_ms: clip.out_ms,
                        start_ms: clip.start_ms,
                        end_ms: clip.end_ms,
                    };

                    if track.role == "main" {
                        main.push(seq);
                    } else {
                        overlay.push(seq);
                    }
                }
            }
        }
    }

    // Basic validation: no overlaps on main track
    main.sort_by_key(|c| c.start_ms);
    for i in 1..main.len() {
        if main[i - 1].end_ms > main[i].start_ms {
            return Err("overlapping clips on main track (MVP disallows)".to_string());
        }
    }

    Ok(EditPlan {
        id: parsed.id,
        main_track: main,
        overlay_track: overlay,
    })
}

