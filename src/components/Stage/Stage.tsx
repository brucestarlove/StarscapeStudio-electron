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
  const cleanupRef = useRef(false); // Track if component is unmounting
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

  // Load video source when asset changes, or clear it when no asset
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // If no visible asset, clear the video source completely
    if (!visibleAsset) {
      if (loadedAssetIdRef.current !== null) {
        console.log('Clearing video source (no visible asset)');
        video.pause();
        video.removeAttribute('src');
        video.load(); // This clears the video element
        loadedAssetIdRef.current = null;
      }
      return;
    }

    // Only update source if the asset actually changed
    if (loadedAssetIdRef.current !== visibleAsset.id) {
      console.log('Loading new video source:', visibleAsset.url);
      video.src = visibleAsset.url;
      video.load();
      loadedAssetIdRef.current = visibleAsset.id;
    }
  }, [visibleAsset]);

  // Sync video playback with store - play when there's a visible clip, pause when in empty space
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // If we have a visible asset and timeline is playing, play the video
    if (visibleAsset && playing && video.paused) {
      console.log('Starting video playback');
      video.play().catch(err => {
        console.error('Play error:', err);
      });
    } 
    // If no visible asset or timeline is paused, pause the video
    else if ((!visibleAsset || !playing) && !video.paused) {
      console.log('Pausing video (no visible clip or timeline paused)');
      video.pause();
    }
  }, [visibleAsset, playing]);

  // Synchronize video element time with timeline when there's a visible clip
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !visibleClip) return;

    const targetTime = sourceTimeMs / 1000; // Convert to seconds
    const timeDiff = Math.abs(video.currentTime - targetTime);
    
    // Sync video time if it's drifted from expected position
    // Use 100ms threshold to allow for some natural drift during playback
    if (timeDiff > 0.1) {
      console.log('Syncing video time to:', targetTime);
      video.currentTime = targetTime;
    }
  }, [sourceTimeMs, visibleClip, currentTimeMs]);

  // Master playback loop - independent of clips, drives timeline forward
  // This is the professional-grade approach: playback continues regardless of clips
  useEffect(() => {
    if (!playing) return;

    let animationFrameId: number;
    let lastFrameTime = performance.now();

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
        // Stop at timeline end
        seek(timelineDuration);
        pause();
        return; // Stop the animation loop
      }

      // Update timeline position
      seek(newTimeMs);
      
      // Continue the loop
      animationFrameId = requestAnimationFrame(updatePlaybackPosition);
    };

    // Start the loop
    animationFrameId = requestAnimationFrame(updatePlaybackPosition);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [playing, getTimelineDuration]);

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