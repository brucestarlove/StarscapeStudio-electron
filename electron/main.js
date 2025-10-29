const { app, BrowserWindow, ipcMain, desktopCapturer, screen, dialog, protocol, session } = require('electron');
const path = require('path');
const fs = require('fs');
const squirrelStartup = require('electron-squirrel-startup');
const { shell } = require('electron'); // Added for reveal-in-finder

const { configureFfmpeg } = require('./ffmpeg');
const { CacheDirs } = require('./cache');
const { probeMedia, extractPosterFrame } = require('./metadata');
const { buildPlan, findVisibleClip } = require('./editPlan');
const { executeExportJob } = require('./export');
const { ingestFiles } = require('./ingest');

// Handle Squirrel events on Windows
if (squirrelStartup) {
  app.quit();
}

let mainWindow = null;
let cacheDirs = null;
let isQuitting = false;
let isCleaningUp = false; // Prevent multiple cleanup calls
let activeProcesses = new Set(); // Track active FFmpeg processes
let activeRecordings = new Map(); // Track active screen recordings

/**
 * Create the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Starscape ClipForge',
    icon: path.join(__dirname, '../build-resources/icons/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Check if running in dev mode
  const isDev = process.argv.includes('--dev');

  if (isDev) {
    // Load from Vite dev server
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // Load from built files
    if (app.isPackaged) {
      // In packaged app, use the path relative to ASAR root
      mainWindow.loadFile('dist/index.html');
    } else {
      // In development, use relative path from main.js
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
  }

  // Handle window closed event
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      // On macOS, keep app running when window is closed
      if (process.platform === 'darwin') {
        return;
      }
    }
    
    // Only cleanup if not already quitting (to avoid double cleanup)
    if (!isQuitting) {
      cleanup();
      // Force quit after cleanup
      setTimeout(() => {
        app.quit();
      }, 1000);
    }
  });

  // Handle window closed (after close event)
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle window minimize to tray (optional)
  mainWindow.on('minimize', (event) => {
    if (process.platform === 'darwin') {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

/**
 * Cleanup function for graceful shutdown
 */
function cleanup() {
  if (isCleaningUp) {
    console.log('Cleanup already in progress, skipping...');
    return;
  }
  
  isCleaningUp = true;
  console.log('Cleaning up resources...');
  
  // Cancel any ongoing operations
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app-shutting-down');
  }
  
  // Stop all active screen recordings
  if (activeRecordings.size > 0) {
    console.log(`Stopping ${activeRecordings.size} active recordings...`);
    for (const [recordingId, recording] of activeRecordings) {
      try {
        console.log(`Stopping recording ${recordingId}`);
        // Note: In a real implementation, you'd stop the actual recording here
        // For now, we just clean up the tracking
      } catch (error) {
        console.error(`Error stopping recording ${recordingId}:`, error);
      }
    }
    activeRecordings.clear();
  }
  
  // Kill all active FFmpeg processes
  if (activeProcesses.size > 0) {
    console.log(`Terminating ${activeProcesses.size} active processes...`);
    const processes = Array.from(activeProcesses);
    activeProcesses.clear(); // Clear immediately to prevent re-tracking
    
    for (const process of processes) {
      try {
        if (process && !process.killed) {
          console.log(`Killing process ${process.pid}`);
          process.kill('SIGTERM');
        }
      } catch (error) {
        console.error('Error killing process:', error);
      }
    }
    
    // Force kill any remaining processes after 3 seconds
    setTimeout(() => {
      for (const process of processes) {
        try {
          if (process && !process.killed) {
            console.log(`Force killing process ${process.pid}`);
            process.kill('SIGKILL');
          }
        } catch (error) {
          console.error('Error force killing process:', error);
        }
      }
    }, 3000);
  }
  
  console.log('Cleanup completed');
}

/**
 * Initialize application
 */
