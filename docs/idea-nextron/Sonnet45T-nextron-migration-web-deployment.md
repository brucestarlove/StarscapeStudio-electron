# ClipForge Migration to Nextron: Web Deployment Analysis

## Executive Summary

This document analyzes the feasibility of migrating ClipForge from its current Vite + Electron architecture to a Nextron (Next.js + Electron) architecture that supports both desktop and web deployment. The goal is to determine if a single codebase can target both Vercel (or similar platforms) for web deployment and Electron for native desktop apps.

**Key Finding:** A hybrid approach is recommended where core editing functionality can work on the web with significant architectural changes, but advanced features (FFmpeg-based export, screen recording) would remain desktop-only or require cloud-based alternatives.

---

## Current Architecture Analysis

### Technology Stack
- **Frontend:** React 19 + Vite + TypeScript
- **Backend:** Electron main process (Node.js)
- **Video Processing:** FFmpeg binaries (bundled for macOS)
- **State Management:** Zustand stores
- **UI Framework:** Shadcn/ui + TailwindCSS
- **Media Rendering:** Canvas-based video renderer + Web Audio API

### Electron-Dependent Features

#### Critical Dependencies
1. **FFmpeg Processing** (`electron/ffmpeg.js`)
   - Local binary execution for video processing
   - Video export/encoding
   - Frame extraction for previews
   - Format conversion (WebM → MP4)
   - **Web Impact:** Cannot run native binaries in browser

2. **File System Access** (`electron/ingest.js`, `electron/cache.js`)
   - Cache directory management
   - File ingestion/copying to cache
   - Project file persistence
   - **Web Impact:** Limited browser file system access

3. **Custom Protocol** (`main.js` - `media://` protocol)
   - Serves local media files via custom protocol
   - Bypasses CORS for local file access
   - Stream large video files efficiently
   - **Web Impact:** Browser security model incompatible

4. **Screen Recording** (`main.js` - `desktopCapturer` API)
   - Desktop/window capture
   - Native recording capabilities
   - **Web Impact:** Web has limited Screen Capture API

5. **Native Dialogs & OS Integration**
   - File picker dialogs
   - Reveal in Finder/Explorer
   - **Web Impact:** Limited native dialogs in browser

---

## Nextron Architecture Benefits

### What Nextron Provides
1. **Unified Codebase:** Single Next.js app builds for both web and desktop
2. **Static Export:** `output: 'export'` generates static HTML/CSS/JS
3. **Conditional Features:** Detect environment and enable/disable features
4. **Shared Components:** UI components work identically on web and desktop
5. **Type Safety:** Shared TypeScript types across environments
6. **Modern DX:** Next.js tooling + Electron capabilities

### Architecture Separation
```
nextron-clipforge/
├── main/                    # Electron main process (desktop only)
│   ├── background.ts        # App initialization
│   ├── helpers/             # Window management
│   ├── preload.ts          # IPC bridge
│   └── services/           # Desktop-only services
│       ├── ffmpeg.ts       # FFmpeg processing
│       ├── filesystem.ts   # File operations
│       └── recording.ts    # Screen capture
├── renderer/               # Next.js app (web + desktop)
│   ├── app/                # Next.js 15 App Router
│   │   ├── layout.tsx      # Root layout
│   │   ├── page.tsx        # Home/editor
│   │   └── api/            # API routes (web only)
│   ├── components/         # React components
│   │   ├── Timeline/       # Timeline components
│   │   ├── Stage/          # Video canvas
│   │   └── ui/             # Shadcn/ui components
│   ├── lib/                # Shared utilities
│   │   ├── adapters/       # Environment adapters
│   │   ├── AudioManager.ts # Works in both
│   │   └── CanvasVideoRenderer.ts
│   └── store/              # Zustand stores
└── shared/                 # Shared types/constants
    └── types.ts
```

---

## Migration Strategy: Feature-by-Feature Analysis

### ✅ Features That Work on Web (Minimal Changes)

#### 1. UI Components (All Shadcn/ui)
- **Current:** React components with Tailwind
- **Web Status:** ✅ Works identically
- **Changes:** None required
- **Notes:** Shadcn/ui is browser-native, TailwindCSS compiles to static CSS

