import { useDroppable, useDndContext } from "@dnd-kit/core";
import { ClipView } from "./ClipView";
import { useProjectStore } from "@/store/projectStore";
import { cn } from "@/lib/utils";
import type { DragItem } from "@/types";

interface TrackProps {
  trackId: string;
}

export function Track({ trackId }: TrackProps) {
  const { tracks, getClipsByTrack, getAssetById, clips } = useProjectStore();
  const { active } = useDndContext();

  const track = tracks.find(t => t.id === trackId);
  const clipsOnTrack = getClipsByTrack(trackId);

  const { setNodeRef, isOver } = useDroppable({
    id: trackId,
    data: {
      trackId,
      positionMs: 0, // Will be calculated based on drop position
    },
  });

  if (!track) return null;

  // Check if dragging audio over video track (invalid drop)
  let isInvalidDrop = false;
  if (isOver && active && track.type === 'video') {
    const dragItem = active.data.current as DragItem | undefined;
    if (dragItem) {
      if (dragItem.type === 'asset') {
        // Check if asset is audio
        const asset = getAssetById(dragItem.id);
        if (asset?.type === 'audio') {
          isInvalidDrop = true;
        }
      } else if (dragItem.type === 'clip') {
        // Check if clip is audio
        const clip = clips[dragItem.id];
        if (clip) {
          const asset = getAssetById(clip.assetId);
          if (asset?.type === 'audio') {
            isInvalidDrop = true;
          }
        }
      }
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "timeline-track h-32 relative bg-linear-to-r from-mid-navy/50 to-mid-navy/30 border-b border-white/10",
        isOver && !isInvalidDrop && "bg-light-blue/10",
        !track.visible && "opacity-50"
      )}
    >
      {/* Clips */}
      {clipsOnTrack.map((clip) => (
        <ClipView key={clip.id} clip={clip} />
      ))}

      {/* Drop indicator */}
      {isOver && (
        <div className={cn(
          "absolute inset-0 border-2 border-dashed rounded-xs pointer-events-none",
          isInvalidDrop ? "border-red-500" : "border-light-blue"
        )} />
      )}
    </div>
  );
}
