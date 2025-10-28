# Tauri to Electron Migration Plan

## Overview

This document outlines the complete process for migrating the ClipForge frontend from Tauri to Electron, including separating the frontend into its own repository and implementing equivalent backend functionality using Node.js and Electron APIs.

## Current Architecture Analysis

### Frontend Structure
- **Framework**: React 19.1.0 with TypeScript
- **Build Tool**: Vite 7.0.4
- **Styling**: Tailwind CSS 4.1.16
- **State Management**: Zustand 5.0.8
- **UI Components**: Radix UI primitives with custom shadcn/ui components
- **Drag & Drop**: @dnd-kit libraries
- **Icons**: Lucide React

### Current Tauri Backend Integration
The frontend currently communicates with Tauri through these key interfaces:

```typescript
// Core media operations
getMediaMetadata(path: string): Promise<MediaMeta>
applyEdits(projectJson: string): Promise<void>
generatePreview(projectJson: string, atMs: number): Promise<PreviewResult>
exportProject(projectJson: string, settings: ExportSettings): Promise<ExportResult>

// Screen recording
listCaptureDevices(): Promise<ListDevices>
startScreenRecord(settings: RecordSettings): Promise<{recordingId: string, outPath: string}>
stopScreenRecord(recordingId: string): Promise<string>

// Progress tracking
listenExportProgress(handler: (event: ProgressEvent) => void): Promise<UnlistenFn>
```

### Backend Functionality (Rust/Tauri)
- **FFmpeg Integration**: Media processing, metadata extraction, video export
- **Screen Recording**: macOS AVFoundation-based screen capture
- **File System Operations**: Cache management, temporary file handling
- **Background Jobs**: Export progress tracking with event emission

## Migration Strategy

### Phase 1: Frontend Repository Separation

#### 1.1 Create New Frontend Repository
```bash
# Create new repository
mkdir clipforge-frontend
cd clipforge-frontend
git init

# Copy frontend files
cp -r /path/to/clipforge-tauri/src ./src
cp -r /path/to/clipforge-tauri/public ./public
cp package.json ./package.json
cp vite.config.ts ./vite.config.ts
cp tsconfig.json ./tsconfig.json
cp tailwind.config.js ./tailwind.config.js
cp postcss.config.js ./postcss.config.js
cp components.json ./components.json
```

#### 1.2 Update Frontend Dependencies
Remove Tauri-specific dependencies and add Electron communication layer:

```json
{
  "dependencies": {
    // Remove Tauri dependencies
    // "@tauri-apps/api": "^2",
    // "@tauri-apps/plugin-opener": "^2",
    
    // Add Electron communication
    "electron-ipc": "^1.0.0",
    
    // Keep all other dependencies unchanged
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-slider": "^1.3.6",
    "@radix-ui/react-slot": "^1.2.3",
    "@tailwindcss/forms": "^0.5.10",
    "@tailwindcss/postcss": "^4.1.16",
    "@tailwindcss/vite": "^4.1.16",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "immer": "^10.2.0",
    "lucide-react": "^0.548.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "tailwind-merge": "^3.3.1",
    "tailwindcss-animate": "^1.0.7",
    "zustand": "^5.0.8"
  },
  "devDependencies": {
    // Remove Tauri CLI
    // "@tauri-apps/cli": "^2.9.1",
    
    // Keep build tools
    "@types/node": "^24.9.1",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.6.0",
    "autoprefixer": "^10.4.21",
    "postcss": "^8.5.6",
    "tailwindcss": "^4.1.16",
    "typescript": "~5.8.3",
    "vite": "^7.0.4"
  }
}
```

