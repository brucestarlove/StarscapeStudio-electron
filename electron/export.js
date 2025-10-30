const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');

/**
 * Check if file is an image based on extension
 */
function isImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  return imageExts.includes(ext);
}

/**
 * Execute export job with progress tracking
 */
async function executeExportJob(plan, settings, cache, mainWindow, trackProcessFn) {
  // Calculate total steps: clips + gaps + concat + finalize
  const gapCount = plan.mainTrack.length > 0 ? plan.mainTrack.length - 1 : 0;
  const total = plan.mainTrack.length + gapCount + 2;
  let current = 0;

  const segmentPaths = [];
  let segmentIndex = 0;

  // Extract resolution settings (width: -1, height: -1 means use source resolution)
  const targetWidth = settings.width;
  const targetHeight = settings.height;
  const useSourceResolution = targetWidth === -1 || targetHeight === -1;

  // Step 1: Process each clip and gaps between them
  for (let idx = 0; idx < plan.mainTrack.length; idx++) {
    const clip = plan.mainTrack[idx];
    
    // Add gap before this clip (if not the first clip)
    if (idx > 0) {
      const prevClip = plan.mainTrack[idx - 1];
      const gapDurationMs = clip.startMs - prevClip.endMs;
      
      if (gapDurationMs > 0) {
        // Try to create black segment for gap
        try {
          // Send progress event for gap
          if (mainWindow) {
            mainWindow.webContents.send('export-progress', {
              phase: 'segment',
              current,
              total,
              message: `Creating gap ${idx}/${gapCount}`,
            });
          }

          const gapPath = cache.segmentPath(segmentIndex++);
          await createBlackSegment(gapPath, gapDurationMs / 1000, targetWidth, targetHeight, trackProcessFn);
          segmentPaths.push(gapPath);
          current++;
        } catch (err) {
          console.warn(`Failed to create gap segment: ${err.message}`);
          console.warn(`Skipping ${gapDurationMs}ms gap - clips will be concatenated directly`);
          // Continue without the gap - clips will just play back-to-back
        }
      }
    }
    
    // Send progress event for clip
    if (mainWindow) {
      mainWindow.webContents.send('export-progress', {
        phase: 'segment',
        current,
        total,
        message: `Processing clip ${idx + 1}/${plan.mainTrack.length}`,
      });
    }

    const segPath = cache.segmentPath(segmentIndex++);
    const startSec = clip.inMs / 1000;
    const durationSec = (clip.outMs - clip.inMs) / 1000;

    // Check if this is an image file
    const isImage = isImageFile(clip.srcPath);

    if (isImage) {
      // Convert image to video segment
      // Images always need transcoding, no codec copy option
      await convertImageToVideoSegment(
        clip.srcPath, 
        segPath, 
        durationSec, 
        useSourceResolution ? null : targetWidth,
        useSourceResolution ? null : targetHeight,
        clip.assetWidth,  // Pass asset dimensions for aspect ratio preservation
        clip.assetHeight,
        settings.bitrate, 
        trackProcessFn
      );
      segmentPaths.push(segPath);
    } else {
      // Handle video clips
      // If we need to scale, we must transcode (can't use codec copy)
      const needsScaling = !useSourceResolution;
      
      if (needsScaling) {
        // Must transcode to apply scaling
        await trimSegment(clip.srcPath, segPath, startSec, durationSec, false, targetWidth, targetHeight, settings.bitrate, trackProcessFn);
        segmentPaths.push(segPath);
      } else {
        // Try codec copy first for source resolution
        try {
          await trimSegment(clip.srcPath, segPath, startSec, durationSec, true, null, null, settings.bitrate, trackProcessFn);
          segmentPaths.push(segPath);
        } catch (err) {
          // Fallback to transcode
          console.log(`Codec copy failed for segment ${idx}, transcoding...`);
          await trimSegment(clip.srcPath, segPath, startSec, durationSec, false, null, null, settings.bitrate, trackProcessFn);
          segmentPaths.push(segPath);
        }
      }
    }

    current++;
  }

  // Step 2: Create concat list file
  if (mainWindow) {
    mainWindow.webContents.send('export-progress', {
      phase: 'concat',
      current,
      total,
      message: 'Preparing concatenation',
    });
  }

  const concatPath = cache.concatListPath(plan.id);
  const concatContent = segmentPaths
    .map((segPath) => `file '${segPath}'`)
    .join('\n');
  await fs.writeFile(concatPath, concatContent, 'utf8');
  current++;

  // Step 3: Concatenate segments
  if (mainWindow) {
    mainWindow.webContents.send('export-progress', {
      phase: 'finalize',
      current,
      total,
      message: 'Writing final output',
    });
  }

  const ext = settings.format === 'mov' ? 'mov' : 'mp4';
  const outPath = settings.filename ? cache.renderOutputPathWithFilename(settings.filename, ext) : cache.renderOutputPath(plan.id, ext);

  // If we're scaling, we already transcoded all segments to the target resolution
  // so we can use codec copy for concat. If using source resolution, try codec copy first.
  try {
    await concatenateSegments(concatPath, outPath, true, null, null, settings.bitrate, trackProcessFn);
  } catch (err) {
    // Fallback to re-encode
    console.log('Concat with copy failed, re-encoding...');
    await concatenateSegments(concatPath, outPath, false, targetWidth, targetHeight, settings.bitrate, trackProcessFn);
  }

  current++;

  // Get output file stats
  const stats = await fs.stat(outPath);
  
  // Calculate total duration: from first clip start to last clip end
  const firstClipStart = plan.mainTrack.length > 0 ? plan.mainTrack[0].startMs : 0;
  const lastClipEnd = plan.mainTrack.length > 0 ? plan.mainTrack[plan.mainTrack.length - 1].endMs : 0;
  const durationMs = lastClipEnd - firstClipStart;

  return {
    path: `file://${outPath}`,
    duration_ms: durationMs,
    size_bytes: stats.size,
  };
}

