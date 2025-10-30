const { app, BrowserWindow, ipcMain, desktopCapturer, screen, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const squirrelStartup = require('electron-squirrel-startup');
const { shell } = require('electron'); // Added for reveal-in-finder

// Load environment variables from .env file
// Load from project root (one level up from electron directory)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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
    title: 'Starscape Studio',
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

  // Register custom protocol for serving local media files
  protocol.registerFileProtocol('media', (request, callback) => {
    try {
      // Extract file path from media:// URL
      let url = request.url.substring('media://'.length);
      
      // Add leading slash if missing (protocol strips it)
      if (!url.startsWith('/')) {
        url = '/' + url;
      }
      
      // Decode URI component to handle spaces and special characters
      const filePath = decodeURIComponent(url);
      
      console.log(`[media://] Request for: ${request.url}`);
      console.log(`[media://] Decoded path: ${filePath}`);
      
      // Security check: ensure the file exists and is readable
      if (!fs.existsSync(filePath)) {
        console.error(`[media://] File not found: ${filePath}`);
        callback({ error: -6 }); // NET::ERR_FILE_NOT_FOUND
        return;
      }
      
      console.log(`[media://] File exists, serving: ${filePath}`);
      callback({ path: filePath });
    } catch (error) {
      console.error('[media://] Error serving media file:', error);
      callback({ error: -2 }); // NET::ERR_FAILED
    }
  });

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
 * Convert WebM audio to MP3 using ffmpeg
 */
function convertWebmToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = require('fluent-ffmpeg');
    
    console.log(`Converting WebM audio to MP3: ${inputPath} -> ${outputPath}`);
    
    const command = ffmpeg(inputPath)
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .audioChannels(2)
      .audioFrequency(44100)
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
        console.log('WebM to MP3 conversion completed');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Conversion error:', err);
        reject(new Error(`FFmpeg audio conversion failed: ${err.message}`));
      });
    
    // Track the process
    const process = command.run();
    trackProcess(process);
  });
}

/**
 * Save blob data to file (converts WebM to MP4 for video, MP3 for audio)
 */
ipcMain.handle('save-blob-to-file', async (event, blobData, filename) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const buffer = Buffer.from(blobData);
    
    // Construct full path in cache/media directory
    const webmPath = path.join(cacheDirs.mediaDir, filename);
    
    // Save the blob to the webm file
    await fs.promises.writeFile(webmPath, buffer);
    console.log(`Saved WebM recording to: ${webmPath}`);
    
    // Check if it's a microphone recording (audio-only) by filename
    if (filename.startsWith('microphone_recording_')) {
      // For audio recordings, convert to MP3
      const mp3Filename = filename.replace('.webm', '.mp3');
      const mp3Path = path.join(cacheDirs.mediaDir, mp3Filename);
      
      await convertWebmToMp3(webmPath, mp3Path);
      
      // Delete the original WebM file
      await fs.promises.unlink(webmPath);
      console.log(`Deleted temporary WebM file: ${webmPath}`);
      
      return { success: true, path: mp3Path };
    } else {
      // For video recordings (webcam/screen), convert to MP4
      const mp4Filename = filename.replace('.webm', '.mp4');
      const mp4Path = path.join(cacheDirs.mediaDir, mp4Filename);
      
      await convertWebmToMp4(webmPath, mp4Path);
      
      // Delete the original WebM file
      await fs.promises.unlink(webmPath);
      console.log(`Deleted temporary WebM file: ${webmPath}`);
      
      return { success: true, path: mp4Path };
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

/**
 * Delete a file
 */
ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    const fs = require('fs');
    await fs.promises.unlink(filePath);
    console.log(`Deleted file: ${filePath}`);
    return { success: true };
  } catch (error) {
    // If file doesn't exist, consider it a success
    if (error.code === 'ENOENT') {
      console.log(`File already deleted: ${filePath}`);
      return { success: true };
    }
    console.error('Error deleting file:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
});

/**
 * Download image from URL and save to file
 */
async function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(outputPath);
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {}); // Delete the file on error
      reject(err);
    });
  });
}

/**
 * Generate cosmic image using OpenAI DALL-E API
 */
ipcMain.handle('generate-image', async (event, userPrompt) => {
  try {
    const apiKey = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please set VITE_OPENAI_API_KEY or OPENAI_API_KEY environment variable.');
    }

    // Combine user prompt with cosmic system prompt
    const fullPrompt = `Create a cosmic/celestial themed image featuring ${userPrompt}. The image should have a space, nebula, starfield, or celestial aesthetic. The style should be artistic and visually striking.`;

    // Call OpenAI DALL-E API
    const requestData = JSON.stringify({
      model: 'dall-e-3',
      prompt: fullPrompt,
      size: '1024x1024',
      quality: 'standard',
      n: 1
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/images/generations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(requestData)
      }
    };

    // Make API request
    const apiResponse = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`OpenAI API error: ${res.statusCode} - ${data}`));
            return;
          }
          
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (error) {
            reject(new Error(`Failed to parse API response: ${error.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`API request failed: ${error.message}`));
      });
      
      req.write(requestData);
      req.end();
    });

    // Extract image URL from response
    if (!apiResponse.data || !apiResponse.data[0] || !apiResponse.data[0].url) {
      throw new Error('Invalid API response: missing image URL');
    }

    const imageUrl = apiResponse.data[0].url;
    
    // Generate filename for saved image
    const timestamp = Date.now();
    const filename = `cosmic_${timestamp}.png`;
    const outputPath = path.join(cacheDirs.mediaDir, filename);
    
    // Ensure media directory exists
    await fs.promises.mkdir(cacheDirs.mediaDir, { recursive: true });
    
    // Download and save image
    await downloadImage(imageUrl, outputPath);
    
    console.log(`Generated cosmic image saved to: ${outputPath}`);
    
    return { success: true, path: outputPath };
  } catch (error) {
    console.error('Error generating image:', error);
    throw new Error(`Failed to generate image: ${error.message}`);
  }
});