#### 1.3 Update Vite Configuration
Modify `vite.config.ts` to remove Tauri-specific settings:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// Remove Tauri-specific host configuration
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  // Path aliases
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Standard Vite configuration
  clearScreen: false,
  server: {
    port: 3000, // Standard React dev server port
    strictPort: true,
    hmr: {
      port: 3001,
    },
  },
}));
```

### Phase 2: Electron Backend Implementation

#### 2.1 Create Electron Backend Repository
```bash
mkdir clipforge-electron-backend
cd clipforge-electron-backend
npm init -y
```

#### 2.2 Install Electron Dependencies
```json
{
  "name": "clipforge-electron-backend",
  "version": "1.0.0",
  "main": "src/main.js",
  "scripts": {
    "start": "electron .",
    "dev": "electron . --dev",
    "build": "electron-builder",
    "pack": "electron-builder --dir"
  },
  "dependencies": {
    "electron": "^28.0.0",
    "fluent-ffmpeg": "^2.1.2",
    "node-ffmpeg": "^0.6.2",
    "desktop-capture": "^1.0.0",
    "fs-extra": "^11.2.0",
    "path": "^0.12.7",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "electron-builder": "^24.9.1"
  }
}
```

#### 2.3 Implement Electron Main Process
Create `src/main.js`:

```javascript
const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

let mainWindow;
let recordingProcesses = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load frontend (development vs production)
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// IPC Handlers for Tauri command equivalents
ipcMain.handle('get-media-metadata', async (event, filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err.message);
        return;
      }
      
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      
      resolve({
        duration_ms: Math.round(metadata.format.duration * 1000),
        width: videoStream?.width,
        height: videoStream?.height,
        has_audio: !!audioStream,
        codec_video: videoStream?.codec_name,
        codec_audio: audioStream?.codec_name,
        rotation_deg: videoStream?.rotation
      });
    });
  });
});

ipcMain.handle('apply-edits', async (event, projectJson) => {
  // Implement edit plan processing
  // This would parse the project JSON and prepare for rendering
  return 'ok';
});

ipcMain.handle('generate-preview', async (event, projectJson, atMs) => {
  const cacheDir = path.join(app.getPath('temp'), 'clipforge-cache');
  await fs.ensureDir(cacheDir);
  
  const previewPath = path.join(cacheDir, `preview_${Date.now()}.jpg`);
  
  return new Promise((resolve, reject) => {
    // Extract frame at specified timestamp
    ffmpeg(projectJson.sourcePath)
      .seekInput(atMs / 1000)
      .frames(1)
      .output(previewPath)
      .on('end', () => {
        resolve({
          url: `file://${previewPath}`,
          ts: atMs
        });
      })
      .on('error', reject)
      .run();
  });
});

ipcMain.handle('export-project', async (event, projectJson, settings) => {
  const outputDir = path.join(app.getPath('documents'), 'ClipForge Exports');
  await fs.ensureDir(outputDir);
  
  const outputPath = path.join(outputDir, `export_${Date.now()}.${settings.format}`);
  
  return new Promise((resolve, reject) => {
    const command = ffmpeg()
      .input(projectJson.sourcePath)
      .output(outputPath)
      .format(settings.format)
      .videoCodec('libx264')
      .audioCodec('aac');
    
    if (settings.width && settings.height) {
      command.size(`${settings.width}x${settings.height}`);
    }
    
    if (settings.fps) {
      command.fps(settings.fps);
    }
    
    if (settings.bitrate) {
      command.videoBitrate(settings.bitrate);
    }
    
    command
      .on('progress', (progress) => {
        mainWindow.webContents.send('export-progress', {
          phase: 'encoding',
          current: progress.frames,
          total: progress.frames || 1000,
          message: `Encoding frame ${progress.frames}`
        });
      })
      .on('end', () => {
        const stats = fs.statSync(outputPath);
        resolve({
          path: outputPath,
          duration_ms: Math.round(projectJson.duration * 1000),
          size_bytes: stats.size
        });
      })
      .on('error', reject)
      .run();
  });
});

ipcMain.handle('list-capture-devices', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window']
    });
    
    return {
      displays: sources.map(source => source.name),
      audio_inputs: ['Default Microphone', 'Built-in Microphone'] // Simplified
    };
  } catch (error) {
    throw new Error(`Failed to list capture devices: ${error.message}`);
  }
});

