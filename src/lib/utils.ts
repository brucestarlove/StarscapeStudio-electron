import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Timeline utility functions
export function msToPixels(ms: number, zoom: number): number {
  return ms * zoom;
}

export function pixelsToMs(pixels: number, zoom: number): number {
  return pixels / zoom;
}

export function formatTimecode(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
}

export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function snapToClips(value: number, clips: Array<{ startMs: number; endMs: number }>, threshold: number = 10): number {
  for (const clip of clips) {
    if (Math.abs(value - clip.startMs) < threshold) {
      return clip.startMs;
    }
    if (Math.abs(value - clip.endMs) < threshold) {
      return clip.endMs;
    }
  }
  return value;
}

export function snapToTimeline(value: number, zoom: number, snapEnabled: boolean = true): number {
  if (!snapEnabled) return value;
  
  // Determine snap interval based on zoom level
  let snapIntervalMs = 1000; // 1 second default
  if (zoom > 0.5) snapIntervalMs = 100; // 100ms for high zoom
  else if (zoom > 0.1) snapIntervalMs = 500; // 500ms for medium zoom
  else if (zoom < 0.05) snapIntervalMs = 5000; // 5 seconds for low zoom
  
  return snapToGrid(value, snapIntervalMs);
}

// File utility functions
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function isVideoFile(filename: string): boolean {
  const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'];
  return videoExtensions.includes(getFileExtension(filename));
}

export function isAudioFile(filename: string): boolean {
  const audioExtensions = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'];
  return audioExtensions.includes(getFileExtension(filename));
}

export function isImageFile(filename: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
  return imageExtensions.includes(getFileExtension(filename));
}

export function getAssetType(filename: string): 'video' | 'audio' | 'image' {
  if (isVideoFile(filename)) return 'video';
  if (isAudioFile(filename)) return 'audio';
  if (isImageFile(filename)) return 'image';
  throw new Error(`Unsupported file type: ${filename}`);
}

// Generate unique IDs
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// Validate clip operations
export function validateClipTrim(clip: { trimStartMs: number; trimEndMs: number }, assetDuration: number): boolean {
  return clip.trimStartMs >= 0 && 
         clip.trimEndMs <= assetDuration && 
         clip.trimStartMs < clip.trimEndMs;
}

export function validateClipPosition(clip: { startMs: number; endMs: number }): boolean {
  return clip.startMs >= 0 && clip.startMs < clip.endMs;
}