#### 2. Canvas Video Rendering (`src/lib/CanvasVideoRenderer.ts`)
- **Current:** Draws video frames to canvas using `<video>` element
- **Web Status:** ✅ Works with blob URLs
- **Changes:** 
  - Replace `media://` protocol with blob URLs
  - Use File System Access API or in-memory blobs
- **Implementation:**
  ```typescript
  // Desktop: media://path/to/file.mp4
  const videoSrc = isElectron 
    ? `media://${filePath}` 
    : URL.createObjectURL(fileBlob);
  ```

#### 3. Audio Playback (`src/lib/AudioManager.ts`)
- **Current:** Web Audio API
- **Web Status:** ✅ Works identically
- **Changes:** Ensure audio sources use blob URLs on web
- **Notes:** Web Audio API is browser-native

#### 4. State Management (Zustand stores)
- **Current:** Zustand stores for project, playback, UI state
- **Web Status:** ✅ Works identically
- **Changes:** None required
- **Persistence:** Consider `localStorage` for web, `electron-store` for desktop

#### 5. Timeline UI & Interactions
- **Current:** React components with drag-and-drop
- **Web Status:** ✅ Works identically
- **Changes:** None required (dnd-kit is browser-native)

---

### ⚠️ Features That Need Significant Changes for Web

#### 1. Media Ingestion & File Access
**Current Approach:**
```javascript
// electron/ingest.js
async function ingestFiles(filePaths, cache) {
  // Copy files to cache directory
  await fs.copy(filePath, cachedPath);
  // Extract metadata with FFmpeg
  const metadata = await probeMedia(cachedPath);
}
```

**Web Approach (Option A: In-Memory):**
```typescript
// renderer/lib/adapters/ingest-web.ts
async function ingestFiles(files: File[]) {
  const results = [];
  for (const file of files) {
    // Store file in memory or IndexedDB
    const blobUrl = URL.createObjectURL(file);
    
    // Extract metadata using browser APIs or FFmpeg.wasm
    const video = document.createElement('video');
    video.src = blobUrl;
    await video.loadedmetadata;
    
    const metadata = {
      duration_ms: video.duration * 1000,
      width: video.videoWidth,
      height: video.videoHeight,
      has_audio: video.mozHasAudio || Boolean(video.webkitAudioDecodedByteCount),
    };
    
    results.push({ 
      asset_id: generateId(), 
      blob: file, // Keep File object
      metadata 
    });
  }
  return results;
}
```

**Web Approach (Option B: IndexedDB for Large Files):**
```typescript
// Use IndexedDB to store video blobs persistently
import { openDB } from 'idb';

const db = await openDB('clipforge-media', 1, {
  upgrade(db) {
    db.createObjectStore('assets', { keyPath: 'id' });
  }
});

// Store asset
await db.put('assets', { id: assetId, blob: file, metadata });

// Retrieve asset
const asset = await db.get('assets', assetId);
const blobUrl = URL.createObjectURL(asset.blob);
```

**Challenges:**
- Browser storage limits (IndexedDB: ~50% of disk, typically GB range)
- No persistent file paths (must keep File objects or store in IndexedDB)
- Large video files may exceed practical limits

**Recommended Solution:**
- **Desktop:** Current file system caching
- **Web:** IndexedDB for small projects, cloud storage for large projects

---

#### 2. Video Export & FFmpeg Processing

**Current Approach:**
```javascript
// electron/export.js
async function executeExportJob(plan, settings, cacheDirs) {
  // Complex FFmpeg filter chain
  const ffmpegCommand = ffmpeg()
    .input(clip.srcPath)
    .complexFilter(filterChain)
    .output(outputPath);
  await ffmpegCommand.run();
}
```

**Web Approach (Option A: FFmpeg.wasm):**
```typescript
// renderer/lib/adapters/export-web.ts
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

