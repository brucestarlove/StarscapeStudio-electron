# ClipForge Electron Architecture Overview

This document provides a comprehensive overview of the ClipForge Electron application architecture for quick reference when making changes.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   main.js   │  │  ffmpeg.js  │  │     cache.js        │  │
│  │             │  │             │  │                     │  │
│  │ • Window    │  │ • FFmpeg    │  │ • Cache dirs        │  │
│  │ • IPC       │  │   config    │  │ • File management   │  │
│  │ • Lifecycle │  │ • Binaries  │  │ • Temp files        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ metadata.js │  │ editPlan.js │  │     export.js        │  │
│  │             │  │             │  │                     │  │
│  │ • Media     │  │ • Timeline  │  │ • Video export       │  │
│  │   probing   │  │   planning  │  │ • Progress events    │  │
│  │ • Thumbnails│  │ • Clip ops  │  │ • FFmpeg jobs       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  ingest.js  │  │  preload.js │  │                     │  │
│  │             │  │             │  │                     │  │
│  │ • File      │  │ • IPC       │  │                     │  │
│  │   ingestion │  │   bridge    │  │                     │  │
│  │ • Asset     │  │ • Security  │  │                     │  │
│  │   creation  │  │   context   │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ IPC Communication
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Renderer Process (React)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   App.tsx   │  │  bindings.ts │  │    Store Layer      │  │
│  │             │  │             │  │                     │  │
│  │ • Main      │  │ • Electron  │  │ • projectStore.ts   │  │
│  │   layout    │  │   API       │  │ • playbackStore.ts  │  │
│  │ • Drag &    │  │ • Type      │  │ • uiStore.ts        │  │
│  │   Drop      │  │   safety    │  │ • Zustand + Immer   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Components  │  │ Components  │  │    Components       │  │
│  │             │  │             │  │                     │  │
│  │ • TopBar    │  │ • Stage     │  │ • TimelineDock       │  │
│  │ • LeftRail  │  │ • Timeline  │  │ • TransportControls  │  │
│  │ • LeftPane  │  │ • Track     │  │ • ClipView          │  │
│  │ • Library   │  │ • Playhead  │  │ • Ruler             │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend (Renderer Process)
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Immer** - Immutable state updates
- **@dnd-kit** - Drag and drop functionality
- **Radix UI** - Accessible UI components

### Backend (Main Process)
- **Electron 28** - Desktop app framework
- **Node.js** - Runtime
- **fluent-ffmpeg** - Video processing
- **fs-extra** - Enhanced file system operations

## Project Structure

```
clipforge-electron/
├── electron/                 # Main process code
│   ├── main.js              # App entry point, window management, IPC
│   ├── preload.js           # IPC bridge for renderer
│   ├── ffmpeg.js            # FFmpeg configuration
│   ├── cache.js             # Cache directory management
│   ├── metadata.js          # Media metadata extraction
│   ├── editPlan.js          # Timeline planning and clip operations
│   ├── export.js            # Video export functionality
│   ├── ingest.js            # File ingestion
│   └── bin/macos/           # Bundled FFmpeg binaries
├── src/                     # Renderer process code
│   ├── components/          # React components
│   │   ├── ui/             # Reusable UI components
│   │   ├── LeftPane/       # Asset library
│   │   ├── Stage/          # Preview canvas
│   │   ├── Timeline/       # Timeline components
│   │   └── Transport/       # Playback controls
│   ├── store/              # Zustand stores
│   │   ├── projectStore.ts # Project state (assets, clips, tracks)
│   │   ├── playbackStore.ts# Playback state (time, zoom, playing)
│   │   └── uiStore.ts      # UI state (panels, etc.)
│   ├── lib/                # Utilities
│   │   ├── bindings.ts     # Electron API bindings
│   │   └── utils.ts        # Helper functions
│   ├── types/              # TypeScript type definitions
│   └── App.tsx             # Main React component
├── dist/                   # Built frontend assets
├── build/                  # Electron build output
└── docs/                   # Documentation
```

## Data Flow

### 1. State Management (Zustand Stores)

**Project Store** (`src/store/projectStore.ts`)
- Manages project data: assets, tracks, clips, canvas nodes
- Persisted to localStorage
- Actions: addAssets, createClip, moveClip, trimClip, etc.

**Playback Store** (`src/store/playbackStore.ts`)
- Manages playback state: currentTime, playing, zoom, snap
- Animation loop for time updates
- Actions: play, pause, seek, zoomIn/Out, etc.

**UI Store** (`src/store/uiStore.ts`)
- Manages UI state: panel collapsed states, etc.
- Simple state for UI preferences

### 2. IPC Communication

