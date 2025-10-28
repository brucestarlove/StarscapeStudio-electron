import { useEffect } from "react";
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import { TopBar } from "@/components/TopBar";
import { LeftRail } from "@/components/LeftRail";
import { LeftPane } from "@/components/LeftPane/LeftPane";
import { Stage } from "@/components/Stage/Stage";
import { TimelineDock } from "@/components/Timeline/TimelineDock";
import { DebugPanel } from "@/components/DebugPanel";
import { useProjectStore } from "@/store/projectStore";
import { usePlaybackStore, startPlaybackLoop, stopPlaybackLoop } from "@/store/playbackStore";
import type { DragItem } from "@/types";
import "./globals.css";

function App() {
  const { createClip, moveClip, trimClip } = useProjectStore();
  const { playing } = usePlaybackStore();

  // Start/stop playback loop
  useEffect(() => {
    if (playing) {
      startPlaybackLoop();
    } else {
      stopPlaybackLoop();
    }
    
    return () => stopPlaybackLoop();
  }, [playing]);

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
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    console.log('Drag over:', active.id, 'over:', over?.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;

    const dragItem = active.data.current as DragItem;
    const dropResult = over.data.current as { trackId: string; positionMs: number };

    console.log('Drag ended:', dragItem, 'dropped on:', dropResult);

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
        onDragEnd={handleDragEnd}
      >
        {/* Three-row, three-column grid layout */}
        <div className="h-full grid grid-rows-[60px_1fr_200px] grid-cols-[60px_300px_1fr]">
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
        {import.meta.env.DEV && <DebugPanel />}
      </DndContext>
    </div>
  );
}

export default App;
