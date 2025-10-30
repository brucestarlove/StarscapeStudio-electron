import { Play } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { usePlaybackStore } from "@/store/playbackStore";
import { useEffect, useRef, useState } from "react";
import { audioManager } from "@/lib/AudioManager";
import { videoPoolManager } from "@/lib/VideoPoolManager";
import { CanvasCompositor } from "@/lib/CanvasCompositor";
import { TransformControls } from "./TransformControls";
import type { Clip, Asset, Track } from "@/types";

export function Stage() {
  const { clips, getAssetById, tracks, assets, getTimelineDuration, getCanvasNodeByClipId, selectedClipIds, updateCanvasNode } = useProjectStore();
  const { currentTimeMs, playing } = usePlaybackStore();

  // Canvas and compositor refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compositorRef = useRef<CanvasCompositor | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  
  // Track canvas display dimensions
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ width: 1920, height: 1080 });

  // Get ALL visible clips at current time (video, audio, image)
  const visibleClips = getAllVisibleClips(clips, tracks, getAssetById, currentTimeMs, getCanvasNodeByClipId);
  
  // Separate clips by type for rendering
  const videoAndImageClips = visibleClips.filter(
    ({ asset }) => asset.type === 'video' || asset.type === 'image'
  );
  
  // Get all active audio clips for synchronization (using existing function)
  const audioClips = getAudioClips(clips, tracks, currentTimeMs);

  // Initialize compositor on mount
  useEffect(() => {
    if (!compositorRef.current) {
      compositorRef.current = new CanvasCompositor();
    }

    return () => {
      compositorRef.current?.cleanup();
      compositorRef.current = null;
    };
  }, []);

  // Set canvas reference when it's available
  useEffect(() => {
    if (canvasRef.current && compositorRef.current) {
      compositorRef.current.setCanvas(canvasRef.current);
    }
  }, [canvasRef.current]);

  // Load video assets into the pool when they're added to the project
  // Note: Images are handled separately by CanvasCompositor's image cache
  useEffect(() => {
    const videoAssets = assets.filter(asset => asset.type === 'video');
    
    videoAssets.forEach(asset => {
      if (!videoPoolManager.isLoaded(asset.id) && !videoPoolManager.isLoading(asset.id)) {
        videoPoolManager.loadVideo(asset).catch(err => {
          console.error(`Failed to load video ${asset.name}:`, err);
        });
      }
    });
  }, [assets]);

  // Update compositor with visible clips
  useEffect(() => {
    if (compositorRef.current) {
      compositorRef.current.setClips(videoAndImageClips);
    }
  }, [videoAndImageClips]);

  // Update compositor timeline position
  useEffect(() => {
    if (compositorRef.current) {
      compositorRef.current.setCurrentTime(currentTimeMs);
    }
  }, [currentTimeMs]);

  // Update compositor playing state
  useEffect(() => {
    if (compositorRef.current) {
      compositorRef.current.setPlaying(playing);
    }
  }, [playing]);

  // Initialize audio manager with first video element from pool
  useEffect(() => {
    const videoAssets = assets.filter(a => a.type === 'video');
    if (videoAssets.length > 0) {
      const firstVideo = videoPoolManager.getVideo(videoAssets[0].id);
      if (firstVideo) {
        audioManager.setVideoElement(firstVideo);
      }
    }

    return () => {
      audioManager.setVideoElement(null);
    };
  }, [assets]);

  // Master playback loop - independent of clips, drives timeline forward
  useEffect(() => {
    if (!playing) return;

    let animationFrameId: number;
    let lastFrameTime = performance.now();
    let lastLogTime = performance.now();

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
        seek(timelineDuration);
        pause();
        return;
      }

      // Update timeline position
      seek(newTimeMs);
      
      // Debug logging every 500ms
      if (currentFrameTime - lastLogTime > 500) {
        const timeFormatted = (newTimeMs / 1000).toFixed(2);
        const activeClips = getAllVisibleClips(clips, tracks, getAssetById, newTimeMs, getCanvasNodeByClipId);
        console.log(`⏱️  Playing: ${timeFormatted}s | Active clips: ${activeClips.length}`);
        lastLogTime = currentFrameTime;
      }
      
      // Continue the loop
      animationFrameId = requestAnimationFrame(updatePlaybackPosition);
    };

    console.log('▶️  Starting master playback loop');
    animationFrameId = requestAnimationFrame(updatePlaybackPosition);

    return () => {
      console.log('⏹️  Stopping master playback loop');
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [playing, getTimelineDuration, clips, tracks, getAssetById, getCanvasNodeByClipId]);

  // Synchronize all audio sources with timeline position
  useEffect(() => {
    if (!playing) return;

    const audioClipsWithAssets = audioClips.map(clip => ({
      clip: clip,
      asset: getAssetById(clip.assetId)!,
      track: tracks.find(t => t.id === clip.trackId)!,
    }));

    audioManager.syncToTime(currentTimeMs, audioClipsWithAssets);
  }, [currentTimeMs, audioClips, playing, getAssetById, tracks]);

  // Track canvas display dimensions for transform controls
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasDisplaySize({ width, height });
      }
    });

    resizeObserver.observe(canvasContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Get selected clip info for transform controls
  const selectedClipId = selectedClipIds.length === 1 ? selectedClipIds[0] : null;
  const selectedClip = selectedClipId ? clips[selectedClipId] : null;
  const selectedCanvasNode = selectedClipId ? getCanvasNodeByClipId(selectedClipId) : null;
  const selectedTrackIndex = selectedClip
    ? tracks.findIndex(t => t.id === selectedClip.trackId)
    : -1;

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
          {/* 16:9 aspect ratio container */}
          <div className="absolute inset-0 flex items-center justify-center p-md">
            <div className="relative w-full h-full max-h-full flex items-center justify-center">
              {/* Canvas for video/image compositing */}
              <div ref={canvasContainerRef} className="relative aspect-video bg-black w-full h-full max-w-full max-h-full">
                <canvas
                  ref={canvasRef}
                  width={1920}
                  height={1080}
                  className="w-full h-full object-contain"
                />

                {/* Transform Controls Overlay */}
                {/* Only render for Track 2+ clips (not main track) */}
                {selectedClipId && selectedCanvasNode && selectedClip && selectedTrackIndex > 0 && (
                  <TransformControls
                    selectedClipId={selectedClipId}
                    canvasNode={selectedCanvasNode}
                    onUpdate={(updates) => {
                      // Find canvasNode by clipId and update
                      const nodeId = Object.keys(useProjectStore.getState().canvasNodes).find(
                        nodeId => useProjectStore.getState().canvasNodes[nodeId].clipId === selectedClipId
                      );
                      if (nodeId) {
                        updateCanvasNode(nodeId, updates);
                      }
                    }}
                    canvasDisplayWidth={canvasDisplaySize.width}
                    canvasDisplayHeight={canvasDisplaySize.height}
                    canvasLogicalWidth={1920}
                    canvasLogicalHeight={1080}
                    trackIndex={selectedTrackIndex}
                  />
                )}

                {/* Empty state */}
                {videoAndImageClips.length === 0 && (
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

// Helper type for clips with their associated data
interface ClipWithMetadata {
  clip: Clip;
  asset: Asset;
  track: Track;
  trackIndex: number;
  canvasNode?: import('@/types').CanvasNode;
}

// Helper function to get ALL visible clips at current time (video, audio, image)
// Returns clips sorted by rendering order (bottom track to top track, then by zIndex)
function getAllVisibleClips(
  clips: Record<string, Clip>, 
  tracks: Track[], 
  getAssetById: (id: string) => Asset | undefined,
  currentTimeMs: number,
  getCanvasNodeByClipId: (clipId: string) => import('@/types').CanvasNode | undefined
): ClipWithMetadata[] {
  const visibleClips: ClipWithMetadata[] = [];
  
  // Iterate through all visible tracks
  tracks.forEach((track, trackIndex) => {
    if (!track.visible) return;
    
    // Only check video tracks for canvas rendering (not audio tracks)
    if (track.type !== 'video') return;
    
    // Find all clips on this track that are active at current time
    track.clips.forEach(clipId => {
      const clip = clips[clipId];
      if (!clip) return;
      
      // Check if current time falls within clip bounds
      if (currentTimeMs >= clip.startMs && currentTimeMs < clip.endMs) {
        const asset = getAssetById(clip.assetId);
        if (asset) {
          // Get canvasNode for this clip
          const canvasNode = getCanvasNodeByClipId(clipId);
          visibleClips.push({
            clip,
            asset,
            track,
            trackIndex,
            canvasNode,
          });
        }
      }
    });
  });
  
  // Sort by rendering order: tracks from bottom to top, then by zIndex
  visibleClips.sort((a, b) => {
    if (a.trackIndex !== b.trackIndex) {
      return a.trackIndex - b.trackIndex;
    }
    return a.clip.zIndex - b.clip.zIndex;
  });
  
  return visibleClips;
}

// Helper function to get all audio clips that should be playing at current time
function getAudioClips(clips: Record<string, Clip>, tracks: Track[], currentTimeMs: number): Clip[] {
  const audioClips: Clip[] = [];
  
  for (const track of tracks.filter(t => t.type === 'audio' && t.visible)) {
    for (const clipId of track.clips) {
      const clip = clips[clipId];
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
