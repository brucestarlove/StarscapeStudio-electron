import type { Asset, Clip, Track, CanvasNode } from '@/types';
import { videoPoolManager } from './VideoPoolManager';

/**
 * Metadata for a clip being rendered
 */
export interface ClipRenderData {
  clip: Clip;
  asset: Asset;
  track: Track;
  trackIndex: number;
  canvasNode?: CanvasNode;
}

/**
 * CanvasCompositor handles rendering video/image clips to a canvas element
 * It maintains an animation loop and composites multiple media sources
 */
export class CanvasCompositor {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;
  
  // Current state
  private currentClips: ClipRenderData[] = [];
  private currentTimeMs: number = 0;
  private isPlaying: boolean = false;

  // Image cache - keep loaded images in memory
  private imageCache: Map<string, HTMLImageElement> = new Map();

  /**
   * Initialize the compositor with a canvas element
   */
  setCanvas(canvas: HTMLCanvasElement | null): void {
    if (this.canvas === canvas) return;
    
    // Stop any existing animation
    this.stop();
    
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d', { alpha: false }) : null;
    
    if (this.ctx) {
      // Set canvas properties for better quality
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
    }
  }

  /**
   * Update the list of clips to render
   */
  setClips(clips: ClipRenderData[]): void {
    const clipsChanged = clips.length !== this.currentClips.length ||
      clips.some((c, i) => c.clip.id !== this.currentClips[i]?.clip.id);
    
    this.currentClips = clips;
    
    // Sync videos when clips change
    if (clipsChanged) {
      this.syncVideos();
    }
    
    // If not playing, render a single frame
    if (!this.isPlaying && this.canvas && this.ctx) {
      this.renderFrame();
    }
  }

  /**
   * Update the current timeline position
   */
  setCurrentTime(timeMs: number): void {
    const oldTime = this.currentTimeMs;
    this.currentTimeMs = timeMs;
    
    // Only sync videos when seeking (not playing) or when clips change
    if (!this.isPlaying || Math.abs(timeMs - oldTime) > 100) {
      this.syncVideos();
    }
    
    // If not playing, render a single frame
    if (!this.isPlaying && this.canvas && this.ctx) {
      this.renderFrame();
    }
  }

  /**
   * Set playing state
   */
  setPlaying(playing: boolean): void {
    const wasPlaying = this.isPlaying;
    this.isPlaying = playing;
    
    if (playing && !wasPlaying) {
      // Start playing
      this.syncVideos(); // Sync before starting
      this.start();
    } else if (!playing && wasPlaying) {
      // Pause all videos
      videoPoolManager.pauseAll();
      this.stop();
      // Render final frame
      if (this.canvas && this.ctx) {
        this.renderFrame();
      }
    }
  }

  /**
   * Start the animation loop
   */
  start(): void {
    if (this.isRunning || !this.canvas || !this.ctx) return;
    
    this.isRunning = true;
    this.animate();
  }

  /**
   * Stop the animation loop
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Animation loop
   */
  private animate = (): void => {
    if (!this.isRunning) return;
    
    this.renderFrame();
    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  /**
   * Render a single frame to the canvas
   */
  private renderFrame(): void {
    if (!this.canvas || !this.ctx) return;
    
    const { width, height } = this.canvas;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, width, height);
    
    // Render each clip (already sorted by layer order)
    for (const clipData of this.currentClips) {
      this.renderClip(clipData);
    }
  }