async function initialize() {
  // Configure FFmpeg paths
  configureFfmpeg();

  // Initialize cache directories
  cacheDirs = new CacheDirs(app);
  await cacheDirs.ensureDirectories();

  // Set up permission request handlers for media access
  // This allows the app to request camera, microphone, and screen recording permissions
  const ses = session.defaultSession;
  
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    // Allow media permissions (camera, microphone) for webcam recording
    if (permission === 'media' || permission === 'camera' || permission === 'microphone') {
      callback(true);
      return;
    }
    
    // Allow screen recording permission (triggered by desktopCapturer.getSources)
    // Note: Screen recording permission is handled by macOS system dialog
    // when desktopCapturer.getSources() is called, not through this handler
    
    // Deny other permissions by default
    callback(false);
  });
  
  // Set up permission check handler (called before permission request)
  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    // For local files (file:// protocol) or localhost, allow media permissions
    if (requestingOrigin === 'file://' || requestingOrigin.startsWith('http://localhost') || requestingOrigin.startsWith('http://127.0.0.1')) {
      if (permission === 'media' || permission === 'camera' || permission === 'microphone') {
        return true;
      }
    }
    
    // Screen recording permission is always handled by macOS system dialog
    // This handler is mainly for web-based media access
    return false;
  });

  // Custom protocol registration removed - using file:// protocol directly
  // This simplifies the codebase and follows professional video editor patterns
  // where absolute file paths are stored and file:// is added only when loading media

  // Create window
  createWindow();
}

// Register protocol scheme as privileged BEFORE app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      bypassCSP: true,
      stream: true,
      supportFetchAPI: true,
      standard: true,
      secure: true
    }
  }
]);

// App lifecycle
app.whenReady().then(initialize);

// Handle window-all-closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cleanup();
    app.quit();
  }
});

// Handle activate (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow) {
    mainWindow.show();
  }
});

// Handle before-quit
app.on('before-quit', (event) => {
  if (!isQuitting) {
    isQuitting = true;
    event.preventDefault(); // Prevent immediate quit
    cleanup();
    
    // Force quit after cleanup completes
    setTimeout(() => {
      console.log('Force quitting after cleanup...');
      app.exit(0);
    }, 2000);
  }
});

// Handle will-quit (redundant with before-quit, but kept for safety)
app.on('will-quit', (event) => {
  if (!isCleaningUp) {
    cleanup();
  }
});

// Handle app termination
app.on('will-terminate', () => {
  cleanup();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  cleanup();
  
  // Don't exit immediately, let user save work
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app-error', {
      type: 'uncaughtException',
      message: error.message,
      stack: error.stack
    });
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  cleanup();
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app-error', {
      type: 'unhandledRejection',
      message: reason.toString(),
      promise: promise.toString()
    });
  }
});

// Handle SIGTERM (force quit)
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  cleanup();
  // Force quit after 5 seconds
  setTimeout(() => {
    console.log('Force quitting after timeout...');
    process.exit(0);
  }, 5000);
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  cleanup();
  // Force quit after 5 seconds
  setTimeout(() => {
    console.log('Force quitting after timeout...');
    process.exit(0);
  }, 5000);
});

// Handle SIGUSR1 (macOS)
process.on('SIGUSR1', () => {
  console.log('Received SIGUSR1, shutting down gracefully...');
  cleanup();
  app.quit();
});

// Handle SIGUSR2 (macOS)
process.on('SIGUSR2', () => {
  console.log('Received SIGUSR2, shutting down gracefully...');
  cleanup();
  app.quit();
});

/**
 * Track an active FFmpeg process for cleanup
 */
function trackProcess(process) {
  activeProcesses.add(process);
  
  // Remove from tracking when process ends
  process.on('exit', () => {
    activeProcesses.delete(process);
  });
  
  process.on('error', () => {
    activeProcesses.delete(process);
  });
}

/**
 * Stop tracking a process
 */
function untrackProcess(process) {
  activeProcesses.delete(process);
}

// ===== IPC Handlers =====

/**
 * List available capture devices (displays and audio inputs)
 */
ipcMain.handle('list-capture-devices', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 150, height: 150 }
    });
    
    const displays = sources.map((source, index) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      index: index
    }));
    
    // For now, we'll return empty audio inputs since we're not implementing audio recording yet
    const audioInputs = [];
    
    return {
      displays,
      audio_inputs: audioInputs
    };
  } catch (error) {
    throw new Error(`Failed to list capture devices: ${error.message}`);
  }
});

/**
 * Start screen recording
 */
