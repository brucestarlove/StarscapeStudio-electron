const fs = require('fs-extra');
const path = require('path');
const { probeMedia } = require('./metadata');

/**
 * Generate unique asset ID
 */
function generateAssetId() {
  const timestamp = Date.now();
  return `asset_${timestamp}`;
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

      // Generate unique asset ID
      const assetId = generateAssetId();
      const ext = path.extname(filePath).substring(1); // Remove leading dot
      const cachedFilename = `${assetId}.${ext}`;
      const cachedPath = path.join(cache.mediaDir, cachedFilename);

      console.log(`Ingesting file: ${filePath}`);
      console.log(`Target cache path: ${cachedPath}`);

      // Ensure cache directory exists
      await fs.ensureDir(cache.mediaDir);

      // Copy file to cache directory
      await fs.copy(filePath, cachedPath);
      console.log(`File copied successfully to: ${cachedPath}`);

      // Verify the copied file exists
      const copiedExists = await fs.pathExists(cachedPath);
      if (!copiedExists) {
        throw new Error(`Failed to copy file to cache: ${cachedPath}`);
      }

      // Extract metadata
      const metadata = await probeMedia(cachedPath);

      results.push({
        asset_id: assetId,
        file_path: cachedPath,
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

