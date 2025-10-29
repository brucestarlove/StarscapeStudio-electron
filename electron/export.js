const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');

/**
 * Execute export job with progress tracking
 * Supports PiP overlays from track 2+
 */
async function executeExportJob(plan, settings, cache, mainWindow, trackProcessFn) {
  // Check if we have overlays to composite
  const hasOverlays = plan.overlayTrack && plan.overlayTrack.length > 0;
  
  if (hasOverlays) {
    // Use complex export with overlay compositing
    return executeExportJobWithOverlays(plan, settings, cache, mainWindow, trackProcessFn);
  }
  
  // No overlays - use original simple export
  // Calculate total steps: clips + gaps + concat + finalize
  const gapCount = plan.mainTrack.length > 0 ? plan.mainTrack.length - 1 : 0;
  const total = plan.mainTrack.length + gapCount + 2;
  let current = 0;

  const segmentPaths = [];
  let segmentIndex = 0;

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
          await createBlackSegment(gapPath, gapDurationMs / 1000, trackProcessFn);
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
  const outPath = settings.filename ? cache.renderOutputPathWithFilename(settings.filename, ext) : cache.renderOutputPath(plan.id, ext);

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
async function createBlackSegment(outputPath, durationSec, trackProcessFn) {
  const path = require('path');
  const os = require('os');
  
  // Try multiple approaches in order of compatibility
  const approaches = [
    // Approach 1: Simple color source (most compatible)
    () => {
      return new Promise((resolve, reject) => {
        const command = ffmpeg();
        
        // Build raw ffmpeg command for maximum compatibility
        command
          .input('color=black:s=1920x1080:r=30')
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

/**
 * Execute export with PiP overlay compositing
 */
async function executeExportJobWithOverlays(plan, settings, cache, mainWindow, trackProcessFn) {
  console.log('Exporting with PiP overlays:', plan.overlayTrack.length, 'overlay clips');
  
  // For now, we'll use a simpler approach:
  // 1. Render main track segments
  // 2. Find time ranges where overlays are active
  // 3. For each segment, apply overlays if they exist at that time
  
  const total = plan.mainTrack.length + 2; // Main clips + composite + finalize
  let current = 0;
  
  const segmentPaths = [];
  let segmentIndex = 0;
  
  // Step 1: Process main track clips
  for (let idx = 0; idx < plan.mainTrack.length; idx++) {
    const mainClip = plan.mainTrack[idx];
    
    // Send progress
    if (mainWindow) {
      mainWindow.webContents.send('export-progress', {
        phase: 'segment',
        current,
        total,
        message: `Processing clip ${idx + 1}/${plan.mainTrack.length}`,
      });
    }
    
    // Find overlays that are active during this main clip's timeline
    const activeOverlays = plan.overlayTrack.filter(overlay => {
      // Check if overlay intersects with main clip timeline
      return overlay.startMs < mainClip.endMs && overlay.endMs > mainClip.startMs;
    });
    
    const segPath = cache.segmentPath(segmentIndex++);
    
    if (activeOverlays.length === 0) {
      // No overlays - simple trim
      const startSec = mainClip.inMs / 1000;
      const durationSec = (mainClip.outMs - mainClip.inMs) / 1000;
      
      try {
        await trimSegment(mainClip.srcPath, segPath, startSec, durationSec, true, trackProcessFn);
        segmentPaths.push(segPath);
      } catch (err) {
        console.log('Codec copy failed, transcoding...');
        await trimSegment(mainClip.srcPath, segPath, startSec, durationSec, false, trackProcessFn);
        segmentPaths.push(segPath);
      }
    } else {
      // Has overlays - need to composite
      await compositeSegmentWithOverlays(
        mainClip,
        activeOverlays,
        segPath,
        trackProcessFn
      );
      segmentPaths.push(segPath);
    }
    
    current++;
  }
  
  // Step 2: Concatenate
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
  
  // Step 3: Final output
  if (mainWindow) {
    mainWindow.webContents.send('export-progress', {
      phase: 'finalize',
      current,
      total,
      message: 'Writing final output',
    });
  }
  
  const ext = settings.format === 'mov' ? 'mov' : 'mp4';
  const outPath = settings.filename ? 
    cache.renderOutputPathWithFilename(settings.filename, ext) : 
    cache.renderOutputPath(plan.id, ext);
  
  try {
    await concatenateSegments(concatPath, outPath, true, trackProcessFn);
  } catch (err) {
    console.log('Concat with copy failed, re-encoding...');
    await concatenateSegments(concatPath, outPath, false, trackProcessFn);
  }
  
  current++;
  
  // Get output stats
  const stats = await fs.stat(outPath);
  const firstClipStart = plan.mainTrack.length > 0 ? plan.mainTrack[0].startMs : 0;
  const lastClipEnd = plan.mainTrack.length > 0 ? 
    plan.mainTrack[plan.mainTrack.length - 1].endMs : 0;
  const durationMs = lastClipEnd - firstClipStart;
  
  return {
    path: `file://${outPath}`,
    duration_ms: durationMs,
    size_bytes: stats.size,
  };
}

/**
 * Composite a main clip segment with overlays using FFmpeg complex filters
 */
async function compositeSegmentWithOverlays(mainClip, overlays, outputPath, trackProcessFn) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg();
    
    // Add main video input
    const mainStartSec = mainClip.inMs / 1000;
    const mainDurationSec = (mainClip.outMs - mainClip.inMs) / 1000;
    
    command
      .input(mainClip.srcPath)
      .seekInput(mainStartSec)
      .duration(mainDurationSec);
    
    // Add overlay inputs
    const filterComplex = [];
    let lastOutput = '[0:v]';
    
    overlays.forEach((overlay, idx) => {
      // Calculate overlay timing relative to main clip
      const overlayStartInMain = Math.max(0, overlay.startMs - mainClip.startMs) / 1000;
      const overlayEndInMain = Math.min(
        mainClip.endMs - mainClip.startMs,
        overlay.endMs - mainClip.startMs
      ) / 1000;
      const overlayDuration = overlayEndInMain - overlayStartInMain;
      
      if (overlayDuration <= 0) return;
      
      // Calculate source timing in overlay file
      const sourceStart = (overlay.inMs + (Math.max(0, mainClip.startMs - overlay.startMs))) / 1000;
      
      command
        .input(overlay.srcPath)
        .seekInput(sourceStart)
        .duration(overlayDuration);
      
      const inputIndex = idx + 1;
      const transform = overlay.transform || { x: 0, y: 0, width: 480, height: 270 };
      
      // Scale overlay to desired size
      filterComplex.push(
        `[${inputIndex}:v]scale=${transform.width}:${transform.height}[scaled${idx}]`
      );
      
      // Overlay on previous output
      const outputLabel = idx === overlays.length - 1 ? '[out]' : `[tmp${idx}]`;
      filterComplex.push(
        `${lastOutput}[scaled${idx}]overlay=${transform.x}:${transform.y}:enable='between(t,${overlayStartInMain},${overlayEndInMain})'${outputLabel}`
      );
      
      lastOutput = outputLabel;
    });
    
    // Apply complex filter
    command.complexFilter(filterComplex, lastOutput.replace(/[\[\]]/g, ''));
    
    // Output settings
    command
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-preset', 'veryfast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
      ])
      .output(outputPath);
    
    const ffmpegProcess = command
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
}

module.exports = {
  executeExportJob,
};