ipcMain.handle('start-screen-record', async (event, settings) => {
  try {
    const { fps = 30, display_index = 0, audio_index = 0 } = settings;
    
    // Get available sources
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 150, height: 150 }
    });
    
    if (display_index >= sources.length) {
      throw new Error(`Display index ${display_index} out of range. Available displays: ${sources.length}`);
    }
    
    const source = sources[display_index];
    const recordingId = `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate output path
    const outputPath = path.join(
      cacheDirs ? cacheDirs.captures : app.getPath('temp'),
      `screen_recording_${recordingId}.webm`
    );
    
    // Store recording info
    activeRecordings.set(recordingId, {
      source,
      outputPath,
      startTime: Date.now(),
      settings: { fps, display_index, audio_index }
    });
    
    console.log(`Started screen recording ${recordingId} to ${outputPath}`);
    
    // Send the source info to the renderer process to start recording
    event.sender.send('start-recording', {
      recordingId,
      sourceId: source.id,
      outputPath,
      settings: { fps, display_index, audio_index }
    });
    
    return {
      recordingId,
      outPath: outputPath
    };
  } catch (error) {
    throw new Error(`Failed to start screen recording: ${error.message}`);
  }
});

/**
 * Stop screen recording
 */
ipcMain.handle('stop-screen-record', async (event, recordingId) => {
  try {
    const recording = activeRecordings.get(recordingId);
    if (!recording) {
      throw new Error(`Recording ${recordingId} not found`);
    }
    
    // Send stop signal to renderer process
    event.sender.send('stop-recording', { recordingId });
    
    // Remove from active recordings
    activeRecordings.delete(recordingId);
    
    console.log(`Stopped screen recording ${recordingId}`);
    
    return recording.outputPath;
  } catch (error) {
    throw new Error(`Failed to stop screen recording: ${error.message}`);
  }
});

/**
 * List available video and audio devices for webcam recording
 */
ipcMain.handle('list-webcam-devices', async () => {
  try {
    const { spawn } = require('child_process');
    const ffmpegPath = require('./ffmpeg').resolveFfmpegPath();
    
    return new Promise((resolve, reject) => {
      const devices = {
        video: [],
        audio: []
      };
      
      // Use FFmpeg to list avfoundation devices on macOS
      const ffmpegProcess = spawn(ffmpegPath, [
        '-f', 'avfoundation',
        '-list_devices', 'true',
        '-i', ''
      ]);
      
      let stderrOutput = '';
      
      ffmpegProcess.stderr.on('data', (data) => {
        stderrOutput += data.toString();
      });
      
      ffmpegProcess.on('close', (code) => {
        // Parse the output to extract device information
        const lines = stderrOutput.split('\n');
        let inVideoSection = false;
        let inAudioSection = false;
        
        for (const line of lines) {
          if (line.includes('AVFoundation video devices:')) {
            inVideoSection = true;
            inAudioSection = false;
            continue;
          }
          if (line.includes('AVFoundation audio devices:')) {
            inVideoSection = false;
            inAudioSection = true;
            continue;
          }
          
          // Match device lines like "[0] FaceTime HD Camera"
          const match = line.match(/\[(\d+)\]\s+(.+)/);
          if (match) {
            const index = parseInt(match[1]);
            const name = match[2].trim();
            
            if (inVideoSection) {
              devices.video.push({ index, name });
            } else if (inAudioSection) {
              devices.audio.push({ index, name });
            }
          }
        }
        
        resolve(devices);
      });
      
      ffmpegProcess.on('error', (error) => {
        reject(new Error(`Failed to list devices: ${error.message}`));
      });
    });
  } catch (error) {
    throw new Error(`Failed to list webcam devices: ${error.message}`);
  }
});

/**
 * Start webcam recording using FFmpeg
 */
ipcMain.handle('start-webcam-record', async (event, settings) => {
  try {
    const { fps = 30, includeAudio = true, videoDeviceIndex = 0, audioDeviceIndex = 0 } = settings;
    const ffmpeg = require('fluent-ffmpeg');
    const { resolveFfmpegPath } = require('./ffmpeg');
    
    const recordingId = `webcam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate output path - use MP4 for better compatibility
    const outputPath = path.join(
      cacheDirs ? cacheDirs.captures : app.getPath('temp'),
      `webcam_recording_${recordingId}.mp4`
    );
    
    // Build FFmpeg command for avfoundation input on macOS
    // Format: "video_index:audio_index" where -1 means no audio
    const inputIndex = includeAudio ? `${videoDeviceIndex}:${audioDeviceIndex}` : `${videoDeviceIndex}:-1`;
    
    // Set FFmpeg path first (before creating command)
    const ffmpegPath = resolveFfmpegPath();
    ffmpeg.setFfmpegPath(ffmpegPath);
    
    // Use fluent-ffmpeg with explicit format specification
    // For avfoundation, we need to use inputFormat() method
    const command = ffmpeg()
      .input(inputIndex)
      .inputFormat('avfoundation')
      .inputOptions([
        '-framerate', String(fps),
        '-video_size', '1280x720'
      ])
      .output(outputPath)
      .videoCodec('libx264')
      .videoBitrate('2500k')
      .outputOptions([
        '-preset', 'fast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart'
      ]);
    
    if (includeAudio) {
      command.audioCodec('aac')
        .audioBitrate('128k')
        .audioChannels(2)
        .audioFrequency(44100);
    }
    
    // Start the recording process
    const ffmpegProcess = command.on('start', (commandLine) => {
      console.log(`FFmpeg command: ${commandLine}`);
    })
    .on('error', (err) => {
      console.error(`Webcam recording error: ${err.message}`);
      // Don't delete immediately - wait a bit in case it's a recoverable error
      setTimeout(() => {
        activeRecordings.delete(recordingId);
      }, 1000);
    })
    .on('end', () => {
      console.log(`Webcam recording completed: ${outputPath}`);
      activeRecordings.delete(recordingId);
    })
    .run();
    
    // Track the process for cleanup
    trackProcess(ffmpegProcess);
    
    // Store recording info
    activeRecordings.set(recordingId, {
      type: 'webcam',
      outputPath,
      startTime: Date.now(),
      settings: { fps, includeAudio, videoDeviceIndex, audioDeviceIndex },
      process: ffmpegProcess
    });
    
    console.log(`Started webcam recording ${recordingId} to ${outputPath}`);
    
    return {
      recordingId,
      outPath: outputPath
    };
  } catch (error) {
    throw new Error(`Failed to start webcam recording: ${error.message}`);
  }
});