/**
 * Create a black video segment (for gaps)
 * If lavfi is not available, this will fail and we'll skip gaps
 */
async function createBlackSegment(outputPath, durationSec, width, height, trackProcessFn) {
  const path = require('path');
  const os = require('os');
  
  // Use provided resolution, or default to 1920x1080
  const resolutionStr = `${width}x${height}`;
  
  // Try multiple approaches in order of compatibility
  const approaches = [
    // Approach 1: Simple color source (most compatible)
    () => {
      return new Promise((resolve, reject) => {
        const command = ffmpeg();
        
        // Build raw ffmpeg command for maximum compatibility
        command
          .input(`color=black:s=${resolutionStr}:r=30`)
          .inputFormat('lavfi')
          .input('anullsrc=r=48000:cl=stereo')
          .inputFormat('lavfi')
          .duration(durationSec)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions([
            '-preset', 'ultrafast',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
          ]);

        const ffmpegProcess = command
          .output(outputPath)
          .on('end', () => {
            if (trackProcessFn) trackProcessFn(ffmpegProcess);
            resolve();
          })
          .on('error', (err) => {
            if (trackProcessFn) trackProcessFn(ffmpegProcess);
            reject(err);
          })
          .run();
          
        if (trackProcessFn) trackProcessFn(ffmpegProcess);
      });
    },
  ];

  // Try each approach
  for (const approach of approaches) {
    try {
      await approach();
      return; // Success!
    } catch (err) {
      console.log('Black segment approach failed, will try next...');
      // Continue to next approach
    }
  }
  
  // All approaches failed
  throw new Error('Failed to create black segment - lavfi not available in FFmpeg build');
}

/**
 * Convert static image to video segment with aspect ratio preservation
 * @param {string} inputPath - Input image file path
 * @param {string} outputPath - Output video file path
 * @param {number} durationSec - Duration in seconds
 * @param {number|null} targetWidth - Target width (null for source resolution)
 * @param {number|null} targetHeight - Target height (null for source resolution)
 * @param {number|null} assetWidth - Original asset width (for aspect ratio calculation)
 * @param {number|null} assetHeight - Original asset height (for aspect ratio calculation)
 * @param {number} bitrate - Video bitrate in kbps
 * @param {Function} trackProcessFn - Function to track ffmpeg process
 */
