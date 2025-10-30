const fs = require('fs-extra');
const path = require('path');
const { probeMedia } = require('./metadata');
const ffmpeg = require('fluent-ffmpeg');
const { configureFfmpeg } = require('./ffmpeg');

// Configure FFmpeg paths
configureFfmpeg();

/**
 * Generate unique asset ID
 */
function generateAssetId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `asset_${timestamp}_${random}`;
}

/**
 * Generate thumbnail for video file
 */
async function generateVideoThumbnail(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['00:00:01'],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '320x180'
      })
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err));
  });
}

/**
 * Generate thumbnail for image file (resize)
 */
async function generateImageThumbnail(imagePath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(imagePath)
      .outputOptions([
        '-vf', 'scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2'
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Determine asset type from file extension and metadata
 */
function getAssetType(filePath, metadata = null) {
  const ext = path.extname(filePath).toLowerCase();
  const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.m4v'];
  const audioExts = ['.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a'];
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  
  // WebM can be either video or audio - check metadata if available
  if (ext === '.webm' && metadata) {
    // If there's no video codec or no width/height, it's audio-only
    if (!metadata.codec_video || !metadata.width || !metadata.height) {
      return 'audio';
    }
    return 'video';
  }
  
  if (videoExts.includes(ext)) return 'video';
  if (ext === '.webm') return 'video'; // Default to video if no metadata
  if (audioExts.includes(ext)) return 'audio';
  if (imageExts.includes(ext)) return 'image';
  return 'unknown';
}

/**
 * Ingest files from external paths into cache directory
 */
async function ingestFiles(filePaths, cache) {
  const results = [];

  for (const filePath of filePaths) {
    try {
      // Validate file exists
      const exists = await fs.pathExists(filePath);
      if (!exists) {
        throw new Error(`File does not exist: ${filePath}`);
      }

      // Check if it's a file
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
      }

      // Extract original file name
      const originalFileName = path.basename(filePath);

      // Generate unique asset ID
      const assetId = generateAssetId();
      const ext = path.extname(filePath).substring(1); // Remove leading dot
      const cachedFilename = `${assetId}.${ext}`;
      const cachedPath = path.join(cache.mediaDir, cachedFilename);

      console.log(`Ingesting file: ${filePath}`);
      console.log(`Original name: ${originalFileName}`);
      console.log(`Target cache path: ${cachedPath}`);

      // Ensure cache directory exists
      await fs.ensureDir(cache.mediaDir);
      await fs.ensureDir(cache.thumbDir);

      // Copy file to cache directory
      await fs.copy(filePath, cachedPath);
      console.log(`File copied successfully to: ${cachedPath}`);

      // Verify the copied file exists
      const copiedExists = await fs.pathExists(cachedPath);
      if (!copiedExists) {
        throw new Error(`Failed to copy file to cache: ${cachedPath}`);
      }

      // Get file size
      const fileStats = await fs.stat(cachedPath);
      const fileSize = fileStats.size;

      // Extract metadata
      const metadata = await probeMedia(cachedPath);

      // For images, set default duration to 5 seconds (5000ms)
      // This can be adjusted in the UI from 250ms to 60 seconds
      const assetType = getAssetType(filePath, metadata);
      if (assetType === 'image' && metadata.duration_ms === 0) {
        metadata.duration_ms = 5000; // Default 5 seconds for images
      }

      // Generate thumbnail
      let thumbnailPath = null;
      
      try {
        if (assetType === 'video') {
          const thumbnailFilename = `${assetId}.jpg`;
          thumbnailPath = path.join(cache.thumbDir, thumbnailFilename);
          await generateVideoThumbnail(cachedPath, thumbnailPath);
          console.log(`Thumbnail generated: ${thumbnailPath}`);
        } else if (assetType === 'image') {
          const thumbnailFilename = `${assetId}.jpg`;
          thumbnailPath = path.join(cache.thumbDir, thumbnailFilename);
          await generateImageThumbnail(cachedPath, thumbnailPath);
          console.log(`Thumbnail generated: ${thumbnailPath}`);
        }
      } catch (thumbError) {
        console.warn(`Failed to generate thumbnail for ${originalFileName}:`, thumbError);
        // Continue without thumbnail
      }

      results.push({
        asset_id: assetId,
        file_path: cachedPath,
        original_file_name: originalFileName,
        thumbnail_path: thumbnailPath,
        file_size: fileSize,
        metadata,
      });
    } catch (error) {
      console.error(`Error ingesting file ${filePath}:`, error);
      throw error;
    }
  }

  return results;
}

module.exports = {
  ingestFiles,
};

