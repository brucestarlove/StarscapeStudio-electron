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
        "timeline-track h-20 flex items-center bg-gradient-to-r from-mid-navy/50 to-mid-navy/30 border-b border-white/5 hover:from-mid-navy/70 hover:to-mid-navy/50 transition-all duration-200",
        isOver && "bg-gradient-cyan-purple/20 border-light-blue",
        !track.visible && "opacity-50"
      )}
    >
      {/* Track header */}
      <div className="w-48 flex items-center space-x-sm px-sm">
        <Icon className="h-4 w-4 text-white/70" />
        <span className="text-body-small text-white font-medium truncate">
          {track.name}
        </span>
        
        <div className="flex items-center space-x-xs ml-auto">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 hover:text-white transition-colors",
              track.visible ? "text-white" : "text-white/30"
            )}
            onClick={handleToggleVisibility}
          >
            <Eye className="h-3 w-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 hover:text-white transition-colors",
              track.locked ? "text-white" : "text-white/30"
            )}
            onClick={handleToggleLock}
          >
            <Lock className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Track content area */}
      <div className="flex-1 relative h-full">
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
