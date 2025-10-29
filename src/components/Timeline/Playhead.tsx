import { useDraggable } from "@dnd-kit/core";
import { usePlaybackStore } from "@/store/playbackStore";
import { msToPixels } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useState, useRef } from "react";

export function Playhead() {
  const { currentTimeMs, zoom } = usePlaybackStore();
  
  // Track if we should enable dragging (only after significant mouse movement)
  const [enableDrag, setEnableDrag] = useState(false);
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'playhead',
    data: {
      type: 'playhead' as const,
    },
    disabled: !enableDrag, // Only enable drag when we detect movement
  });

  const playheadX = msToPixels(currentTimeMs, zoom);

  // Custom mouse handlers to distinguish click from drag
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    setEnableDrag(false); // Start with drag disabled
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseDownPos.current) return;
    
    // Check if mouse has moved enough to start dragging
    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);
    
    // Enable drag if movement exceeds threshold (5px for playhead - more sensitive)
    if (dx > 5 || dy > 5) {
      setEnableDrag(true);
    }
  };

  const handleMouseUp = () => {
    // Reset drag state
    mouseDownPos.current = null;
    setEnableDrag(false);
  };

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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        {...(enableDrag ? listeners : {})}
        {...attributes}
        title="Drag to seek through timeline"
      />

      {/* Line */}
      <div className="w-full h-full bg-gradient-cyan-vibrant shadow-glow-cyan pointer-events-none" />
    </div>
  );
}