async function exportProjectWeb(plan, settings) {
  const ffmpeg = createFFmpeg({ log: true });
  await ffmpeg.load();
  
  // Load video files into FFmpeg.wasm
  for (const clip of plan.clips) {
    const videoData = await fetchFile(clip.blobUrl);
    ffmpeg.FS('writeFile', clip.id, videoData);
  }
  
  // Run FFmpeg command (similar to desktop)
  await ffmpeg.run(
    '-i', clip1.id,
    '-i', clip2.id,
    '-filter_complex', filterChain,
    'output.mp4'
  );
  
  // Read output file
  const data = ffmpeg.FS('readFile', 'output.mp4');
  const blob = new Blob([data.buffer], { type: 'video/mp4' });
  return URL.createObjectURL(blob);
}
```

**FFmpeg.wasm Limitations:**
- **Performance:** 10-20x slower than native FFmpeg
- **Memory:** Loads entire video files into browser memory
- **Features:** Some codecs/filters not available
- **File Size:** Large WASM bundle (~25MB gzipped)

**Web Approach (Option B: Cloud Processing):**
```typescript
// renderer/lib/adapters/export-cloud.ts
async function exportProjectCloud(plan, settings) {
  // Upload clips to cloud storage (S3/R2)
  const uploadedClips = await uploadClipsToCloud(plan.clips);
  
  // Trigger serverless function for FFmpeg processing
  const response = await fetch('/api/export', {
    method: 'POST',
    body: JSON.stringify({ 
      clips: uploadedClips, 
      settings 
    })
  });
  
  // Poll for completion
  const { jobId } = await response.json();
  const result = await pollExportJob(jobId);
  
  return result.downloadUrl;
}
```

**Cloud Processing Architecture:**
```
Vercel Deployment
├── Frontend (Next.js static)
│   └── Editor UI
└── API Routes (Serverless Functions)
    ├── /api/upload → Upload to R2/S3
    ├── /api/export → Trigger FFmpeg job
    └── /api/jobs/[id] → Job status

External Services
├── AWS Lambda / Cloudflare Workers
│   └── FFmpeg processing (containerized)
├── Cloudflare R2 / AWS S3
│   └── Temporary file storage
└── Optional: Queue (SQS/Redis)
    └── Job management
```

**Challenges:**
- **Cost:** Cloud processing charges per minute
- **Latency:** Upload + processing + download time
- **Privacy:** User media uploaded to cloud
- **Complexity:** Infrastructure management

**Recommended Solution:**
- **Desktop:** Native FFmpeg (current implementation)
- **Web Basic:** FFmpeg.wasm for short clips (<5 min)
- **Web Pro:** Cloud processing for longer/complex exports

---

#### 3. Screen Recording

**Current Approach:**
```javascript
// electron/main.js
ipcMain.handle('start-screen-record', async (event, settings) => {
  const sources = await desktopCapturer.getSources({ types: ['screen'] });
  // Send source to renderer for MediaRecorder
});
```

**Web Approach:**
```typescript
// renderer/lib/adapters/recording-web.ts
async function startScreenRecordWeb() {
  try {
    // Use browser Screen Capture API
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { 
        cursor: 'always',
        displaySurface: 'monitor' // or 'window', 'browser'
      },
      audio: true // System audio (limited support)
    });
    
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
    });
    
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      // Add to project
    };
    
    recorder.start();
    return { recorderId: generateId() };
  } catch (error) {
    throw new Error('Screen recording not supported or denied');
  }
}
```

**Web Limitations:**
- **Browser Support:** Chrome/Edge ✅, Firefox ✅, Safari ⚠️ (partial)
- **System Audio:** Very limited (Chrome only, experimental)
- **Permissions:** User must approve each recording
- **Quality:** Limited codec options vs desktop

**Recommended Solution:**
- **Desktop:** Current `desktopCapturer` API
- **Web:** `getDisplayMedia` with fallback message if unsupported

---

#### 4. Preview Frame Generation

**Current Approach:**
```javascript
// electron/metadata.js
async function extractPosterFrame(videoPath, timeMs, outputPath) {
  await ffmpeg(videoPath)
    .seekInput(timeMs / 1000)
    .frames(1)
    .output(outputPath)
    .run();
  return outputPath;
}
```

**Web Approach:**
```typescript
// renderer/lib/adapters/preview-web.ts
async function extractFrameWeb(videoBlob: Blob, timeMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    video.src = URL.createObjectURL(videoBlob);
    video.currentTime = timeMs / 1000;
    
    video.onseeked = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(URL.createObjectURL(blob));
        } else {
          reject(new Error('Failed to extract frame'));
        }
      }, 'image/jpeg', 0.9);
    };
    
    video.onerror = reject;
  });
}
```

**Web Status:** ✅ Works well (browser-native APIs)
**Changes:** Replace FFmpeg frame extraction with canvas rendering

---

#### 5. Project Persistence

**Current Approach:**
```javascript
// User saves project to file system via dialog
const projectPath = await dialog.showSaveDialog({
  defaultPath: 'my-project.starproj'
});
await fs.writeFile(projectPath, JSON.stringify(project));
```

**Web Approach (Option A: Local Storage):**
```typescript
// Auto-save to localStorage
function saveProject(project: Project) {
  localStorage.setItem(`project-${project.id}`, JSON.stringify(project));
}

