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
  const { tracks, getClipsByTrack } = useProjectStore();
  
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

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "timeline-track h-16 flex items-center",
        isOver && "bg-gradient-cyan-purple/20 border-light-blue"
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
            className="h-6 w-6 text-white/50 hover:text-white"
          >
            <Eye className="h-3 w-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-white/50 hover:text-white"
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