/**
 * Stop webcam recording
 */
ipcMain.handle('stop-webcam-record', async (event, recordingId) => {
  try {
    const recording = activeRecordings.get(recordingId);
    if (!recording) {
      throw new Error(`Recording ${recordingId} not found`);
    }
    
    // Stop the FFmpeg process
    if (recording.process && !recording.process.killed) {
      // Send SIGTERM to gracefully stop FFmpeg
      recording.process.kill('SIGTERM');
      
      // Wait a bit for graceful shutdown, then force kill if needed
      setTimeout(() => {
        if (!recording.process.killed) {
          recording.process.kill('SIGKILL');
        }
      }, 2000);
    }
    
    // Remove from active recordings after a delay to ensure file is written
    setTimeout(() => {
      activeRecordings.delete(recordingId);
    }, 1000);
    
    console.log(`Stopped webcam recording ${recordingId}`);
    
    return recording.outputPath;
  } catch (error) {
    throw new Error(`Failed to stop webcam recording: ${error.message}`);
  }
});

/**
 * Get media metadata
 */
ipcMain.handle('get-media-metadata', async (event, filePath) => {
  try {
    const metadata = await probeMedia(filePath);
    return metadata;
  } catch (error) {
    throw new Error(`Failed to get metadata: ${error}`);
  }
});

/**
 * Generate preview frame
 */
ipcMain.handle('generate-preview', async (event, projectJson, atMs) => {
  try {
    const plan = buildPlan(projectJson);
    const visibleClip = findVisibleClip(plan, atMs);
    
    if (!visibleClip) {
      throw new Error('No clip visible at this time');
    }

    // Calculate timestamp relative to clip source
    const relativeMs = atMs - visibleClip.startMs + visibleClip.inMs;
    const outputPath = cacheDirs.previewFile(plan.id, atMs);
    
    const url = await extractPosterFrame(visibleClip.srcPath, relativeMs, outputPath);
    
    return {
      url,
      ts: atMs,
    };
  } catch (error) {
    throw new Error(`Failed to generate preview: ${error}`);
  }
});

