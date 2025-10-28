import { Card } from "@/components/ui/card";
import { Play } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { usePlaybackStore } from "@/store/playbackStore";
import { useEffect, useRef } from "react";
import type { Clip } from "@/types";

export function Stage() {
  const { canvasNodes, clips, getAssetById, tracks } = useProjectStore();
  const { currentTimeMs, playing } = usePlaybackStore();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Find the visible clip at current time
  const visibleClip = getVisibleClip(clips, tracks, currentTimeMs);
  const visibleAsset = visibleClip ? getAssetById(visibleClip.assetId) : null;

  // Calculate source video time accounting for trim
  const sourceTimeMs = visibleClip 
    ? (currentTimeMs - visibleClip.startMs) + visibleClip.trimStartMs
    : 0;

  // Sync video playback with store
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !visibleAsset) return;

    // Update video source if asset changed
    if (video.src !== visibleAsset.url) {
      video.src = visibleAsset.url;
    }

    // Seek to correct time
    const targetTime = sourceTimeMs / 1000; // Convert to seconds
    if (Math.abs(video.currentTime - targetTime) > 0.1) {
      video.currentTime = targetTime;
    }

    // Sync play/pause state
    if (playing && video.paused) {
      video.play().catch(console.error);
    } else if (!playing && !video.paused) {
      video.pause();
    }
  }, [visibleAsset, sourceTimeMs, playing]);

  return (
    <div className="h-full bg-dark-navy p-lg">
      <Card variant="dark-glass" className="h-full">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-md border-b border-white/10">
            <h2 className="text-h3 font-semibold text-light-blue">Preview</h2>
            <div className="text-caption text-white/50">
              {formatTimecode(currentTimeMs)}
            </div>
          </div>

          {/* Canvas area */}
          <div className="flex-1 relative bg-mid-navy rounded-md overflow-hidden">
            {/* 16:9 aspect ratio container */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-full max-w-4xl aspect-video bg-black rounded-md overflow-hidden">
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
                ) : (
                  /* Canvas nodes for non-video assets */
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
                        <div className="w-48 h-36 bg-gradient-purple-blue rounded-md flex items-center justify-center">
                          {asset.type === 'audio' && <div className="text-white text-caption">Audio</div>}
                          {asset.type === 'image' && <div className="text-white text-caption">Image</div>}
                        </div>
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
      </Card>
    </div>
  );
}

// Helper function to find visible clip at current time
function getVisibleClip(clips: Record<string, Clip>, tracks: any[], currentTimeMs: number): Clip | null {
  for (const track of tracks.filter(t => t.type === 'video')) {
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