// Note: Assets stored separately in IndexedDB
```

**Web Approach (Option B: File System Access API):**
```typescript
// Modern browsers only (Chrome/Edge)
async function saveProjectWeb(project: Project) {
  const handle = await window.showSaveFilePicker({
    suggestedName: 'my-project.starproj',
    types: [{
      description: 'ClipForge Project',
      accept: { 'application/json': ['.starproj'] }
    }]
  });
  
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(project));
  await writable.close();
}
```

**Web Approach (Option C: Cloud Sync):**
```typescript
// Save to backend API
async function saveProjectCloud(project: Project) {
  await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(project)
  });
}
```

**Recommended Solution:**
- **Desktop:** File system dialogs (current)
- **Web:** localStorage + File System Access API with cloud backup option

---

## Environment Detection & Adapter Pattern

### Detect Runtime Environment
```typescript
// renderer/lib/env.ts
export const isElectron = typeof window !== 'undefined' && 
  window.electronAPI !== undefined;

export const isWeb = !isElectron;

export const isBrowser = typeof window !== 'undefined';

// Feature detection
export const hasFileSystemAccess = 'showSaveFilePicker' in window;
export const hasScreenCapture = 'getDisplayMedia' in navigator.mediaDevices;
```

### Adapter Pattern for Platform-Specific Code
```typescript
// renderer/lib/adapters/index.ts
import * as electronAdapter from './electron';
import * as webAdapter from './web';
import { isElectron } from '../env';

// Export unified interface
export const adapter = isElectron ? electronAdapter : webAdapter;

// Usage in components:
import { adapter } from '@/lib/adapters';

async function handleIngest(files: File[]) {
  const results = await adapter.ingestFiles(files);
  // Works on both web and desktop
}
```

### Interface Definition
```typescript
// renderer/lib/adapters/types.ts
export interface PlatformAdapter {
  // Media
  ingestFiles(files: File[]): Promise<IngestResult[]>;
  getMediaMetadata(source: MediaSource): Promise<MediaMeta>;
  
  // Export
  exportProject(plan: EditPlan, settings: ExportSettings): Promise<ExportResult>;
  onExportProgress(callback: (progress: ProgressEvent) => void): () => void;
  
  // Playback
  createMediaSource(asset: Asset): string; // Returns URL
  revokeMediaSource(url: string): void;
  
  // Recording
  startScreenRecord(settings: RecordSettings): Promise<{ id: string }>;
  stopScreenRecord(id: string): Promise<Blob>;
  
  // Persistence
  saveProject(project: Project): Promise<void>;
  loadProject(): Promise<Project>;
  
  // Preview
  extractFrame(source: MediaSource, timeMs: number): Promise<string>;
}
```

### Implementation Example
```typescript
// renderer/lib/adapters/electron.ts
export const electronAdapter: PlatformAdapter = {
  async ingestFiles(files: File[]) {
    // Convert File objects to paths (Electron-specific)
    const paths = files.map(f => f.path);
    return window.electronAPI.ingestFiles({ file_paths: paths });
  },
  
  createMediaSource(asset: Asset) {
    return `media://${asset.file_path}`;
  },
  
  async exportProject(plan, settings) {
    return window.electronAPI.exportProject(
      JSON.stringify(plan), 
      settings
    );
  },
  
  // ... other methods
};