  /**
   * Render a single clip to the canvas
   */
  private renderClip(clipData: ClipRenderData): void {
    if (!this.ctx || !this.canvas) return;
    
    const { clip, asset, trackIndex, canvasNode } = clipData;
    
    // Track 1 (Main Track): Render full-screen without transforms
    if (trackIndex === 0) {
      if (asset.type === 'video') {
        this.renderVideo(clip, asset);
      } else if (asset.type === 'image') {
        this.renderImage(clip, asset);
      }
      return;
    }
    
    // Track 2+ (PiP Tracks): Apply transforms if canvasNode exists
    if (canvasNode) {
      this.ctx.save();
      
      // Set opacity
      this.ctx.globalAlpha = canvasNode.opacity;
      
      // Apply transforms: Translate → Rotate → Scale
      // Translate to position
      this.ctx.translate(canvasNode.x + canvasNode.width / 2, canvasNode.y + canvasNode.height / 2);
      
      // Rotate (convert degrees to radians)
      this.ctx.rotate((canvasNode.rotation * Math.PI) / 180);
      
      // Scale based on canvasNode dimensions vs original asset dimensions
      const originalWidth = asset.metadata.width || this.canvas.width;
      const originalHeight = asset.metadata.height || this.canvas.height;
      const scaleX = canvasNode.width / originalWidth;
      const scaleY = canvasNode.height / originalHeight;
      this.ctx.scale(scaleX, scaleY);
      
      // Render clip centered at origin (since we translated to center)
      if (asset.type === 'video') {
        this.renderVideoTransformed(clip, asset, -originalWidth / 2, -originalHeight / 2);
      } else if (asset.type === 'image') {
        this.renderImageTransformed(clip, asset, -originalWidth / 2, -originalHeight / 2);
      }
      
      this.ctx.restore();
    } else {
      // Fallback: render without transforms if canvasNode missing
      if (asset.type === 'video') {
        this.renderVideo(clip, asset);
      } else if (asset.type === 'image') {
        this.renderImage(clip, asset);
      }
    }
  }

