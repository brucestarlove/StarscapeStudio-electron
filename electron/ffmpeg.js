const path = require('path');
const { app } = require('electron');
const ffmpeg = require('fluent-ffmpeg');

/**
 * Resolve FFmpeg binary path based on environment
 */
function resolveFfmpegPath() {
  if (app.isPackaged) {
    // Production: binaries are in resources
    return path.join(process.resourcesPath, 'bin', 'macos', 'ffmpeg');
  } else {
    // Development: binaries are in electron/bin/macos
    return path.join(__dirname, 'bin', 'macos', 'ffmpeg');
  }
}

/**
 * Resolve FFprobe binary path based on environment
 */
function resolveFfprobePath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin', 'macos', 'ffprobe');
  } else {
    return path.join(__dirname, 'bin', 'macos', 'ffprobe');
  }
}

/**
 * Configure fluent-ffmpeg to use bundled binaries
 */
function configureFfmpeg() {
  const ffmpegPath = resolveFfmpegPath();
  const ffprobePath = resolveFfprobePath();
  
  ffmpeg.setFfmpegPath(ffmpegPath);
  ffmpeg.setFfprobePath(ffprobePath);
  
  return { ffmpegPath, ffprobePath };
}

module.exports = {
  resolveFfmpegPath,
  resolveFfprobePath,
  configureFfmpeg,
};

