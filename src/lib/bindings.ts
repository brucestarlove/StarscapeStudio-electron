// Electron IPC bindings - replaces Tauri commands
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

export interface IngestRequest {
  file_paths: string[];
}

export interface IngestResult {
  asset_id: string;
  file_path: string;
  metadata: MediaMeta;
}

// Electron API calls
export async function getMediaMetadata(path: string): Promise<MediaMeta> {
  return window.electronAPI.getMediaMetadata(path);
}

export async function applyEdits(projectJson: string): Promise<void> {
  // Not implemented in Electron backend yet
  console.warn('applyEdits not implemented');
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

// Screen recording - deferred, not yet implemented
export async function listCaptureDevices(): Promise<ListDevices> {
  throw new Error('Screen recording not yet implemented');
}

export async function startScreenRecord(settings: RecordSettings): Promise<{ recordingId: string; outPath: string }> {
  throw new Error('Screen recording not yet implemented');
}

export async function stopScreenRecord(recordingId: string): Promise<string> {
  throw new Error('Screen recording not yet implemented');
}

// File ingestion
export async function ingestFiles(request: IngestRequest): Promise<IngestResult[]> {
  return window.electronAPI.ingestFiles(request);
}

// Type declaration for Electron API
declare global {
  interface Window {
    electronAPI: {
      getMediaMetadata: (path: string) => Promise<MediaMeta>;
      generatePreview: (projectJson: string, atMs: number) => Promise<PreviewResult>;
      exportProject: (projectJson: string, settings: ExportSettings) => Promise<ExportResult>;
      ingestFiles: (request: IngestRequest) => Promise<IngestResult[]>;
      onExportProgress: (callback: (event: ProgressEvent) => void) => () => void;
    };
  }
}
