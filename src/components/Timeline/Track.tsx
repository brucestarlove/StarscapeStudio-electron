import { useDroppable } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Eye, Lock, Volume2 } from "lucide-react";
import { ClipView } from "./ClipView";
import { useProjectStore } from "@/store/projectStore";
import { cn } from "@/lib/utils";

interface TrackProps {
  trackId: string;
}

export function Track({ trackId }: TrackProps) {
  const { tracks, getClipsByTrack, updateTrack } = useProjectStore();
  
  const track = tracks.find(t => t.id === trackId);
  const clips = getClipsByTrack(trackId);

  const { setNodeRef, isOver } = useDroppable({
    id: trackId,
    data: {
      trackId,
      positionMs: 0, // Will be calculated based on drop position
    },
  });

  if (!track) return null;

  const getTrackIcon = (type: string) => {
    switch (type) {
      case 'video': return Eye;
      case 'audio': return Volume2;
      default: return Eye;
    }
  };

  const Icon = getTrackIcon(track.type);

  const handleToggleVisibility = () => {
    updateTrack(trackId, { visible: !track.visible });
  };

  const handleToggleLock = () => {
    updateTrack(trackId, { locked: !track.locked });
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "timeline-track h-32 flex items-stretch bg-gradient-to-r from-mid-navy/50 to-mid-navy/30 border-b border-white/10",
        isOver && "bg-gradient-cyan-purple/20 border-light-blue",
        !track.visible && "opacity-50"
      )}
    >
      {/* Track header - fixed width column */}
      <div className="w-56 flex flex-col justify-center border-r border-white/10 px-md py-sm bg-gradient-to-r from-mid-navy/80 to-mid-navy/50">
        {/* Track name and icon */}
        <div className="flex items-center space-x-sm mb-xs">
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-md",
            track.type === 'video' ? "bg-light-blue/20" : "bg-purple/20"
          )}>
            <Icon className={cn(
              "h-4 w-4",
              track.type === 'video' ? "text-light-blue" : "text-purple"
            )} />
          </div>
          <span className="text-body text-white font-semibold truncate flex-1">
            {track.name}
          </span>
        </div>
        
        {/* Track controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-xs">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-md",
                track.visible ? "text-white" : "text-white/30"
              )}
              onClick={handleToggleVisibility}
              title="Toggle visibility"
            >
              <Eye className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-md",
                track.locked ? "text-white" : "text-white/30"
              )}
              onClick={handleToggleLock}
              title="Toggle lock"
            >
              <Lock className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="text-caption text-white/50">
            {clips.length} {clips.length === 1 ? 'clip' : 'clips'}
          </div>
        </div>
      </div>

      {/* Track content area - scrollable timeline */}
      <div className="flex-1 relative h-full bg-gradient-to-b from-dark-navy/30 to-mid-navy/20">
        {/* Clips */}
        {clips.map((clip) => (
          <ClipView key={clip.id} clip={clip} />
        ))}

        {/* Drop indicator */}
        {isOver && (
          <div className="absolute inset-0 bg-light-blue/10 border-2 border-dashed border-light-blue rounded-xs" />
        )}
      </div>
    </div>
  );
}