**Main Process → Renderer**
- `export-progress` - Export progress updates
- `start-recording` - Screen recording start signal
- `stop-recording` - Screen recording stop signal
- `app-shutting-down` - App cleanup signal
- `app-error` - Error notifications

**Renderer → Main Process**
- `get-media-metadata` - Extract media info
- `generate-preview` - Generate preview frames
- `export-project` - Export video
- `ingest-files` - Process uploaded files
- `list-capture-devices` - Get screen recording sources
- `start-screen-record` - Begin screen recording
- `stop-screen-record` - End screen recording

### 3. Component Architecture

**Layout Structure** (App.tsx)
```
┌─────────────────────────────────────────┐
│                TopBar                    │
├─────┬─────────┬─────────────────────────┤
│Left │ LeftPane│        Stage             │
│Rail │         │                         │
├─────┴─────────┴─────────────────────────┤
│            TimelineDock                 │
└─────────────────────────────────────────┘
```

**Key Components**
- **TopBar**: Project name, export, settings
- **LeftRail**: Tool palette, collapsed state
- **LeftPane**: Asset library, file browser
- **Stage**: Video preview canvas
- **TimelineDock**: Timeline, tracks, transport controls

## Core Data Types

```typescript
// Project structure
interface ProjectState {
  projectName: string;
  assets: Asset[];           // Media files
  tracks: Track[];           // Timeline tracks
  clips: Record<string, Clip>; // Timeline clips
  canvasNodes: Record<string, CanvasNode>; // Visual elements
  selectedClipIds: string[];
}

// Media assets
interface Asset {
  id: string;
  type: 'video' | 'audio' | 'image';
  name: string;
  url: string;              // Object URL or file://
  duration: number;         // milliseconds
  metadata: { width?, height?, fps? };
}

// Timeline clips
interface Clip {
  id: string;
  assetId: string;
  trackId: string;
  startMs: number;          // Timeline position
  endMs: number;
  trimStartMs: number;      // Source trim start
  trimEndMs: number;        // Source trim end
  zIndex: number;
}

// Timeline tracks
interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio';
  clips: string[];          // Clip IDs
  locked: boolean;
  visible: boolean;
}
```

## Development Workflow

### Running the App
```bash
# Development mode (Vite + Electron)
npm run dev

# Build frontend only
npm run build

# Build and package Electron app
npm run electron:build
```

### Key Development Files

**Frontend Entry Points**
- `src/main.tsx` - React app entry
- `src/App.tsx` - Main component with layout
- `vite.config.ts` - Vite configuration

**Backend Entry Points**
- `electron/main.js` - Electron main process
- `electron/preload.js` - IPC bridge
- `package.json` - Scripts and dependencies

**State Management**
- `src/store/projectStore.ts` - Project data and actions
- `src/store/playbackStore.ts` - Playback state and controls
- `src/lib/bindings.ts` - Electron API interface

## Common Development Tasks

### Adding New IPC Commands
1. Add handler in `electron/main.js`
2. Expose in `electron/preload.js`
3. Add TypeScript interface in `src/lib/bindings.ts`
4. Use in React components

### Adding New State Actions
1. Define action in appropriate store (`src/store/*.ts`)
2. Use Zustand's `set` function with Immer
3. Call from React components

### Adding New UI Components
1. Create component in `src/components/`
2. Add to layout in `src/App.tsx` or parent component
3. Connect to stores as needed

### File Processing Pipeline
1. **Ingestion**: Files → `ingestFiles()` → Asset objects
2. **Timeline**: Assets → Drag to timeline → Clip creation
3. **Editing**: Clip manipulation → State updates
4. **Export**: Project state → `exportProject()` → Video file

## Build and Distribution

### Development Build
- Vite dev server on port 3000
- Electron loads from `http://localhost:3000`
- Hot reload enabled

### Production Build
- Vite builds to `dist/` directory
- Electron loads from `dist/index.html`
- Packaged with electron-builder

### Cache Management
- Cache directories managed by `CacheDirs` class
- Media files, previews, segments stored in user data
- Automatic cleanup on app shutdown

## Security Considerations

- **Context Isolation**: Enabled (`contextIsolation: true`)
- **Node Integration**: Disabled (`nodeIntegration: false`)
- **Preload Script**: Only safe APIs exposed via `contextBridge`
- **File Access**: Limited to user-selected files and cache directories

## Performance Considerations

- **State Persistence**: Only essential data persisted to localStorage
- **Animation Loop**: Single RAF loop for playback updates
- **Process Tracking**: Active FFmpeg processes tracked for cleanup
- **Memory Management**: Object URLs cleaned up, processes terminated on exit

This architecture provides a solid foundation for a video editing application with clear separation between frontend and backend concerns, robust state management, and efficient IPC communication.
