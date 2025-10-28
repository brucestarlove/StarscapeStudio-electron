import { useDraggable } from "@dnd-kit/core";
import { usePlaybackStore } from "@/store/playbackStore";
import { msToPixels } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Playhead() {
  const { currentTimeMs, zoom } = usePlaybackStore();

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'playhead',
    data: {
      type: 'playhead' as const,
    },
  });

  const playheadX = msToPixels(currentTimeMs, zoom);


  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute top-0 bottom-0 w-px bg-gradient-cyan-vibrant z-tooltip pointer-events-none",
        isDragging && "pointer-events-auto"
      )}
      style={{
        left: `${playheadX}px`,
      }}
      {...listeners}
      {...attributes}
    >
      {/* Diamond handle */}
      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-gradient-cyan-vibrant rotate-45 border border-white/20" />
      
      {/* Line */}
      <div className="w-full h-full bg-gradient-cyan-vibrant" />
    </div>
  );
}
