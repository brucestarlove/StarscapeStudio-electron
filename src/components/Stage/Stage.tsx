import { Card } from "@/components/ui/card";
import { Play } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { usePlaybackStore } from "@/store/playbackStore";

export function Stage() {
  const { canvasNodes, clips, getAssetById } = useProjectStore();
  const { currentTimeMs } = usePlaybackStore();

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
                {/* Canvas nodes */}
                {Object.values(canvasNodes).map((node) => {
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
                        {asset.type === 'video' && <Play className="h-8 w-8 text-white" />}
                        {asset.type === 'audio' && <div className="text-white text-caption">Audio</div>}
                        {asset.type === 'image' && <div className="text-white text-caption">Image</div>}
                      </div>
                    </div>
                  );
                })}

                {/* Empty state */}
                {Object.keys(canvasNodes).length === 0 && (
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

// Helper function to format timecode
function formatTimecode(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
}
