import { useEffect, useState } from "react";
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, DragMoveEvent } from "@dnd-kit/core";
import { TopBar } from "@/components/TopBar";
import { LeftRail } from "@/components/LeftRail";
import { LeftPane } from "@/components/LeftPane/LeftPane";
import { Stage } from "@/components/Stage/Stage";
import { TimelineDock } from "@/components/Timeline/TimelineDock";
import { useProjectStore } from "@/store/projectStore";
import { usePlaybackStore } from "@/store/playbackStore";
import { pixelsToMs, snapToTimeline } from "@/lib/utils";
import type { DragItem } from "@/types";
import "./globals.css";

function App() {
  const { createClip, moveClip, trimClip } = useProjectStore();
  const [playheadDragStartX, setPlayheadDragStartX] = useState<number | null>(null);

  // Prevent default browser behavior on file drag/drop (avoids navigation)
  useEffect(() => {
    const prevent = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    console.log('Drag started:', active.id);
    
    const dragItem = active.data.current as DragItem;
    if (dragItem.type === 'playhead') {
      // Store initial position for playhead dragging
      const { currentTimeMs, zoom } = usePlaybackStore.getState();
      const tracksScrollContainer = document.getElementById('tracks-scroll');
      if (tracksScrollContainer) {
        const rect = tracksScrollContainer.getBoundingClientRect();
        // Store the starting X position relative to the scroll container
        setPlayheadDragStartX(rect.left + (currentTimeMs * zoom));
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    console.log('Drag over:', active.id, 'over:', over?.id);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const { active, delta } = event;
    const dragItem = active.data.current as DragItem;
    
    if (dragItem.type === 'playhead' && playheadDragStartX !== null) {
      const { seek, zoom, currentTimeMs } = usePlaybackStore.getState();
      
      // Calculate new position based on mouse movement
      const deltaMs = pixelsToMs(delta.x, zoom);
      const newTimeMs = Math.max(0, currentTimeMs + deltaMs);
      
      // Update playhead position in real-time (no snapping during drag)
      seek(newTimeMs);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    const dragItem = active.data.current as DragItem;

    console.log('Drag ended:', dragItem);

    // Handle playhead seeking with snap
    if (dragItem.type === 'playhead') {
      const { seek, zoom, snapEnabled, currentTimeMs } = usePlaybackStore.getState();
      const snappedTime = snapToTimeline(currentTimeMs, zoom, snapEnabled);
      seek(Math.max(0, snappedTime));
      setPlayheadDragStartX(null);
      return;
    }

    if (!over) return;

    const dropResult = over.data.current as { trackId: string; positionMs: number };

    if (dragItem.type === 'asset' && dropResult) {
      // Create new clip from asset
      createClip(dragItem.id, dropResult.trackId, dropResult.positionMs);
    } else if (dragItem.type === 'clip' && dropResult) {
      // Move existing clip
      moveClip(dragItem.id, dropResult.trackId, dropResult.positionMs);
    } else if (dragItem.type === 'trim-handle' && dragItem.clipId) {
      // Handle trim operation
      const deltaMs = dropResult.positionMs - (dragItem.side === 'left' ? 0 : 1000); // Simplified
      trimClip(dragItem.clipId, dragItem.side!, deltaMs);
    }
  };

  return (
    <div className="h-screen w-screen cosmic-bg overflow-hidden">
      <DndContext
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      >
        {/* Three-row, three-column grid layout */}
        <div className="h-full grid grid-rows-[60px_1fr_320px] grid-cols-[60px_300px_1fr]">
          {/* TopBar spans full width */}
          <div className="col-span-3 row-start-1">
            <TopBar />
          </div>

          {/* LeftRail */}
          <div className="col-start-1 row-start-2">
            <LeftRail />
          </div>

          {/* LeftPane (collapsible) */}
          <div className="col-start-2 row-start-2">
            <LeftPane />
          </div>

          {/* Stage */}
          <div className="col-start-3 row-start-2">
            <Stage />
          </div>

          {/* TimelineDock spans full width */}
          <div className="col-span-3 row-start-3">
            <TimelineDock />
          </div>
        </div>
      </DndContext>
    </div>
  );
}

export default App;
