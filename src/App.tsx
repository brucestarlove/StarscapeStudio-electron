import { useEffect, useState } from "react";
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, DragMoveEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { TopBar } from "@/components/TopBar";
import { LeftRail } from "@/components/LeftRail";
import { LeftPane } from "@/components/LeftPane/LeftPane";
import { UtilitiesPane } from "@/components/LeftPane/UtilitiesPane";
import { Stage } from "@/components/Stage/Stage";
import { TimelineDock } from "@/components/Timeline/TimelineDock";
import { useProjectStore } from "@/store/projectStore";
import { usePlaybackStore } from "@/store/playbackStore";
import { useUiStore } from "@/store/uiStore";
import { pixelsToMs, snapToTimeline } from "@/lib/utils";
import type { DragItem } from "@/types";
import "./globals.css";

function App() {
  const { createClip, moveClip, trimClip, deleteClip, getSelectedClips } = useProjectStore();
  const { activeLeftPaneTab } = useUiStore();
  const [playheadDragStartX, setPlayheadDragStartX] = useState<number | null>(null);
  const [lastDragX, setLastDragX] = useState<number>(0);
  const [clipDragData, setClipDragData] = useState<{ activeId: string; positionMs: number } | null>(null);

  // Configure drag sensors with activation constraints
  // This prevents drag from triggering on simple clicks
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before drag starts
      },
    })
  );

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

  // Handle Delete key for deleting selected clips
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedClips = getSelectedClips();
        if (selectedClips.length > 0) {
          e.preventDefault();
          // Delete each selected clip
          selectedClips.forEach(clip => {
            deleteClip(clip.id);
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [deleteClip, getSelectedClips]);

  // Handle 'S' key for splitting selected clip at playhead
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const { selectedClipIds, splitClip, getSelectedClips } = useProjectStore.getState();
        const { currentTimeMs } = usePlaybackStore.getState();
        
        // Check if exactly one clip is selected
        if (selectedClipIds.length !== 1) return;

        const selectedClip = getSelectedClips()[0];
        if (!selectedClip) return;

        // Check if playhead is within the clip bounds (not at edges)
        if (currentTimeMs <= selectedClip.startMs || currentTimeMs >= selectedClip.endMs) return;

        e.preventDefault();
        // Split the clip at the current playhead position
        splitClip(selectedClipIds[0], currentTimeMs);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    console.log('Drag started:', active.id);
    
    const dragItem = active.data.current as DragItem;
    if (dragItem.type === 'playhead') {
      // Store initial position for playhead dragging - track last X for incremental updates
      const { currentTimeMs, zoom } = usePlaybackStore.getState();
      const tracksScrollContainer = document.getElementById('tracks-scroll');
      if (tracksScrollContainer) {
        const rect = tracksScrollContainer.getBoundingClientRect();
        // Store the starting X position relative to the scroll container
        setPlayheadDragStartX(rect.left + (currentTimeMs * zoom));
        setLastDragX(0); // Reset to 0 at drag start
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
      
      // Calculate incremental delta since last move (delta.x is cumulative from drag start)
      const incrementalDeltaX = delta.x - lastDragX;
      const deltaMs = pixelsToMs(incrementalDeltaX, zoom);
      const newTimeMs = Math.max(0, currentTimeMs + deltaMs);
      
      // Update last position for next delta calculation
      setLastDragX(delta.x);
      
      // Update playhead position in real-time (no snapping during drag)
      seek(newTimeMs);
    } else if (dragItem.type === 'clip' || dragItem.type === 'asset') {
      // For clips/assets being dragged, calculate the position in milliseconds
      const { zoom } = usePlaybackStore.getState();
      const tracksScrollContainer = document.getElementById('tracks-scroll');
      
      if (tracksScrollContainer) {
        // Get the scroll offset to account for horizontal scrolling
        const scrollLeft = tracksScrollContainer.scrollLeft;
        
        // Get the mouse position relative to the viewport
        const containerRect = tracksScrollContainer.getBoundingClientRect();
        
        // Calculate position in the timeline: 
        // The track headers are 224px wide (w-56 = 14rem ≈ 224px)
        // So we need to subtract that offset
        const positionInTimeline = scrollLeft + (delta.x - (containerRect.left - scrollLeft));
        
        // Convert pixels to milliseconds
        const positionMs = Math.max(0, pixelsToMs(positionInTimeline, zoom));
        
        setClipDragData({
          activeId: active.id as string,
          positionMs
        });
      }
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
      setLastDragX(0); // Reset for next drag
      return;
    }

    if (!over) return;

    // Use the tracked position from drag movement, or fall back to over data
    const positionMs = clipDragData?.positionMs ?? (over.data.current as { trackId: string; positionMs: number }).positionMs ?? 0;
    const dropResult = { 
      trackId: over.data.current?.trackId,
      positionMs 
    };

    if (dragItem.type === 'asset' && dropResult.trackId) {
      // Create new clip from asset
      createClip(dragItem.id, dropResult.trackId, positionMs);
    } else if (dragItem.type === 'clip' && dropResult.trackId) {
      // Move existing clip
      moveClip(dragItem.id, dropResult.trackId, positionMs);
    } else if (dragItem.type === 'trim-handle' && dragItem.clipId) {
      // Handle trim operation
      const deltaMs = dropResult.positionMs - (dragItem.side === 'left' ? 0 : 1000); // Simplified
      trimClip(dragItem.clipId, dragItem.side!, deltaMs);
    }
    
    // Clear drag data
    setClipDragData(null);
  };

  // Helper to render the active pane
  const renderActivePane = () => {
    switch (activeLeftPaneTab) {
      case 'utilities':
        return <UtilitiesPane />;
      case 'library':
      default:
        return <LeftPane />;
    }
  };

  return (
    <div className="h-screen w-screen cosmic-bg overflow-hidden">
      <DndContext
        sensors={sensors}
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

          {/* LeftPane (collapsible) - renders based on active tab */}
          <div className="col-start-2 row-start-2">
            {renderActivePane()}
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
