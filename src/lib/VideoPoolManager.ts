import type { Asset } from '@/types';

/**
 * VideoPoolManager manages a pool of pre-loaded video elements
 * Videos are loaded once and kept in memory for instant playback
 */
export class VideoPoolManager {
  private videos: Map<string, HTMLVideoElement> = new Map();
  private loadingPromises: Map<string, Promise<void>> = new Map();
  private playPromises: Map<string, Promise<void>> = new Map();

  /**
   * Load a video asset into the pool
   * Videos are kept hidden and ready for playback
   */
  async loadVideo(asset: Asset): Promise<void> {
    // Return existing promise if already loading
    if (this.loadingPromises.has(asset.id)) {
      return this.loadingPromises.get(asset.id);
    }

    // Return immediately if already loaded
    if (this.videos.has(asset.id)) {
      return Promise.resolve();
    }

    const loadPromise = new Promise<void>((resolve, reject) => {
      const video = document.createElement('video');
      
      // Configure video element for pool
      video.src = asset.url;
      video.preload = 'auto';
      video.playsInline = true;
      video.muted = false; // Will be controlled by AudioManager
      
      // Hide the video element (we'll draw to canvas)
      video.style.display = 'none';
      
      // Add to DOM to enable loading (required for some browsers)
      document.body.appendChild(video);

      const handleLoad = () => {
        console.log(`✅ Video metadata loaded: ${asset.name} (${asset.id})`);
        // Set currentTime to 0 to trigger data loading
        video.currentTime = 0;
        
        // Store video immediately so it can be used
        this.videos.set(asset.id, video);
        this.loadingPromises.delete(asset.id);
        cleanup();
        resolve();
      };

      const handleError = (e: Event) => {
        console.error(`❌ Video load error: ${asset.name}`, e);
        this.loadingPromises.delete(asset.id);
        cleanup();
        reject(new Error(`Failed to load video: ${asset.name}`));
      };

      const cleanup = () => {
        video.removeEventListener('loadedmetadata', handleLoad);
        video.removeEventListener('error', handleError);
      };

      video.addEventListener('loadedmetadata', handleLoad);
      video.addEventListener('error', handleError);

      // Start loading
      video.load();
    });

    this.loadingPromises.set(asset.id, loadPromise);
    return loadPromise;
  }

  /**
   * Get a video element from the pool
   */
  getVideo(assetId: string): HTMLVideoElement | null {
    return this.videos.get(assetId) || null;
  }

  /**
   * Check if a video is loaded
   */
  isLoaded(assetId: string): boolean {
    return this.videos.has(assetId);
  }

  /**
   * Check if a video is currently loading
   */
  isLoading(assetId: string): boolean {
    return this.loadingPromises.has(assetId);
  }

  /**
   * Synchronize a video to a specific time and play state
   * This handles seeking and play/pause for a specific video
   */
  syncVideo(assetId: string, timeSeconds: number, shouldPlay: boolean): void {
    const video = this.videos.get(assetId);
    if (!video) return;

    // Ensure video is ready
    if (video.readyState < 1) return; // Need at least HAVE_METADATA

    // Update time if significantly different (avoid constant micro-adjustments)
    const timeDiff = Math.abs(video.currentTime - timeSeconds);
    if (timeDiff > 0.1) {
      video.currentTime = timeSeconds;
    }

    // Handle play/pause state
    if (shouldPlay && video.paused) {
      // Only play if we have enough data
      if (video.readyState >= 2) { // HAVE_CURRENT_DATA
        const existingPromise = this.playPromises.get(assetId);
        if (existingPromise) {
          // Wait for existing promise to complete
          existingPromise.catch(() => {}).then(() => {
            if (video.paused && shouldPlay) {
              const playPromise = video.play();
              this.playPromises.set(assetId, playPromise);
              playPromise.catch(err => {
                if (err.name !== 'AbortError') {
                  console.error(`Play error for ${assetId}:`, err);
                }
              }).finally(() => {
                this.playPromises.delete(assetId);
              });
            }
          });
        } else {
          const playPromise = video.play();
          this.playPromises.set(assetId, playPromise);
          playPromise.catch(err => {
            if (err.name !== 'AbortError') {
              console.error(`Play error for ${assetId}:`, err);
            }
          }).finally(() => {
            this.playPromises.delete(assetId);
          });
        }
      }
    } else if (!shouldPlay && !video.paused) {
      // Pause the video
      const existingPromise = this.playPromises.get(assetId);
      if (existingPromise) {
        existingPromise.catch(() => {}).then(() => {
          if (!video.paused) {
            video.pause();
          }
        }).finally(() => {
          this.playPromises.delete(assetId);
        });
      } else {
        video.pause();
      }
    }
  }

  /**
   * Pause all videos in the pool
   */
  pauseAll(): void {
    this.videos.forEach(video => {
      if (!video.paused) {
        video.pause();
      }
    });
    this.playPromises.clear();
  }

  /**
   * Pause all videos except the specified ones
   */
  pauseAllExcept(assetIds: Set<string>): void {
    this.videos.forEach((video, assetId) => {
      if (!assetIds.has(assetId) && !video.paused) {
        video.pause();
        this.playPromises.delete(assetId);
      }
    });
  }

  /**
   * Remove a video from the pool
   */
  unloadVideo(assetId: string): void {
    const video = this.videos.get(assetId);
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load(); // Clear the buffer
      if (video.parentElement) {
        video.parentElement.removeChild(video);
      }
      this.videos.delete(assetId);
    }
    this.loadingPromises.delete(assetId);
    this.playPromises.delete(assetId);
  }

  /**
   * Clean up all videos in the pool
   */
  cleanup(): void {
    this.videos.forEach((_video, assetId) => {
      this.unloadVideo(assetId);
    });
    this.videos.clear();
    this.loadingPromises.clear();
    this.playPromises.clear();
  }

  /**
   * Get count of loaded videos
   */
  getLoadedCount(): number {
    return this.videos.size;
  }
}

// Singleton instance
export const videoPoolManager = new VideoPoolManager();

