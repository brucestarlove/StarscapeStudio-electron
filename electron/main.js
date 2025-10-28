const { app, BrowserWindow, ipcMain } = require('electron');
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
    mainWindow.loadURL('http://localhost:1420');
    mainWindow.webContents.openDevTools();
  } else {
    // Load from built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ===== IPC Handlers =====

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
    const result = await executeExportJob(plan, settings, cacheDirs, mainWindow);
    return result;
  } catch (error) {
    throw new Error(`Failed to export project: ${error}`);
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

