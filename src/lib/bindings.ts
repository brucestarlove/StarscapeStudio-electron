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
  filename?: string;
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

export interface DisplayDevice {
  id: string;
  name: string;
  thumbnail: string;
  index: number;
}

export interface ListDevices {
  displays: DisplayDevice[];
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
  original_file_name: string;
  thumbnail_path: string | null;
  file_size: number;
  metadata: MediaMeta;
}

export interface GenerateImageResult {
  success: boolean;
  path: string;
}

// Electron API calls
export async function getMediaMetadata(path: string): Promise<MediaMeta> {
  return window.electronAPI.getMediaMetadata(path);
}

export async function applyEdits(projectJson: string): Promise<{ success: boolean }> {
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

// Screen recording
export async function listCaptureDevices(): Promise<ListDevices> {
  return window.electronAPI.listCaptureDevices();
}

export async function startScreenRecord(settings: RecordSettings): Promise<{ recordingId: string; outPath: string }> {
  return window.electronAPI.startScreenRecord(settings);
}

export async function stopScreenRecord(recordingId: string): Promise<string> {
  return window.electronAPI.stopScreenRecord(recordingId);
}

export async function listenStartRecording(
  handler: (event: { recordingId: string; sourceId: string; outputPath: string; settings: RecordSettings }) => void
): Promise<() => void> {
  return window.electronAPI.onStartRecording(handler);
}

export async function listenStopRecording(
  handler: (event: { recordingId: string }) => void
): Promise<() => void> {
  return window.electronAPI.onStopRecording(handler);
}

// File ingestion
export async function ingestFiles(request: IngestRequest): Promise<IngestResult[]> {
  return window.electronAPI.ingestFiles(request);
}

// Open file dialog
export async function openFileDialog(): Promise<{ filePaths: string[] }> {
  return window.electronAPI.openFileDialog();
}

// Save blob to file
export async function saveBlobToFile(blobData: ArrayBuffer, filePath: string): Promise<{ success: boolean; path: string }> {
  return window.electronAPI.saveBlobToFile(blobData, filePath);
}

// Reveal file in Finder/Explorer
export async function revealInFinder(filePath: string): Promise<{ success: boolean }> {
  return window.electronAPI.revealInFinder(filePath);
}

// Delete file
export async function deleteFile(filePath: string): Promise<{ success: boolean }> {
  return window.electronAPI.deleteFile(filePath);
}

// Generate cosmic image using AI
export async function generateCosmicImage(prompt: string): Promise<GenerateImageResult> {
  return window.electronAPI.generateImage(prompt);
}

// Type declaration for Electron API
declare global {
  interface Window {
    electronAPI: {
      getMediaMetadata: (path: string) => Promise<MediaMeta>;
      applyEdits: (projectJson: string) => Promise<{ success: boolean }>;
      generatePreview: (projectJson: string, atMs: number) => Promise<PreviewResult>;
      exportProject: (projectJson: string, settings: ExportSettings) => Promise<ExportResult>;
      ingestFiles: (request: IngestRequest) => Promise<IngestResult[]>;
      openFileDialog: () => Promise<{ filePaths: string[] }>;
      saveBlobToFile: (blobData: ArrayBuffer, filePath: string) => Promise<{ success: boolean; path: string }>;
      listCaptureDevices: () => Promise<ListDevices>;
      startScreenRecord: (settings: RecordSettings) => Promise<{ recordingId: string; outPath: string }>;
      stopScreenRecord: (recordingId: string) => Promise<string>;
      onExportProgress: (callback: (event: ProgressEvent) => void) => () => void;
      onStartRecording: (callback: (event: { recordingId: string; sourceId: string; outputPath: string; settings: RecordSettings }) => void) => () => void;
      onStopRecording: (callback: (event: { recordingId: string }) => void) => () => void;
      revealInFinder: (filePath: string) => Promise<{ success: boolean }>;
      deleteFile: (filePath: string) => Promise<{ success: boolean }>;
      generateImage: (prompt: string) => Promise<GenerateImageResult>;
    };
  }
}
