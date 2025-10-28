const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');
const squirrelStartup = require('electron-squirrel-startup');

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
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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

  // Create window
  createWindow();
}

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
 * Save blob data to file
 */
ipcMain.handle('save-blob-to-file', async (event, blobData, filePath) => {
  try {
    const fs = require('fs');
    const buffer = Buffer.from(blobData);
    await fs.promises.writeFile(filePath, buffer);
    return { success: true, path: filePath };
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