ipcMain.handle('start-screen-record', async (event, settings) => {
  const recordingId = uuidv4();
  const outputDir = path.join(app.getPath('documents'), 'ClipForge Recordings');
  await fs.ensureDir(outputDir);
  
  const outputPath = path.join(outputDir, `recording_${recordingId}.mp4`);
  
  const sources = await desktopCapturer.getSources({
    types: ['screen']
  });
  
  if (sources.length === 0) {
    throw new Error('No screen sources available');
  }
  
  const source = sources[settings.display_index || 0];
  
  // Start recording process
  const command = ffmpeg()
    .input(source.id)
    .inputFormat('avfoundation')
    .output(outputPath)
    .format('mp4')
    .videoCodec('libx264')
    .audioCodec('aac')
    .fps(settings.fps || 30);
  
  const process = command.spawn();
  recordingProcesses.set(recordingId, { process, outputPath });
  
  return { recordingId, outPath: outputPath };
});

ipcMain.handle('stop-screen-record', async (event, recordingId) => {
  const recording = recordingProcesses.get(recordingId);
  if (!recording) {
    throw new Error('Recording not found');
  }
  
  recording.process.kill('SIGTERM');
  recordingProcesses.delete(recordingId);
  
  return recording.outputPath;
});

app.whenReady().then(createWindow);

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
```

#### 2.4 Create Preload Script
Create `src/preload.js`:

```javascript
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Media operations
  getMediaMetadata: (path) => ipcRenderer.invoke('get-media-metadata', path),
  applyEdits: (projectJson) => ipcRenderer.invoke('apply-edits', projectJson),
  generatePreview: (projectJson, atMs) => ipcRenderer.invoke('generate-preview', projectJson, atMs),
  exportProject: (projectJson, settings) => ipcRenderer.invoke('export-project', projectJson, settings),
  
  // Screen recording
  listCaptureDevices: () => ipcRenderer.invoke('list-capture-devices'),
  startScreenRecord: (settings) => ipcRenderer.invoke('start-screen-record', settings),
  stopScreenRecord: (recordingId) => ipcRenderer.invoke('stop-screen-record', recordingId),
  
  // Progress events
  onExportProgress: (callback) => {
    ipcRenderer.on('export-progress', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('export-progress');
  }
});
```

### Phase 3: Frontend Integration Updates

#### 3.1 Update Bindings Layer
Replace `src/lib/bindings.ts`:

```typescript
// Electron API bindings - replaces Tauri commands
// This maintains the same interface as the original Tauri bindings

export interface MediaMeta {
  duration_ms: number;
  width?: number;
  height?: number;
  has_audio?: boolean;
  codec_video?: string;
  codec_audio?: string;
  rotation_deg?: number;
}

export interface PreviewResult {
  url: string;
  ts: number;
}

export interface ExportSettings {
  format: 'mp4' | 'mov';
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: number;
}

export interface ExportResult {
  path: string;
  duration_ms: number;
  size_bytes: number;
}

export interface ProgressEvent {
  phase: string;
  current: number;
  total: number;
  message: string;
}

export interface ListDevices {
  displays: string[];
  audio_inputs: string[];
}

export interface RecordSettings {
  display_index?: number;
  audio_index?: number;
  fps?: number;
}

// Electron API calls (maintains same interface as Tauri)
export async function getMediaMetadata(path: string): Promise<MediaMeta> {
  return window.electronAPI.getMediaMetadata(path);
}

export async function applyEdits(projectJson: string): Promise<void> {
  return window.electronAPI.applyEdits(projectJson);
}

export async function generatePreview(projectJson: string, atMs: number): Promise<PreviewResult> {
  return window.electronAPI.generatePreview(projectJson, atMs);
}

export async function exportProject(
  projectJson: string,
  settings: ExportSettings
): Promise<ExportResult> {
  return window.electronAPI.exportProject(projectJson, settings);
}

export async function listenExportProgress(
  handler: (event: ProgressEvent) => void
): Promise<() => void> {
  return window.electronAPI.onExportProgress(handler);
}

export async function listCaptureDevices(): Promise<ListDevices> {
  return window.electronAPI.listCaptureDevices();
}

export async function startScreenRecord(settings: RecordSettings): Promise<{ recordingId: string; outPath: string }> {
  return window.electronAPI.startScreenRecord(settings);
}

export async function stopScreenRecord(recordingId: string): Promise<string> {
  return window.electronAPI.stopScreenRecord(recordingId);
}

