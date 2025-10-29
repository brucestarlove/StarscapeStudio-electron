import { Play, Music } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { usePlaybackStore } from "@/store/playbackStore";
import { useEffect, useRef } from "react";
import { audioManager } from "@/lib/AudioManager";
import type { Clip } from "@/types";

export function Stage() {
  const { canvasNodes, clips, getAssetById, tracks, getTimelineDuration } = useProjectStore();
  const { currentTimeMs, playing, seek, pause } = usePlaybackStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const isSeekingRef = useRef(false); // Track if we're programmatically seeking
  const loadedAssetIdRef = useRef<string | null>(null); // Track which asset is loaded
  const loadedClipIdRef = useRef<string | null>(null); // Track which clip is loaded
  const cleanupRef = useRef(false); // Track if component is unmounting
  const playPromiseRef = useRef<Promise<void> | null>(null); // Track pending play promise
  const timelineDuration = getTimelineDuration(); // Get timeline endpoint

  // Find the visible clip at current time
  const visibleClip = getVisibleClip(clips, tracks, currentTimeMs);
  const visibleAsset = visibleClip ? getAssetById(visibleClip.assetId) : null;

  // Get all active audio clips for synchronization
  const audioClips = getAudioClips(clips, tracks, currentTimeMs);

  // Calculate source video time accounting for trim
  const sourceTimeMs = visibleClip 
    ? (currentTimeMs - visibleClip.startMs) + visibleClip.trimStartMs
    : 0;

  // Initialize audio manager with video element on mount
  useEffect(() => {
    if (videoRef.current) {
      audioManager.setVideoElement(videoRef.current);
    }

    return () => {
      cleanupRef.current = true;
      // Don't fully clear on unmount as we might re-mount, just clear video reference
      audioManager.setVideoElement(null);
    };
  }, []);

  // Load video source when asset or clip changes, or clear it when no asset
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // If no visible asset, clear the video source completely
    if (!visibleAsset || !visibleClip) {
      if (loadedAssetIdRef.current !== null) {
        console.log('Clearing video source (no visible asset/clip)');
        
        // Wait for any pending play promise to resolve before clearing
        if (playPromiseRef.current) {
          playPromiseRef.current.then(() => {
            video.pause();
            video.removeAttribute('src');
            video.load();
          }).catch(() => {
            video.pause();
            video.removeAttribute('src');
            video.load();
          });
        } else {
          video.pause();
          video.removeAttribute('src');
          video.load();
        }
        
        loadedAssetIdRef.current = null;
        loadedClipIdRef.current = null;
        playPromiseRef.current = null;
      }
      return;
    }

    // Check if we need to reload the video (asset changed OR different clip of same asset)
    const needsReload = loadedAssetIdRef.current !== visibleAsset.id || 
                       loadedClipIdRef.current !== visibleClip.id;
    
    if (needsReload) {
      console.log(`Loading video: asset=${visibleAsset.name}, clip=${visibleClip.id}`);
      
      // Wait for any pending play promise before changing source
      const loadNewSource = () => {
        video.src = visibleAsset.url;
        video.load();
        loadedAssetIdRef.current = visibleAsset.id;
        loadedClipIdRef.current = visibleClip.id;
        playPromiseRef.current = null;
      };
      
      if (playPromiseRef.current) {
        playPromiseRef.current
          .then(loadNewSource)
          .catch(loadNewSource);
      } else {
        loadNewSource();
      }
    }
  }, [visibleAsset, visibleClip]);

  // Sync video playback with store - play when there's a visible clip, pause when in empty space
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // If we have a visible asset and timeline is playing, play the video
    if (visibleAsset && visibleClip && playing && video.paused) {
      console.log(`▶️  Starting video playback for clip ${visibleClip.id}`);
      
      // Wait for any existing play promise to finish
      if (playPromiseRef.current) {
        playPromiseRef.current.catch(() => {}).then(() => {
          if (video && video.paused && playing) {
            playPromiseRef.current = video.play().catch(err => {
              console.error('Play error:', err);
              playPromiseRef.current = null;
            });
          }
        });
      } else {
        playPromiseRef.current = video.play().catch(err => {
          console.error('Play error:', err);
          playPromiseRef.current = null;
        });
      }
    } 
    // If no visible asset or timeline is paused, pause the video
    else if ((!visibleAsset || !visibleClip || !playing) && !video.paused) {
      console.log('⏸️  Pausing video (no visible clip or timeline paused)');
      
      // Wait for play promise to resolve before pausing
      if (playPromiseRef.current) {
        playPromiseRef.current.then(() => {
          if (video && !video.paused) {
            video.pause();
          }
        }).catch(() => {
          if (video && !video.paused) {
            video.pause();
          }
        }).finally(() => {
          playPromiseRef.current = null;
        });
      } else {
        video.pause();
      }
    }
  }, [visibleAsset, visibleClip, playing]);

  // Synchronize video element time with timeline when there's a visible clip
  // Only sync on significant changes (seeking, clip changes) not during normal playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !visibleClip || !playing) return;

    const targetTime = sourceTimeMs / 1000; // Convert to seconds
    const timeDiff = Math.abs(video.currentTime - targetTime);
    
    // Only sync if significantly out of sync (>200ms)
    // This prevents constant micro-adjustments during playback
    if (timeDiff > 0.2) {
      console.log(`🔄 Syncing video time: ${video.currentTime.toFixed(2)}s → ${targetTime.toFixed(2)}s (drift: ${(timeDiff * 1000).toFixed(0)}ms)`);
      video.currentTime = targetTime;
    }
  }, [visibleClip?.id, playing]); // Only sync when clip changes or playback state changes

  // Master playback loop - independent of clips, drives timeline forward
  // This is the professional-grade approach: playback continues regardless of clips
  useEffect(() => {
    if (!playing) return;

    let animationFrameId: number;
    let lastFrameTime = performance.now();
    let lastLogTime = performance.now();
    let lastLoggedClipId: string | null = null;

    const updatePlaybackPosition = (currentFrameTime: number) => {
      // Calculate elapsed time since last frame
      const deltaTime = currentFrameTime - lastFrameTime;
      lastFrameTime = currentFrameTime;

      // Get current state
      const { currentTimeMs, seek, pause } = usePlaybackStore.getState();
      const timelineDuration = getTimelineDuration();

      // Advance timeline by delta time (in milliseconds)
      const newTimeMs = currentTimeMs + deltaTime;

      // Check if we've reached the end of the timeline
      if (newTimeMs >= timelineDuration) {
        console.log('⏹️  Reached timeline end');
        // Stop at timeline end
        seek(timelineDuration);
        pause();
        return; // Stop the animation loop
      }

      // Update timeline position
      seek(newTimeMs);
      
      // Debug logging every 500ms or when clip changes
      const currentClip = getVisibleClip(clips, tracks, newTimeMs);
      const clipId = currentClip?.id || 'empty';
      
      if (currentFrameTime - lastLogTime > 500 || clipId !== lastLoggedClipId) {
        const timeFormatted = (newTimeMs / 1000).toFixed(2);
        if (currentClip) {
          console.log(`⏱️  Playing: ${timeFormatted}s | Clip: ${clipId} (${currentClip.startMs}-${currentClip.endMs}ms)`);
        } else {
          console.log(`⏱️  Playing: ${timeFormatted}s | Empty space`);
        }
        lastLogTime = currentFrameTime;
        lastLoggedClipId = clipId;
      }
      
      // Continue the loop
      animationFrameId = requestAnimationFrame(updatePlaybackPosition);
    };

    console.log('▶️  Starting master playback loop');
    // Start the loop
    animationFrameId = requestAnimationFrame(updatePlaybackPosition);

    return () => {
      console.log('⏹️  Stopping master playback loop');
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [playing, getTimelineDuration, clips, tracks]);

  // Synchronize all audio sources with timeline position
  useEffect(() => {
    if (!playing) return;

    // Sync all audio elements to current timeline position
    const audioClipsWithAssets = audioClips.map(clip => ({
      clip: clip,
      asset: getAssetById(clip.assetId)!,
      track: tracks.find(t => t.id === clip.trackId)!,
    }));

    audioManager.syncToTime(currentTimeMs, audioClipsWithAssets);
  }, [currentTimeMs, audioClips, playing, getAssetById, tracks]);

  // Handle play/pause state for audio manager
  useEffect(() => {
    if (playing) {
      audioManager.play();
    } else {
      audioManager.pause();
    }
  }, [playing]);

  return (
    <div className="h-full bg-dark-navy p-md">
      <div className="h-full flex flex-col">
        {/* Compact header */}
        <div className="flex items-center justify-between px-lg py-sm border-b border-white/10">
          <h2 className="text-body font-medium text-white/70">Preview</h2>
          <div className="text-caption text-white/40 font-mono">
            {formatTimecode(currentTimeMs)}
          </div>
        </div>

        {/* Canvas area - fills remaining space */}
        <div className="flex-1 relative bg-black/20 overflow-hidden">
          {/* 16:9 aspect ratio container - maximized to fit available space */}
          <div className="absolute inset-0 flex items-center justify-center p-md">
            <div className="relative w-full h-full max-h-full flex items-center justify-center">
              {/* Actual video container maintains aspect ratio */}
              <div className="relative aspect-video bg-black w-full h-full max-w-full max-h-full object-contain">
                {/* Video playback */}
                {visibleAsset && visibleAsset.type === 'video' ? (
                  <video
                    ref={videoRef}
                    className="w-full h-full object-contain"
                    playsInline
                    onError={(e) => {
                      console.error('Video playback error:', e);
                    }}
                  />
                ) : visibleAsset && visibleAsset.type === 'image' ? (
                  /* Image display */
                  <img
                    src={visibleAsset.url}
                    alt={visibleAsset.name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      console.error('Image load error:', e);
                    }}
                  />
                ) : (
                  /* Canvas nodes for other assets */
                  Object.values(canvasNodes).map((node) => {
                    const clip = clips[node.clipId];
                    const asset = clip ? getAssetById(clip.assetId) : null;
                    
                    if (!asset) return null;

                    return (
                      <div
                        key={node.id}
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                          transform: `translate(${node.x}px, ${node.y}px) scale(${node.width / 200}, ${node.height / 150})`,
                          opacity: node.opacity,
                        }}
                      >
                        {asset.type === 'audio' ? (
                          <div className="w-48 h-36 bg-gradient-purple-blue rounded-md flex items-center justify-center">
                            <Music className="h-12 w-12 text-white/70" />
                            <div className="text-white text-caption ml-2">Audio</div>
                          </div>
                        ) : asset.type === 'image' ? (
                          <img
                            src={asset.url}
                            alt={asset.name}
                            className="w-full h-full object-contain rounded-md"
                          />
                        ) : null}
                      </div>
                    );
                  })
                )}

                {/* Empty state */}
                {!visibleAsset && Object.keys(canvasNodes).length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <Play className="h-16 w-16 text-white/30 mb-md" />
                    <p className="text-body text-white/50">
                      No clips on canvas yet.<br />
                      Double-click assets in the library to add them.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to find visible clip at current time
function getVisibleClip(clips: Record<string, Clip>, tracks: any[], currentTimeMs: number): Clip | null {
  for (const track of tracks.filter(t => t.type === 'video' && t.visible)) {
    const clip = track.clips
      .map((id: string) => clips[id])
      .find((c: Clip) => c && currentTimeMs >= c.startMs && currentTimeMs < c.endMs);
    if (clip) return clip;
  }
  return null;
}

// Helper function to get all audio clips that should be playing at current time
function getAudioClips(clips: Record<string, Clip>, tracks: any[], currentTimeMs: number): Clip[] {
  const audioClips: Clip[] = [];
  
  for (const track of tracks.filter(t => t.type === 'audio' && t.visible)) {
    for (const clipId of track.clips) {
      const clip = clips[clipId];
      // Include clip if current time falls within it
      if (clip && currentTimeMs >= clip.startMs && currentTimeMs < clip.endMs) {
        audioClips.push(clip);
      }
    }
  }
  
  return audioClips;
}

// Helper function to format timecode
function formatTimecode(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
}