// renderer/lib/adapters/web.ts
export const webAdapter: PlatformAdapter = {
  async ingestFiles(files: File[]) {
    // Store in IndexedDB, extract metadata
    return ingestFilesWeb(files);
  },
  
  createMediaSource(asset: Asset) {
    return URL.createObjectURL(asset.blob);
  },
  
  async exportProject(plan, settings) {
    // Use FFmpeg.wasm or cloud processing
    return exportProjectWeb(plan, settings);
  },
  
  // ... other methods
};
```

---

## Deployment Targets

### Vercel Deployment (Web)

**Configuration:**
```javascript
// renderer/next.config.js
/** @type {import('next').NextConfig} */
module.exports = {
  output: 'export', // Static export for client-side app
  distDir: '../dist',
  trailingSlash: true,
  images: {
    unoptimized: true // No Next.js image optimization
  },
  
  // Environment-based configuration
  env: {
    NEXT_PUBLIC_PLATFORM: 'web'
  }
};
```

**Vercel Project Settings:**
- **Build Command:** `npm run build:web`
- **Output Directory:** `dist`
- **Node.js Version:** 18.x or 20.x
- **Environment Variables:** 
  - `NEXT_PUBLIC_API_URL` (if using cloud export)
  - `NEXT_PUBLIC_ENABLE_EXPORT` (feature flag)

**Static Hosting Benefits:**
- Fast global CDN distribution
- No server costs for UI
- Scales infinitely
- Simple deployment

**Limitations:**
- No server-side rendering (SSR) for dynamic content
- API routes only for serverless functions
- 10-50 MB function size limit
- 10s - 60s function timeout

---

### Alternative Web Hosts

#### Netlify
- Similar to Vercel (static hosting + functions)
- Good for static export
- Slightly different function API

#### Cloudflare Pages
- Excellent global CDN
- Cloudflare Workers for serverless
- Good for static export
- Cloudflare R2 for media storage (S3-compatible, cheaper)

#### Self-Hosted (Docker)
```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY dist ./dist
RUN npm install -g serve
CMD ["serve", "-s", "dist", "-l", "3000"]
```

---

### Desktop Deployment (Electron)

**Build Configuration:**
```javascript
// main/next.config.js (different from web)
module.exports = {
  output: 'export',
  distDir: '../app', // Electron serves from 'app' directory
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  
  env: {
    NEXT_PUBLIC_PLATFORM: 'desktop'
  }
};
```

**Electron Builder:**
```yaml
# electron-builder.yml
appId: digital.starscape.clipforge
productName: Starscape ClipForge
copyright: Copyright © 2025 Starscape
directories:
  output: build
  buildResources: resources
files:
  - from: .
    filter:
      - package.json
      - main
      - app
  - from: electron/bin
    to: bin
    filter:
      - '**/*'
      
mac:
  category: public.app-category.video
  target:
    - dmg
    - zip
  icon: resources/icon.icns
  
win:
  target:
    - nsis
    - portable
  icon: resources/icon.ico
  
linux:
  target:
    - AppImage
    - deb
    - snap
  category: Video
