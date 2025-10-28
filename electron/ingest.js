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

    // Copy file to cache directory
    await fs.copy(filePath, cachedPath);

    // Extract metadata
    const metadata = await probeMedia(cachedPath);

    results.push({
      asset_id: assetId,
      file_path: cachedPath,
      metadata,
    });
  }

  return results;
}

module.exports = {
  ingestFiles,
};

