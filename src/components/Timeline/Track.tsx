import { useDroppable } from "@dnd-kit/core";
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

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "timeline-track h-32 relative bg-linear-to-r from-mid-navy/50 to-mid-navy/30 border-b border-white/10",
        isOver && "bg-light-blue/10",
        !track.visible && "opacity-50"
      )}
    >
      {/* Clips */}
      {clips.map((clip) => (
        <ClipView key={clip.id} clip={clip} />
      ))}

      {/* Drop indicator */}
      {isOver && (
        <div className="absolute inset-0 border-2 border-dashed border-light-blue rounded-xs pointer-events-none" />
      )}
    </div>
  );
}
