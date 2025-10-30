const path = require('path');
const fs = require('fs-extra');

/**
 * Cache directory management - matches Rust CacheDirs structure
 */
class CacheDirs {
  constructor(app) {
    const appDataPath = app.getPath('appData');
    const appName = 'com.starscape.studio';
    
    this.base = path.join(appDataPath, appName, 'cache');
    this.mediaDir = path.join(this.base, 'media');
    this.thumbDir = path.join(this.base, 'thumbnails');
    this.previews = path.join(this.base, 'previews');
    this.segments = path.join(this.base, 'segments');
    this.renders = path.join(appDataPath, appName, 'projects');
    this.captures = path.join(this.base, 'captures');
  }

  /**
   * Ensure all cache directories exist
   */
  async ensureDirectories() {
    await fs.ensureDir(this.mediaDir);
    await fs.ensureDir(this.thumbDir);
    await fs.ensureDir(this.previews);
    await fs.ensureDir(this.segments);
    await fs.ensureDir(this.renders);
    await fs.ensureDir(this.captures);
  }

  /**
   * Get preview file path for a specific plan and timestamp
   */
  previewFile(planId, atMs) {
    const filename = `${planId}_${atMs}.jpg`;
    return path.join(this.previews, filename);
  }

  /**
   * Get concat list path for export
   */
  concatListPath(planId) {
    return path.join(this.segments, `${planId}_concat.txt`);
  }

  /**
   * Get segment path for export
   */
  segmentPath(index) {
    return path.join(this.segments, `segment_${String(index).padStart(4, '0')}.mp4`);
  }

  /**
   * Get render output path
   */
  renderOutputPath(planId, ext) {
    const timestamp = Math.floor(Date.now() / 1000);
    return path.join(this.renders, `${planId}_${timestamp}.${ext}`);
  }

  /**
   * Get render output path with custom filename
   */
  renderOutputPathWithFilename(filename, ext) {
    // Sanitize filename to remove path separators and invalid characters
    const sanitizedFilename = filename.replace(/[\/\\:*?"<>|]/g, '_');
    return path.join(this.renders, `${sanitizedFilename}.${ext}`);
  }

  /**
   * Get capture output path
   */
  captureOutputPath(ext) {
    const timestamp = Math.floor(Date.now() / 1000);
    return path.join(this.captures, `capture_${timestamp}.${ext}`);
  }
}

module.exports = { CacheDirs };

