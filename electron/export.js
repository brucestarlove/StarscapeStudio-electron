const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');

/**
 * Execute export job with progress tracking
 */
async function executeExportJob(plan, settings, cache, mainWindow, trackProcessFn) {
  const total = plan.mainTrack.length + 2; // segments + concat + finalize
  let current = 0;

  const segmentPaths = [];

  // Step 1: Trim each clip to segment files
  for (let idx = 0; idx < plan.mainTrack.length; idx++) {
    const clip = plan.mainTrack[idx];
    
    // Send progress event
    if (mainWindow) {
      mainWindow.webContents.send('export-progress', {
        phase: 'segment',
        current,
        total,
        message: `Trimming clip ${idx + 1}/${plan.mainTrack.length}`,
      });
    }

    const segPath = cache.segmentPath(idx);
    const startSec = clip.inMs / 1000;
    const durationSec = (clip.outMs - clip.inMs) / 1000;

    // Try codec copy first
    try {
      await trimSegment(clip.srcPath, segPath, startSec, durationSec, true, trackProcessFn);
      segmentPaths.push(segPath);
    } catch (err) {
      // Fallback to transcode
      console.log(`Codec copy failed for segment ${idx}, transcoding...`);
      await trimSegment(clip.srcPath, segPath, startSec, durationSec, false, trackProcessFn);
      segmentPaths.push(segPath);
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
  const outPath = cache.renderOutputPath(plan.id, ext);

  // Try concat with codec copy
  try {
    await concatenateSegments(concatPath, outPath, true, trackProcessFn);
  } catch (err) {
    // Fallback to re-encode
    console.log('Concat with copy failed, re-encoding...');
    await concatenateSegments(concatPath, outPath, false, trackProcessFn);
  }

  current++;

  // Get output file stats
  const stats = await fs.stat(outPath);
  const durationMs = plan.mainTrack.reduce(
    (sum, clip) => sum + (clip.outMs - clip.inMs),
    0
  );

  return {
    path: `file://${outPath}`,
    duration_ms: durationMs,
    size_bytes: stats.size,
  };
}

/**
 * Trim a single segment
 */
function trimSegment(inputPath, outputPath, startSec, durationSec, copyCodec, trackProcessFn) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath).seekInput(startSec).duration(durationSec);

    if (copyCodec) {
      command.outputOptions(['-c copy']);
    } else {
      command
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset veryfast',
          '-crf 23',
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
 */
function concatenateSegments(concatListPath, outputPath, copyCodec, trackProcessFn) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg()
      .input(concatListPath)
      .inputOptions(['-f concat', '-safe 0']);

    if (copyCodec) {
      command.outputOptions(['-c copy']);
    } else {
      command
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset veryfast',
          '-crf 23',
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

