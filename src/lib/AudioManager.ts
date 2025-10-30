/**
 * Audio Manager for Starscape Studio
 * 
 * Handles synchronization of audio playback across:
 * - Embedded audio in video clips (via <video> element)
 * - Audio-only tracks (via <audio> elements)
 * - Master volume and muting
 * 
 * Key responsibilities:
 * - Create and manage audio elements for audio tracks
 * - Synchronize all audio sources to the timeline position
 * - Handle play/pause state across all sources
 * - Manage volume and muting
 */

import type { Clip, Asset, Track } from '@/types';

export interface AudioElement {
  element: HTMLAudioElement;
  trackId: string;
  clipId: string;
}

export class AudioManager {
  private audioElements: Map<string, AudioElement> = new Map();
  private masterVolume: number = 1.0;
  private isMuted: boolean = false;
  private videoElement: HTMLVideoElement | null = null;
  private isPlaying: boolean = false;
  private syncInterval: number | null = null;
  private readonly SYNC_THRESHOLD_MS = 50; // Max drift before re-syncing (50ms)

  constructor() {
    // Initialize with no video element
  }

  /**
   * Set the main video element for embedded audio
   */
  setVideoElement(video: HTMLVideoElement | null): void {
    this.videoElement = video;
    if (video) {
      // Respect muting state
      video.muted = this.isMuted;
      video.volume = this.masterVolume;
    }
  }

  /**
   * Create or update audio element for an audio track clip
   */
  createAudioElement(
    asset: Asset,
    clip: Clip,
    track: Track
  ): HTMLAudioElement {
    const elementKey = `${track.id}-${clip.id}`;

    // Reuse existing element if available
    if (this.audioElements.has(elementKey)) {
      return this.audioElements.get(elementKey)!.element;
    }

    // Create new audio element
    const audio = document.createElement('audio');
    audio.src = asset.url;
    audio.preload = 'auto';
    audio.volume = this.masterVolume;
    audio.muted = this.isMuted;

    // Store reference
    this.audioElements.set(elementKey, {
      element: audio,
      trackId: track.id,
      clipId: clip.id,
    });

    console.log(`[AudioManager] Created audio element for clip ${clip.id} on track ${track.id}`);

    return audio;
  }

  /**
   * Remove audio element
   */
  removeAudioElement(trackId: string, clipId: string): void {
    const elementKey = `${trackId}-${clipId}`;
    const audioElement = this.audioElements.get(elementKey);

    if (audioElement) {
      audioElement.element.pause();
      audioElement.element.src = '';
      this.audioElements.delete(elementKey);
      console.log(`[AudioManager] Removed audio element for clip ${clipId}`);
    }
  }

  /**
   * Sync all audio sources to a specific timeline position
   */
  syncToTime(timelineMs: number, audioClips: Array<{ clip: Clip; asset: Asset; track: Track }>): void {
    // Sync video element if present
    if (this.videoElement) {
      const videoTimeMs = this.videoElement.currentTime * 1000;
      if (Math.abs(videoTimeMs - timelineMs) > this.SYNC_THRESHOLD_MS) {
        this.videoElement.currentTime = timelineMs / 1000;
      }
    }

    // Sync audio track elements
    for (const { clip, asset, track } of audioClips) {
      try {
        const audio = this.createAudioElement(asset, clip, track);

        // Calculate source time accounting for trim
        const sourceTimeMs = timelineMs - clip.startMs + clip.trimStartMs;

        // Check if we're within the clip bounds
        if (timelineMs >= clip.startMs && timelineMs < clip.endMs) {
          // We're within this clip, sync it
          const targetTime = sourceTimeMs / 1000;
          const currentTime = audio.currentTime;

          if (Math.abs(currentTime - targetTime) > this.SYNC_THRESHOLD_MS / 1000) {
            audio.currentTime = targetTime;
          }

          // Ensure audio is playing if manager is playing
          if (this.isPlaying && audio.paused) {
            audio.play().catch(() => {
              // Audio autoplay may be blocked, that's okay
            });
          }
        } else if (!audio.paused) {
          // Outside clip bounds, pause it
          audio.pause();
        }
      } catch (error) {
        console.error(`[AudioManager] Error syncing audio for clip ${clip.id}:`, error);
      }
    }
  }

  /**
   * Play all audio sources
   */
  play(): void {
    this.isPlaying = true;

    if (this.videoElement && this.videoElement.paused) {
      this.videoElement.play().catch(() => {
        // Video autoplay may be blocked
      });
    }

    // Play all audio elements
    for (const { element } of this.audioElements.values()) {
      if (element.paused) {
        element.play().catch(() => {
          // Audio autoplay may be blocked
        });
      }
    }

    // Start continuous sync to handle drift
    this.startSyncLoop();
  }

  /**
   * Pause all audio sources
   */
  pause(): void {
    this.isPlaying = false;
    this.stopSyncLoop();

    if (this.videoElement && !this.videoElement.paused) {
      this.videoElement.pause();
    }

    for (const { element } of this.audioElements.values()) {
      if (!element.paused) {
        element.pause();
      }
    }
  }

  /**
   * Set master volume for all audio sources (0-1)
   */
  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));

    if (this.videoElement) {
      this.videoElement.volume = this.masterVolume;
    }

    for (const { element } of this.audioElements.values()) {
      element.volume = this.masterVolume;
    }
  }

  /**
   * Get current master volume
   */
  getVolume(): number {
    return this.masterVolume;
  }

  /**
   * Mute/unmute all audio sources
   */
  setMuted(muted: boolean): void {
    this.isMuted = muted;

    if (this.videoElement) {
      this.videoElement.muted = muted;
    }

    for (const { element } of this.audioElements.values()) {
      element.muted = muted;
    }
  }

  /**
   * Get mute state
   */
  isMutedNow(): boolean {
    return this.isMuted;
  }

  /**
   * Clear all audio elements (call on cleanup)
   */
  clear(): void {
    this.pause();
    this.stopSyncLoop();

    // Clear all audio elements
    for (const { element } of this.audioElements.values()) {
      element.pause();
      element.src = '';
      element.load(); // Force unload
    }

    this.audioElements.clear();
    
    // Clear video element reference and ensure it's cleaned
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.removeAttribute('src');
      this.videoElement.load(); // Force unload
      this.videoElement = null;
    }
    
    // Reset internal state
    this.isPlaying = false;
  }

  /**
   * Start continuous sync loop to handle audio drift
   */
  private startSyncLoop(): void {
    if (this.syncInterval !== null) return;

    this.syncInterval = window.setInterval(() => {
      if (!this.isPlaying) return;

      // Minor drift correction for audio sync
      // This helps prevent gradual audio desync during playback
      if (this.videoElement && !this.videoElement.paused) {
        const videoTime = this.videoElement.currentTime;

        // Check audio elements aren't drifting too much
        for (const { element } of this.audioElements.values()) {
          if (!element.paused) {
            const drift = Math.abs(element.currentTime - videoTime);
            if (drift > 0.1) {
              // Audio is drifting, resync
              element.currentTime = videoTime;
            }
          }
        }
      }
    }, 100); // Check every 100ms
  }

  /**
   * Stop the sync loop
   */
  private stopSyncLoop(): void {
    if (this.syncInterval !== null) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Get all active audio elements (for debugging)
   */
  getActiveAudioElements(): HTMLAudioElement[] {
    return Array.from(this.audioElements.values()).map(({ element }) => element);
  }
}

// Create singleton instance
export const audioManager = new AudioManager();