function convertImageToVideoSegment(inputPath, outputPath, durationSec, targetWidth, targetHeight, assetWidth, assetHeight, bitrate, trackProcessFn) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .inputOptions([
        '-loop 1',           // Loop the single image
        '-framerate 30'      // Output framerate
      ])
      .duration(durationSec);

    // Apply scaling with aspect ratio preservation if target resolution is specified
    if (targetWidth && targetHeight) {
      // If we have asset dimensions, preserve aspect ratio with letterboxing/pillarboxing
      if (assetWidth && assetHeight && assetWidth > 0 && assetHeight > 0) {
        const assetAspect = assetWidth / assetHeight;
        const targetAspect = targetWidth / targetHeight;
        
        // Calculate scale to fit within target dimensions while preserving aspect ratio
        let scaleWidth, scaleHeight;
        if (assetAspect > targetAspect) {
          // Image is wider - fit to width
          scaleWidth = targetWidth;
          scaleHeight = Math.round(targetWidth / assetAspect);
        } else {
          // Image is taller - fit to height
          scaleHeight = targetHeight;
          scaleWidth = Math.round(targetHeight * assetAspect);
        }
        
        // Use scale filter with padding to center the image
        // Format: scale=W:H:force_original_aspect_ratio=decrease,pad=W:H:x:y:color
        const padX = Math.round((targetWidth - scaleWidth) / 2);
        const padY = Math.round((targetHeight - scaleHeight) / 2);
        
        command
          .videoFilters([
            `scale=${scaleWidth}:${scaleHeight}:force_original_aspect_ratio=decrease`,
            `pad=${targetWidth}:${targetHeight}:${padX}:${padY}:black`
          ]);
      } else {
        // No asset dimensions available - use simple size (may distort)
        command.size(`${targetWidth}x${targetHeight}`);
      }
    }
    
    command
      .videoCodec('libx264')
      .outputOptions([
        '-preset veryfast',
        '-crf 23',
        `-b:v ${bitrate}k`,
        '-pix_fmt yuv420p',   // Ensure compatibility
      ]);

    const ffmpegProcess = command
      .output(outputPath)
      .on('end', () => {
        if (trackProcessFn) trackProcessFn(ffmpegProcess);
        resolve();
      })
      .on('error', (err) => {
        if (trackProcessFn) trackProcessFn(ffmpegProcess);
        reject(err);
      })
      .run();
      
    // Track the process for cleanup
    if (trackProcessFn) trackProcessFn(ffmpegProcess);
  });
}

/**
 * Trim a single segment
 * @param {string} inputPath - Input video file path
 * @param {string} outputPath - Output video file path
 * @param {number} startSec - Start time in seconds
 * @param {number} durationSec - Duration in seconds
 * @param {boolean} copyCodec - Whether to use codec copy (no re-encoding)
 * @param {number|null} targetWidth - Target width (null for source resolution)
 * @param {number|null} targetHeight - Target height (null for source resolution)
 * @param {number} bitrate - Video bitrate in kbps
 * @param {Function} trackProcessFn - Function to track ffmpeg process
 */
function trimSegment(inputPath, outputPath, startSec, durationSec, copyCodec, targetWidth, targetHeight, bitrate, trackProcessFn) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath).seekInput(startSec).duration(durationSec);

    if (copyCodec) {
      command.outputOptions(['-c copy']);
    } else {
      // Apply scaling if target resolution is specified
      if (targetWidth && targetHeight) {
        command.size(`${targetWidth}x${targetHeight}`);
      }
      
      command
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset veryfast',
          '-crf 23',
          `-b:v ${bitrate}k`,
          '-b:a 192k',
        ]);
    }

    const ffmpegProcess = command
      .output(outputPath)
      .on('end', () => {
        if (trackProcessFn) trackProcessFn(ffmpegProcess);
        resolve();
      })
      .on('error', (err) => {
        if (trackProcessFn) trackProcessFn(ffmpegProcess);
        reject(err);
      })
      .run();
      
    // Track the process for cleanup
    if (trackProcessFn) trackProcessFn(ffmpegProcess);
  });
}

/**
 * Concatenate segments
 * @param {string} concatListPath - Path to concat list file
 * @param {string} outputPath - Output video file path
 * @param {boolean} copyCodec - Whether to use codec copy (no re-encoding)
 * @param {number|null} targetWidth - Target width (null for source resolution)
 * @param {number|null} targetHeight - Target height (null for source resolution)
 * @param {number} bitrate - Video bitrate in kbps
 * @param {Function} trackProcessFn - Function to track ffmpeg process
 */
function concatenateSegments(concatListPath, outputPath, copyCodec, targetWidth, targetHeight, bitrate, trackProcessFn) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg()
      .input(concatListPath)
      .inputOptions(['-f concat', '-safe 0']);

    if (copyCodec) {
      command.outputOptions(['-c copy']);
    } else {
      // Apply scaling if target resolution is specified
      if (targetWidth && targetHeight) {
        command.size(`${targetWidth}x${targetHeight}`);
      }
      
      command
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset veryfast',
          '-crf 23',
          `-b:v ${bitrate}k`,
          '-b:a 192k',
        ]);
    }

    const ffmpegProcess = command
      .output(outputPath)
      .on('end', () => {
        if (trackProcessFn) trackProcessFn(ffmpegProcess);
        resolve();
      })
      .on('error', (err) => {
        if (trackProcessFn) trackProcessFn(ffmpegProcess);
        reject(err);
      })
      .run();
      
    // Track the process for cleanup
    if (trackProcessFn) trackProcessFn(ffmpegProcess);
  });
}

module.exports = {
  executeExportJob,
};

