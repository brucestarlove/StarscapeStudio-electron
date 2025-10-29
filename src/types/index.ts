// Core types for the Starscape video editor

export interface Asset {
  id: string;
  type: 'video' | 'audio' | 'image';
  name: string;
  url: string;          // Object URL for local files
  duration: number;     // milliseconds
  thumbnailUrl?: string;
  fileSize?: number;    // bytes
  metadata: {
    width?: number;
    height?: number;
    fps?: number;
  };
}

export interface Clip {
  id: string;
  assetId: string;
  trackId: string;
  startMs: number;      // Position on timeline
  endMs: number;        // Position on timeline
  trimStartMs: number;  // Trim from source asset
  trimEndMs: number;    // Trim from source asset
  zIndex: number;
}

export interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio';
  clips: string[];      // Clip IDs
  locked: boolean;
  visible: boolean;
}

export interface CanvasNode {
  id: string;
  clipId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
}

export interface ProjectState {
  id: string;               // Unique project identifier
  projectName: string;
  assets: Asset[];
  tracks: Track[];
  clips: Record<string, Clip>;
  canvasNodes: Record<string, CanvasNode>;
  selectedClipIds: string[];
  selectedTrackId: string | null;
}

export interface PlaybackState {
  currentTimeMs: number;
  playing: boolean;
  zoom: number;         // Pixels per millisecond
  snapEnabled: boolean;
  volume: number;       // Master volume (0-1)
  isMuted: boolean;     // Mute state
}

export interface ExportSettings {
  format: 'mp4' | 'mov';
  resolution: '720p' | '1080p' | 'source';
  quality: 'low' | 'medium' | 'high';
  filename: string;
}

// Drag and drop types
export interface DragItem {
  type: 'asset' | 'clip' | 'trim-handle' | 'playhead';
  id: string;
  assetId?: string;
  clipId?: string;
  side?: 'left' | 'right';
}

export interface DropResult {
  trackId: string;
  positionMs: number;
}
