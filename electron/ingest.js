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
 * Determine asset type from file extension
 */
function getAssetType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
  const audioExts = ['.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a'];
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  if (imageExts.includes(ext)) return 'image';
  return 'unknown';
}

/**
 * Ingest files - reference them directly without copying
 * This allows the renderer to access files in their original location
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

      console.log(`Ingesting file: ${filePath}`);
      console.log(`Original name: ${originalFileName}`);

      // Ensure cache directory exists (for thumbnails)
      await fs.ensureDir(cache.thumbDir);

      // Get file size from original location
      const fileSize = stats.size;

      // Extract metadata from original file
      const metadata = await probeMedia(filePath);

      // Generate thumbnail (stored in cache, but media stays in original location)
      let thumbnailPath = null;
      const assetType = getAssetType(filePath);
      
      try {
        if (assetType === 'video') {
          const thumbnailFilename = `${assetId}.jpg`;
          thumbnailPath = path.join(cache.thumbDir, thumbnailFilename);
          await generateVideoThumbnail(filePath, thumbnailPath);
          console.log(`Thumbnail generated: ${thumbnailPath}`);
        } else if (assetType === 'image') {
          const thumbnailFilename = `${assetId}.jpg`;
          thumbnailPath = path.join(cache.thumbDir, thumbnailFilename);
          await generateImageThumbnail(filePath, thumbnailPath);
          console.log(`Thumbnail generated: ${thumbnailPath}`);
        }
      } catch (thumbError) {
        console.warn(`Failed to generate thumbnail for ${originalFileName}:`, thumbError);
        // Continue without thumbnail
      }

      results.push({
        asset_id: assetId,
        file_path: filePath, // Use original file path directly
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

