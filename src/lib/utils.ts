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

// Collision detection for clips on timeline
export function detectClipCollision(
  newClipStart: number,
  newClipEnd: number,
  trackClips: Array<{ id: string; startMs: number; endMs: number }>,
  excludeClipId?: string
): { hasCollision: boolean; collidingClip?: { id: string; startMs: number; endMs: number } } {
  // Check if the new clip would overlap with any existing clips on the track
  for (const clip of trackClips) {
    // Skip the clip being moved (if provided)
    if (excludeClipId && clip.id === excludeClipId) continue;

    // Check for overlap: clips overlap if one starts before the other ends
    const overlaps = newClipStart < clip.endMs && newClipEnd > clip.startMs;

    if (overlaps) {
      return { hasCollision: true, collidingClip: clip };
    }
  }

  return { hasCollision: false };
}

// Resolve clip collision with smart insertion
// Returns the resolved position and information about what clips need to be shifted
export function resolveClipCollision(
  desiredStartMs: number,
  clipDuration: number,
  trackClips: Array<{ id: string; startMs: number; endMs: number }>,
  excludeClipId?: string,
  mouseOffsetMs?: number
): {
  resolvedStartMs: number;
  shouldShift: boolean;
  shouldCancel: boolean;
  targetClipId?: string;
} {
  const desiredEndMs = desiredStartMs + clipDuration;

  // Check for collision
  const collision = detectClipCollision(desiredStartMs, desiredEndMs, trackClips, excludeClipId);

  if (collision.hasCollision && collision.collidingClip) {
    const targetClip = collision.collidingClip;
    const targetClipMidpoint = targetClip.startMs + ((targetClip.endMs - targetClip.startMs) / 2);

    // Calculate where the mouse cursor actually is relative to the clip being dragged
    // mouseOffsetMs is how far into the dragged clip the user grabbed it
    const mouseCursorMs = desiredStartMs + (mouseOffsetMs ?? clipDuration / 2);

    // Determine if mouse cursor is on left or right half of target clip
    const dropOnLeftHalf = mouseCursorMs < targetClipMidpoint;

    if (dropOnLeftHalf) {
      // User wants to insert before the target clip
      const proposedStartMs = targetClip.startMs - clipDuration;

      // Special case: if proposed position would be before timeline start (< 0)
      // Place at 0 and shift the target and subsequent clips
      if (proposedStartMs < 0) {
        return {
          resolvedStartMs: 0,
          shouldShift: true,
          shouldCancel: false,
          targetClipId: targetClip.id
        };
      }

      // Check if we can fit to the left without shifting (no overlap with earlier clips)
      if (proposedStartMs >= 0) {
        const proposedEndMs = targetClip.startMs;
        const wouldOverlapEarlier = detectClipCollision(
          proposedStartMs,
          proposedEndMs,
          trackClips,
          excludeClipId
        );

        if (!wouldOverlapEarlier.hasCollision) {
          // We can fit to the left without shifting - just place it there
          return {
            resolvedStartMs: proposedStartMs,
            shouldShift: false,
            shouldCancel: false
          };
        } else {
          // There's another clip to the left that would overlap - cancel the drop
          return {
            resolvedStartMs: desiredStartMs,
            shouldShift: false,
            shouldCancel: true
          };
        }
      }
    } else {
      // Drop on right half - place after the target clip (original behavior)
      return {
        resolvedStartMs: targetClip.endMs,
        shouldShift: false,
        shouldCancel: false
      };
    }
  }

  // No collision - use desired position
  return {
    resolvedStartMs: desiredStartMs,
    shouldShift: false,
    shouldCancel: false
  };
}

// Format file size in human-readable format
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + ' ' + sizes[i];
}
