import { Card } from "@/components/ui/card";
import { Play, Music } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { usePlaybackStore } from "@/store/playbackStore";
import { useEffect, useRef } from "react";
import type { Clip } from "@/types";

export function Stage() {
  const { canvasNodes, clips, getAssetById, tracks } = useProjectStore();
  const { currentTimeMs, playing, seek } = usePlaybackStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const isSeekingRef = useRef(false); // Track if we're programmatically seeking
  const loadedAssetIdRef = useRef<string | null>(null); // Track which asset is loaded

  // Find the visible clip at current time
  const visibleClip = getVisibleClip(clips, tracks, currentTimeMs);
  const visibleAsset = visibleClip ? getAssetById(visibleClip.assetId) : null;

  // Calculate source video time accounting for trim
  const sourceTimeMs = visibleClip 
    ? (currentTimeMs - visibleClip.startMs) + visibleClip.trimStartMs
    : 0;

  // Load video source when asset changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !visibleAsset) return;

    // Only update source if the asset actually changed
    if (loadedAssetIdRef.current !== visibleAsset.id) {
      console.log('Loading new video source:', visibleAsset.url);
      video.src = visibleAsset.url;
      video.load();
      loadedAssetIdRef.current = visibleAsset.id;
    }
  }, [visibleAsset]);

  // Sync video playback with store
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !visibleAsset) return;

    console.log('Playback sync effect:', {
      playing,
      currentTimeMs,
      sourceTimeMs,
      videoTime: video.currentTime,
      videoPaused: video.paused
    });

    // Only seek if there's a significant difference (user seeked)
    const targetTime = sourceTimeMs / 1000; // Convert to seconds
    const timeDiff = Math.abs(video.currentTime - targetTime);
    
    console.log('Time comparison:', { targetTime, videoTime: video.currentTime, timeDiff });
    
    // If the difference is more than 0.5 seconds, user likely seeked manually
    if (timeDiff > 0.5) {
      console.log('Seeking video to:', targetTime);
      isSeekingRef.current = true;
      video.currentTime = targetTime;
      // Reset flag after a short delay
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 100);
    }

    // Sync play/pause state
    if (playing && video.paused) {
      console.log('Starting video playback');
      video.play().catch(err => {
        console.error('Play error:', err);
      });
    } else if (!playing && !video.paused) {
      console.log('Pausing video');
      video.pause();
    }
  }, [visibleAsset, sourceTimeMs, playing]);

  // Update playback store as video plays
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !visibleClip) return;

    const handleTimeUpdate = () => {
      // Don't update store if we're programmatically seeking
      if (isSeekingRef.current || !playing) {
        console.log('Skipping timeupdate:', { isSeekingRef: isSeekingRef.current, playing });
        return;
      }
      
      // Calculate timeline time from video time
      const videoTimeMs = video.currentTime * 1000;
      const timelineTimeMs = (videoTimeMs - visibleClip.trimStartMs) + visibleClip.startMs;
      
      console.log('Timeupdate:', { videoTimeMs, timelineTimeMs, trimStart: visibleClip.trimStartMs, clipStart: visibleClip.startMs });
      
      // Update store with the current playback position
      seek(timelineTimeMs);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [visibleClip, playing, seek]);

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
                    muted
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

// Helper function to format timecode
function formatTimecode(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
}