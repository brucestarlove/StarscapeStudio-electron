use std::fs;
use std::path::{PathBuf};
use tauri::{AppHandle, Manager};

use crate::edit_plan::EditPlan;

pub struct CacheDirs {
    base: PathBuf,
    previews: PathBuf,
    segments: PathBuf,
    renders: PathBuf,
    captures: PathBuf,
}

impl CacheDirs {
    pub fn new(app: &AppHandle) -> Result<Self, std::io::Error> {
        let base = app
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| app.path().app_log_dir().expect("app_log_dir").to_path_buf());
        let cache_base = base.join("cache");
        let previews = cache_base.join("previews");
        let segments = cache_base.join("segments");
        let renders = base.join("projects");
        let captures = cache_base.join("captures");
        fs::create_dir_all(&previews)?;
        fs::create_dir_all(&segments)?;
        fs::create_dir_all(&renders)?;
        fs::create_dir_all(&captures)?;
        Ok(Self { base: cache_base, previews, segments, renders, captures })
    }

    pub fn preview_file(&self, plan: &EditPlan, at_ms: u64) -> String {
        let fname = format!("{}_{}.jpg", plan.id, at_ms);
        self.previews.join(fname).to_string_lossy().to_string()
    }

    pub fn concat_list_path(&self, plan: &EditPlan) -> PathBuf {
        self.segments.join(format!("{}_concat.txt", plan.id))
    }

    pub fn segment_path(&self, index: usize) -> PathBuf {
        self.segments.join(format!("segment_{:04}.mp4", index))
    }

    pub fn render_output_path(&self, plan: &EditPlan, ext: &str) -> PathBuf {
        // Timestamp without chrono dep (seconds since epoch)
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_else(|_| std::time::Duration::from_secs(0))
            .as_secs();
        self.renders.join(format!("{}_{}.{}", plan.id, ts, ext))
    }

    pub fn capture_output_path(&self, ext: &str) -> PathBuf {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_else(|_| std::time::Duration::from_secs(0))
            .as_secs();
        self.captures.join(format!("capture_{}.{}", ts, ext))
    }
}

pub fn persist_plan(_app: &AppHandle, _plan: &EditPlan) -> Result<(), std::io::Error> {
    // MVP: no-op (future: write to <appData>/projects/<id>/project.starproj)
    Ok(())
}