  /**
   * Render a video clip (full-screen for main track)
   */
  private renderVideo(_clip: Clip, asset: Asset): void {
    if (!this.ctx || !this.canvas) return;
    
    const video = videoPoolManager.getVideo(asset.id);
    if (!video) {
      return; // Video not loaded yet
    }
    
    // For drawing, we can accept readyState >= 1 (HAVE_METADATA)
    // The browser will show the poster frame or first frame
    if (video.readyState < 1) {
      return; // Not ready yet
    }
    
    // Draw video frame to canvas (full-screen)
    try {
      // If video has dimensions, draw it
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        this.ctx.drawImage(
          video,
          0, 0, video.videoWidth, video.videoHeight, // Source rectangle
          0, 0, this.canvas.width, this.canvas.height // Destination rectangle
        );
      }
    } catch (error) {
      // Silently ignore - video might not be ready yet
    }
  }

  /**
   * Render a video clip with transforms (for PiP tracks)
   */
  private renderVideoTransformed(_clip: Clip, asset: Asset, x: number, y: number): void {
    if (!this.ctx || !this.canvas) return;
    
    const video = videoPoolManager.getVideo(asset.id);
    if (!video) {
      return; // Video not loaded yet
    }
    
    if (video.readyState < 1) {
      return; // Not ready yet
    }
    
    try {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        const width = asset.metadata.width || video.videoWidth;
        const height = asset.metadata.height || video.videoHeight;
        this.ctx.drawImage(
          video,
          0, 0, video.videoWidth, video.videoHeight, // Source rectangle
          x, y, width, height // Destination rectangle
        );
      }
    } catch (error) {
      // Silently ignore - video might not be ready yet
    }
  }

  /**
   * Render an image clip (full-screen for main track)
   */
  private renderImage(_clip: Clip, asset: Asset): void {
    if (!this.ctx || !this.canvas) return;
    
    // Get or create cached image
    let img = this.imageCache.get(asset.id);
    
    if (!img) {
      // Create new image and cache it
      img = new Image();
      img.src = asset.url;
      this.imageCache.set(asset.id, img);
      
      // Once loaded, trigger a re-render if not playing
      img.onload = () => {
        if (!this.isPlaying && this.canvas && this.ctx) {
          this.renderFrame();
        }
      };
      
      img.onerror = (e) => {
        console.error(`Failed to load image ${asset.name}:`, e);
      };
    }
    
    // Only draw if image is fully loaded
    if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      try {
        // Calculate aspect ratio preserving dimensions
        const imageAspect = img.naturalWidth / img.naturalHeight;
        const canvasAspect = this.canvas.width / this.canvas.height;
        
        let drawWidth: number;
        let drawHeight: number;
        let drawX: number;
        let drawY: number;
        
        if (imageAspect > canvasAspect) {
          // Image is wider than canvas - fit to width
          drawWidth = this.canvas.width;
          drawHeight = this.canvas.width / imageAspect;
          drawX = 0;
          drawY = (this.canvas.height - drawHeight) / 2;
        } else {
          // Image is taller than canvas - fit to height
          drawHeight = this.canvas.height;
          drawWidth = this.canvas.height * imageAspect;
          drawX = (this.canvas.width - drawWidth) / 2;
          drawY = 0;
        }
        
        // Draw image maintaining aspect ratio and centered
        this.ctx.drawImage(
          img,
          0, 0, img.naturalWidth, img.naturalHeight, // Source rectangle
          drawX, drawY, drawWidth, drawHeight // Destination rectangle (centered, aspect-preserved)
        );
      } catch (error) {
        console.error(`Error drawing image for ${asset.id}:`, error);
      }
    }
  }

  /**
   * Render an image clip with transforms (for PiP tracks)
   */
  private renderImageTransformed(_clip: Clip, asset: Asset, x: number, y: number): void {
    if (!this.ctx || !this.canvas) return;
    
    // Get or create cached image
    let img = this.imageCache.get(asset.id);
    
    if (!img) {
      img = new Image();
      img.src = asset.url;
      this.imageCache.set(asset.id, img);
      
      img.onload = () => {
        if (!this.isPlaying && this.canvas && this.ctx) {
          this.renderFrame();
        }
      };
      
      img.onerror = (e) => {
        console.error(`Failed to load image ${asset.name}:`, e);
      };
    }
    
    if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      try {
        const width = asset.metadata.width || img.naturalWidth;
        const height = asset.metadata.height || img.naturalHeight;
        this.ctx.drawImage(
          img,
          0, 0, img.naturalWidth, img.naturalHeight, // Source rectangle
          x, y, width, height // Destination rectangle
        );
      } catch (error) {
        console.error(`Error drawing image for ${asset.id}:`, error);
      }
    }
  }

  /**
   * Sync all video elements to the current timeline position
   */
  private syncVideos(): void {
    // Track which assets are currently visible
    const visibleAssetIds = new Set<string>();
    
    // Sync visible videos
    for (const clipData of this.currentClips) {
      const { clip, asset } = clipData;
      
      if (asset.type === 'video') {
        visibleAssetIds.add(asset.id);
        
        // Calculate the source time within the video file
        const sourceTimeMs = (this.currentTimeMs - clip.startMs) + clip.trimStartMs;
        const sourceTimeSeconds = Math.max(0, sourceTimeMs / 1000);
        
        // Get the video and update its time
        const video = videoPoolManager.getVideo(asset.id);
        if (video) {
          if (video.readyState >= 1) {
            // Update time if significantly different
            const timeDiff = Math.abs(video.currentTime - sourceTimeSeconds);
            if (timeDiff > 0.1) {
              video.currentTime = sourceTimeSeconds;
            }
            
            // Handle play/pause based on current state
            // Try to play even at readyState 1 - browser will buffer as needed
            if (this.isPlaying && video.paused) {
              video.play().catch(err => {
                if (err.name !== 'AbortError') {
                  console.error(`Play error for ${asset.id}:`, err);
                }
              });
            } else if (!this.isPlaying && !video.paused) {
              video.pause();
            }
          }
        }
      }
    }
    
    // Pause videos that are not currently visible
    // This prevents audio from playing in background
    videoPoolManager.pauseAllExcept(visibleAssetIds);
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stop();
    this.canvas = null;
    this.ctx = null;
    this.currentClips = [];
    this.imageCache.clear();
  }
}

