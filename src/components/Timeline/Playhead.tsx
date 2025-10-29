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
      className="absolute top-0 bottom-0 w-px z-50 pointer-events-none"
      style={{
        left: `${playheadX}px`,
      }}
    >
      {/* Diamond handle - always visible and draggable */}
      <div
        ref={setNodeRef}
        className={cn(
          "absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gradient-cyan-vibrant rotate-45 border border-white/20 cursor-col-resize pointer-events-auto shadow-lg",
          isDragging && "scale-125"
        )}
        {...listeners}
        {...attributes}
        title="Drag to seek through timeline"
      />

      {/* Line */}
      <div className="w-full h-full bg-gradient-cyan-vibrant shadow-glow-cyan pointer-events-none" />
    </div>
  );
}