/**
 * Export project
 */
ipcMain.handle('export-project', async (event, projectJson, settings) => {
  try {
    const plan = buildPlan(projectJson);
    const result = await executeExportJob(plan, settings, cacheDirs, mainWindow, trackProcess);
    return result;
  } catch (error) {
    throw new Error(`Failed to export project: ${error}`);
  }
});

/**
 * Convert WebM to MP4 using ffmpeg
 */
function convertWebmToMp4(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = require('fluent-ffmpeg');
    
    console.log(`Converting WebM to MP4: ${inputPath} -> ${outputPath}`);
    
    const command = ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-preset fast',
        '-crf 23',
        '-movflags +faststart'
      ])
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`Conversion progress: ${Math.round(progress.percent)}%`);
        }
      })
      .on('end', () => {
        console.log('WebM to MP4 conversion completed');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Conversion error:', err);
        reject(new Error(`FFmpeg conversion failed: ${err.message}`));
      });
    
    // Track the process
    const process = command.run();
    trackProcess(process);
  });
}

/**
 * Save blob data to file (converts WebM to MP4 for screen recordings)
 */
ipcMain.handle('save-blob-to-file', async (event, blobData, filePath) => {
  try {
    const fs = require('fs');
    const buffer = Buffer.from(blobData);
    
    // Validate buffer has content
    if (buffer.length === 0) {
      throw new Error('Cannot save empty blob. Recording may have failed or been too short.');
    }
    
    // Save the blob to the original file path (WebM)
    await fs.promises.writeFile(filePath, buffer);
    console.log(`Saved WebM recording to: ${filePath} (${buffer.length} bytes)`);
    
    // Validate file was written correctly
    const stats = await fs.promises.stat(filePath);
    if (stats.size === 0) {
      throw new Error('Saved file is empty. Disk may be full or permissions issue.');
    }
    
    // Convert WebM to MP4 for better compatibility
    const mp4Path = filePath.replace('.webm', '.mp4');
    
    try {
      await convertWebmToMp4(filePath, mp4Path);
      // Delete the original WebM file
      await fs.promises.unlink(filePath);
      console.log(`Deleted temporary WebM file: ${filePath}`);
      return { success: true, path: mp4Path };
    } catch (conversionError) {
      // If conversion fails, keep the WebM file and return it
      console.error(`WebM to MP4 conversion failed: ${conversionError.message}`);
      console.log(`Keeping WebM file: ${filePath}`);
      return { success: true, path: filePath, conversionFailed: true };
    }
  } catch (error) {
    throw new Error(`Failed to save blob to file: ${error.message}`);
  }
});

/**
 * Ingest files
 */
ipcMain.handle('ingest-files', async (event, request) => {
  try {
    const { file_paths } = request;
    const results = await ingestFiles(file_paths, cacheDirs);
    return results;
  } catch (error) {
    throw new Error(`Failed to ingest files: ${error}`);
  }
});

/**
 * Apply edits to project (placeholder implementation)
 */
ipcMain.handle('apply-edits', async (event, projectJson) => {
  try {
    // For now, this is a placeholder - in a real implementation,
    // this would process the project JSON and apply any pending edits
    console.log('Apply edits called with project:', JSON.parse(projectJson));
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to apply edits: ${error.message}`);
  }
});

/**
 * Open file dialog to select media files
 */
ipcMain.handle('open-file-dialog', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Media Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'aac', 'flac', 'ogg', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
        { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] },
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'flac', 'ogg'] },
        { name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return { filePaths: result.filePaths };
    }
    
    return { filePaths: [] };
  } catch (error) {
    console.error('Error opening file dialog:', error);
    throw new Error(`Failed to open file dialog: ${error.message}`);
  }
});

/**
 * Open/reveal file in Finder (macOS), Explorer (Windows), or Files (Linux)
 */
ipcMain.handle('reveal-in-finder', async (event, filePath) => {
  try {
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    console.error('Error revealing file in finder:', error);
    throw new Error(`Failed to reveal file: ${error.message}`);
  }
});