```

---

## Implementation Roadmap

### Phase 1: Project Restructure (1-2 weeks)
**Goal:** Reorganize to Nextron structure without breaking existing functionality

1. **Install Nextron Dependencies**
   ```bash
   npm install next@latest react@latest react-dom@latest
   npm install -D electron-serve
   ```

2. **Create Directory Structure**
   ```
   mkdir -p renderer/app renderer/components renderer/lib
   mv src/components renderer/components/
   mv src/lib renderer/lib/
   mv src/store renderer/store/
   ```

3. **Setup Next.js App Router**
   ```typescript
   // renderer/app/layout.tsx
   export default function RootLayout({ children }) {
     return (
       <html lang="en">
         <body>{children}</body>
       </html>
     );
   }
   
   // renderer/app/page.tsx
   import Editor from '@/components/Editor';
   export default function Home() {
     return <Editor />;
   }
   ```

4. **Update Electron Main Process**
   ```typescript
   // main/background.ts (formerly electron/main.js)
   import path from 'path';
   import { app, BrowserWindow } from 'electron';
   import serve from 'electron-serve';
   
   const isProd = process.env.NODE_ENV === 'production';
   
   if (isProd) {
     serve({ directory: 'app' });
   }
   
   // Rest of main process code
   ```

5. **Update Build Scripts**
   ```json
   {
     "scripts": {
       "dev": "npm run next:dev & npm run electron:dev",
       "next:dev": "next dev renderer -p 3000",
       "electron:dev": "electron main/background.js",
       "build:desktop": "next build renderer && electron-builder",
       "build:web": "NEXT_PUBLIC_PLATFORM=web next build renderer"
     }
   }
   ```

**Deliverable:** App runs in Nextron structure with existing Electron features

---

### Phase 2: Create Platform Adapters (2-3 weeks)
**Goal:** Abstract platform-specific code behind unified interface

1. **Define Adapter Interfaces** (`renderer/lib/adapters/types.ts`)
2. **Implement Electron Adapter** (`renderer/lib/adapters/electron.ts`)
   - Wrap existing `bindings.ts` functions
3. **Implement Web Adapter Stubs** (`renderer/lib/adapters/web.ts`)
   - Return mock data initially
4. **Add Environment Detection** (`renderer/lib/env.ts`)
5. **Update Components to Use Adapters**
   - Replace direct `bindings` calls with `adapter` calls
6. **Test Desktop Functionality**

**Deliverable:** Desktop app works identically, web adapter structure ready

---

### Phase 3: Web Media Handling (2-3 weeks)
**Goal:** Enable media playback and basic editing on web

1. **Implement Web Ingestion**
   ```typescript
   // renderer/lib/adapters/web/ingest.ts
   - File API for file selection
   - IndexedDB for storage
   - Browser APIs for metadata
   ```

2. **Implement Blob URL Media Sources**
   ```typescript
   // Update CanvasVideoRenderer to accept blob URLs
   // Update AudioManager to accept blob URLs
   ```

3. **Implement Web Preview Generation**
   ```typescript
   // renderer/lib/adapters/web/preview.ts
   - Canvas-based frame extraction
   ```

4. **Add localStorage Project Persistence**
   ```typescript
   // renderer/lib/adapters/web/storage.ts
   - Save/load project JSON
   - IndexedDB for media references
   ```

5. **Create Feature Detection UI**
   ```typescript
   // Show warnings if browser doesn't support features
   if (!hasFileSystemAccess) {
     showWarning('Projects will be lost on page refresh');
   }
   ```

**Deliverable:** Web app can import, edit, and play videos

---

### Phase 4: Web Export Options (3-4 weeks)
**Goal:** Enable video export on web (basic)

**Option A: FFmpeg.wasm (Simpler, slower)**

1. **Install FFmpeg.wasm**
   ```bash
   npm install @ffmpeg/ffmpeg @ffmpeg/util
   ```

2. **Implement Web Export**
   ```typescript
   // renderer/lib/adapters/web/export-wasm.ts
   - Load FFmpeg.wasm
   - Convert edit plan to FFmpeg commands
   - Process video in browser
   - Download result
   ```

3. **Add Progress UI**
   ```typescript
   // Show FFmpeg.wasm processing progress
   // Warn about performance implications
   ```

4. **Add Limits**
   ```typescript
   // Max 5 minutes, 720p for free tier
   // Prevent browser memory exhaustion
   ```

**Option B: Cloud Export (Complex, faster)**

1. **Create API Routes**
   ```typescript
   // renderer/app/api/export/route.ts
   - Accept project + media upload
   - Queue FFmpeg job
   - Return job ID
   ```

2. **Setup Cloud Infrastructure**
   ```typescript
   - S3/R2 bucket for temp storage
   - Lambda function with FFmpeg layer
   - Or: Containerized FFmpeg on Cloud Run
   ```

3. **Implement Client-Side Upload**
   ```typescript
   // renderer/lib/adapters/web/export-cloud.ts
   - Upload blobs to cloud storage
   - Trigger export job
   - Poll for completion
   ```

4. **Handle Authentication & Billing**
   ```typescript
   - Require user account for cloud export
   - Implement usage limits/billing
   ```

**Deliverable:** Web app can export videos (with caveats)

---

### Phase 5: Progressive Enhancement (2-3 weeks)
**Goal:** Optimize web experience based on browser capabilities

1. **Feature Detection Dashboard**
   ```typescript
   // Show users what features are available
   {
     videoPlayback: true,
     audioPlayback: true,
     screenRecording: hasScreenCapture,
     export: hasFFmpegWasm || hasCloudExport,
     persistence: hasFileSystemAccess
   }
   ```

2. **Graceful Degradation**
   ```typescript
   // Disable screen recording on Safari
   // Show "upgrade browser" message
   // Offer desktop app download
   ```

3. **Service Worker for Offline**
   ```typescript
   // Cache app shell for offline editing
   // Background sync for project saves
   ```

4. **Performance Optimization**
   ```typescript
   // Code splitting by feature
   // Lazy load FFmpeg.wasm only when needed
   // Optimize bundle size
   ```

**Deliverable:** Polished web experience with clear limitations

---

### Phase 6: Deployment & Testing (1-2 weeks)
**Goal:** Deploy to production environments

1. **Deploy Web to Vercel**
   ```bash
   vercel --prod
   ```

2. **Build Desktop Installers**
   ```bash
   npm run build:desktop
   ```

3. **End-to-End Testing**
   - Test web on Chrome, Firefox, Safari
   - Test desktop on macOS, Windows, Linux
   - Test feature parity where applicable

4. **Documentation**
   - Create comparison chart (web vs desktop features)
   - User guide for limitations
   - Developer docs for adapters

**Deliverable:** Both web and desktop apps in production

---

## Technical Considerations

### Performance Implications

**Web:**
- **Bundle Size:** Next.js app + FFmpeg.wasm = ~30-40 MB initial load
  - Mitigation: Code splitting, lazy loading
- **Memory:** Videos loaded into memory (IndexedDB/blob URLs)
  - Limit: ~1-2 GB practical limit in browser
- **Export Speed:** FFmpeg.wasm is 10-20x slower than native
  - Mitigation: Show warning, limit video length
- **Network:** Uploading large videos for cloud export
  - Mitigation: Resumable uploads, progress indicators

**Desktop:**
- **No Change:** Native FFmpeg, file system access
- **Bundle Size:** Electron app ~200 MB (includes Chromium)

---

### Security Considerations

**Web:**
- **CSP:** Strict Content Security Policy for XSS protection
- **File Access:** No direct file system access (by design)
- **Media Upload:** Validate file types and sizes server-side
- **Authentication:** Required for cloud features
- **CORS:** Blob URLs avoid CORS issues

**Desktop:**
- **Same as Current:** Node integration disabled, context isolation enabled
- **IPC Security:** Validate all messages from renderer

---

### Cost Analysis

**Web Hosting (Vercel Free Tier):**
- Static hosting: Free (100 GB bandwidth/month)
- Serverless functions: 100 GB-hours/month free
- Overages: $20/month for Pro

**Web Hosting (Alternative):**
- Cloudflare Pages: Free unlimited bandwidth
- Netlify: Free 100 GB/month

**Cloud Export Costs (if implemented):**
- AWS Lambda: $0.20 per 1M requests + $0.0000166667/GB-second
- S3 Storage: $0.023/GB/month
- Data Transfer: $0.09/GB out
- **Example:** 5-minute video export (~500 MB) = ~$0.05/export

**Desktop:**
- Free (user's hardware)

---

### Browser Compatibility Matrix

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Canvas Rendering | ✅ | ✅ | ✅ | ✅ |
| Web Audio API | ✅ | ✅ | ✅ | ✅ |
| IndexedDB | ✅ | ✅ | ✅ | ✅ |
| File System Access API | ✅ | ❌ | ❌ | ✅ |
| Screen Capture (getDisplayMedia) | ✅ | ✅ | ⚠️ | ✅ |
| SharedArrayBuffer (FFmpeg.wasm) | ✅ | ✅ | ⚠️ | ✅ |
| MP4 Playback | ✅ | ✅ | ✅ | ✅ |
| WebM Playback | ✅ | ✅ | ❌ | ✅ |

**Notes:**
- Safari requires specific security headers for SharedArrayBuffer
- File System Access API requires polyfill for Firefox/Safari
- WebM playback can use MP4 fallback on Safari

---

## Recommended Approach

### Hybrid Strategy: Desktop-First, Web-Light

**Desktop App (Full Features):**
- ✅ All current features
- ✅ Native FFmpeg processing
- ✅ Screen recording
- ✅ File system projects
- ✅ Maximum performance
- **Target Users:** Professional editors, power users

**Web App (Viewer + Light Editing):**
- ✅ View and play projects
- ✅ Basic editing (trim, reorder clips)
- ✅ Timeline visualization
- ⚠️ Limited export (FFmpeg.wasm for <5 min videos)
- ⚠️ No screen recording
- ⚠️ Browser storage limits
- **Target Users:** Casual users, collaborators, quick edits

**Business Model:**
- **Free Tier:** Web app with limitations
- **Pro Tier:** Desktop app download + cloud export
- **Enterprise:** Self-hosted with custom infrastructure

---

## Decision Matrix

### When to Use Nextron Migration?

**✅ Migrate if:**
- You want a demo/preview web version
- You need cloud collaboration features
- You want to reduce desktop app distribution friction
- You're okay with limited web functionality

**❌ Don't Migrate if:**
- You need full video editing features on web
- Performance is critical (native is always faster)
- You don't have budget for cloud infrastructure
- Your videos are typically >15 minutes or >1080p

---

## Alternative: Keep Electron, Add Web Viewer

**Simpler Approach:**
1. Keep current Electron app as-is
2. Build separate Next.js web app for viewing
3. Share components via npm package
4. Web app reads/plays projects but doesn't edit

**Pros:**
- Less architectural complexity
- Faster to implement
- Clear feature separation
- No performance compromises

**Cons:**
- Two separate codebases
- No unified development
- Limited web functionality

---

## Conclusion

**Can ClipForge be deployed to Vercel as a web app?**
**Yes, with significant limitations.**

### What Works on Web:
✅ UI components and interactions
✅ Timeline visualization
✅ Video/audio playback
✅ Basic editing (trim, reorder)
✅ Canvas rendering
✅ Project persistence (limited)

### What Doesn't Work Well on Web:
❌ High-performance video export
❌ Large file handling (>2 GB)
❌ Screen recording (limited)
❌ Native file system access
❌ FFmpeg-intensive operations

### Recommended Path Forward:

**Option 1: Full Nextron Migration (8-12 weeks)**
- Best for: Long-term product with both desktop and web users
- Effort: High
- Result: Unified codebase, limited web features

**Option 2: Web Viewer + Desktop App (4-6 weeks)**
- Best for: Quick web presence, full desktop features
- Effort: Medium
- Result: Separate apps, clear boundaries

**Option 3: Desktop Only (0 weeks)**
- Best for: Professional users who need full performance
- Effort: None
- Result: Current excellent desktop experience

**My Recommendation:** 
Start with **Option 2** (Web Viewer). Build a Next.js app that can open and play `.starproj` files but doesn't edit them. This gives you:
1. Web presence for demos/marketing
2. Collaboration (view shared projects)
3. No compromise to desktop performance
4. Path to full editing if demand exists
5. Much faster to implement

Later, if web editing demand is strong, you can migrate to full Nextron (Option 1) with the knowledge that you've validated the market need first.

---

## References

- [Nextron Boilerplate Documentation](./nextron-boilerplate-29wed25.md.md)
- [Nextron Security Best Practices](./notes.md#best-security-practices)
- [FFmpeg.wasm Documentation](https://ffmpegwasm.netlify.app/)
- [File System Access API](https://web.dev/file-system-access/)
- [Screen Capture API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Capture_API)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