// Type declaration for Electron API
declare global {
  interface Window {
    electronAPI: {
      getMediaMetadata: (path: string) => Promise<MediaMeta>;
      applyEdits: (projectJson: string) => Promise<void>;
      generatePreview: (projectJson: string, atMs: number) => Promise<PreviewResult>;
      exportProject: (projectJson: string, settings: ExportSettings) => Promise<ExportResult>;
      listCaptureDevices: () => Promise<ListDevices>;
      startScreenRecord: (settings: RecordSettings) => Promise<{ recordingId: string; outPath: string }>;
      stopScreenRecord: (recordingId: string) => Promise<string>;
      onExportProgress: (callback: (event: ProgressEvent) => void) => () => void;
    };
  }
}
```

#### 3.2 Update TypeScript Configuration
Add Electron types to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["node", "electron"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Phase 4: Build and Deployment Configuration

#### 4.1 Frontend Build Configuration
Update frontend `package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "build:electron": "npm run build && electron-builder"
  }
}
```

#### 4.2 Electron Builder Configuration
Create `electron-builder.json` in backend repository:

```json
{
  "appId": "com.starscape.clipforge",
  "productName": "Starscape ClipForge",
  "directories": {
    "output": "dist"
  },
  "files": [
    "src/**/*",
    "node_modules/**/*",
    "package.json"
  ],
  "mac": {
    "category": "public.app-category.video",
    "target": [
      {
        "target": "dmg",
        "arch": ["x64", "arm64"]
      }
    ]
  },
  "win": {
    "target": "nsis"
  },
  "linux": {
    "target": "AppImage"
  }
}
```

### Phase 5: Development Workflow

#### 5.1 Development Setup
1. **Frontend Development**:
   ```bash
   cd clipforge-frontend
   npm install
   npm run dev  # Runs on localhost:3000
   ```

2. **Backend Development**:
   ```bash
   cd clipforge-electron-backend
   npm install
   NODE_ENV=development npm run dev
   ```

#### 5.2 Production Build
1. **Build Frontend**:
   ```bash
   cd clipforge-frontend
   npm run build
   ```

2. **Copy Frontend to Backend**:
   ```bash
   cp -r clipforge-frontend/dist/* clipforge-electron-backend/dist/
   ```

3. **Build Electron App**:
   ```bash
   cd clipforge-electron-backend
   npm run build
   ```

## Key Differences and Considerations

### Advantages of Electron Migration
1. **JavaScript Ecosystem**: Full access to npm packages and Node.js modules
2. **Cross-Platform**: Easier deployment across Windows, macOS, and Linux
3. **Development Tools**: Better debugging and development experience
4. **Community**: Larger community and more resources available
5. **Native Modules**: Easier integration with native libraries

### Challenges and Considerations
1. **Bundle Size**: Electron apps are typically larger than Tauri apps
2. **Performance**: JavaScript backend may be slower than Rust for CPU-intensive tasks
3. **Security**: Need to properly configure context isolation and disable node integration
4. **FFmpeg Integration**: May require additional setup for FFmpeg binaries

### Migration Timeline
- **Week 1**: Frontend repository separation and dependency updates
- **Week 2**: Basic Electron backend implementation
- **Week 3**: FFmpeg integration and media processing
- **Week 4**: Screen recording implementation
- **Week 5**: Testing, debugging, and optimization
- **Week 6**: Build configuration and deployment setup

## Testing Strategy

### Unit Tests
- Test all IPC handlers independently
- Mock FFmpeg operations for faster testing
- Test error handling and edge cases

### Integration Tests
- Test frontend-backend communication
- Test file operations and media processing
- Test screen recording functionality

### End-to-End Tests
- Test complete user workflows
- Test cross-platform compatibility
- Test performance with large media files

## Conclusion

This migration plan provides a comprehensive roadmap for moving from Tauri to Electron while maintaining the same functionality and user experience. The key is maintaining the same API interface in the frontend bindings layer, allowing the React components to remain largely unchanged while gaining the benefits of Electron's ecosystem and cross-platform capabilities.

The modular approach allows for incremental migration and testing, reducing risk and ensuring a smooth transition.
