import { useEffect, useState } from "react";
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, DragMoveEvent, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { TopBar } from "@/components/TopBar";
import { LeftRail } from "@/components/LeftRail";
import { LibraryPane } from "@/components/LibraryPane/LibraryPane";
import { UtilitiesPane } from "@/components/LibraryPane/UtilitiesPane";
import { AIPane } from "@/components/LibraryPane/AIPane";
import { RightRail } from "@/components/RightRail";
import { TransitionsPane } from "@/components/RightPane/TransitionsPane";
import { EffectsPane } from "@/components/RightPane/EffectsPane";
import { Stage } from "@/components/Stage/Stage";
import { TimelineDock } from "@/components/Timeline/TimelineDock";
import { useProjectStore } from "@/store/projectStore";
import { usePlaybackStore } from "@/store/playbackStore";
import { useUiStore } from "@/store/uiStore";
import { pixelsToMs, snapToTimeline, msToPixels, formatTimecode, resolveClipCollision, cn } from "@/lib/utils";
import type { DragItem, Clip } from "@/types";
import { Play, Music, Image } from "lucide-react";
import "./globals.css";

function App() {
  const { createClip, moveClip, trimClip, deleteClip, getSelectedClips, getAssetById, getClipsByTrack, shiftClipsRight } = useProjectStore();
  const { activeLeftPaneTab, activeRightPaneTab, leftPaneCollapsed, rightPaneCollapsed, setLeftPaneCollapsed, setRightPaneCollapsed } = useUiStore();
  const [playheadDragStartX, setPlayheadDragStartX] = useState<number | null>(null);
  const [lastDragX, setLastDragX] = useState<number>(0);
  const [clipDragData, setClipDragData] = useState<{ activeId: string; positionMs: number } | null>(null);
  const [activeDragItem, setActiveDragItem] = useState<{ item: DragItem; clip?: Clip; offsetX: number } | null>(null);

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

  // Handle spacebar for play/pause toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        // Prevent spacebar from triggering when typing in input fields
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }

        e.preventDefault();
        const { playing, play, pause } = usePlaybackStore.getState();
        if (playing) {
          pause();
        } else {
          play();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
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
      // Pause playback when user starts scrubbing
      const { pause, currentTimeMs, zoom } = usePlaybackStore.getState();
      pause();

      // Store initial position for playhead dragging - track last X for incremental updates
      const tracksScrollContainer = document.getElementById('tracks-scroll');
      if (tracksScrollContainer) {
        const rect = tracksScrollContainer.getBoundingClientRect();
        // Store the starting X position relative to the scroll container
        setPlayheadDragStartX(rect.left + (currentTimeMs * zoom));
        setLastDragX(0); // Reset to 0 at drag start
      }
    } else if (dragItem.type === 'clip') {
      // For clip dragging, calculate the offset from the clip's left edge to where the user grabbed
      const { clips } = useProjectStore.getState();
      const clip = clips[dragItem.id];

      if (clip) {
        // Get the clip element to find where the user clicked relative to the clip's start
        const clipElement = document.querySelector(`[data-clip-id="${clip.id}"]`) as HTMLElement;
        if (clipElement) {
          const clipRect = clipElement.getBoundingClientRect();
          const grabOffsetX = event.activatorEvent ?
            (event.activatorEvent as MouseEvent).clientX - clipRect.left : 0;

          setActiveDragItem({
            item: dragItem,
            clip,
            offsetX: grabOffsetX
          });
        }
      }
    } else if (dragItem.type === 'asset') {
      // For assets being dragged from library, offset is 0 (drag from start)
      setActiveDragItem({
        item: dragItem,
        offsetX: 0
      });
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
    } else if ((dragItem.type === 'clip' || dragItem.type === 'asset') && activeDragItem) {
      // For clips/assets being dragged, calculate the position accounting for grab offset
      const { zoom } = usePlaybackStore.getState();
      const tracksScrollContainer = document.getElementById('tracks-scroll');

      if (tracksScrollContainer && event.activatorEvent) {
        // Get current mouse position
        const mouseEvent = event.activatorEvent as PointerEvent;
        const currentMouseX = mouseEvent.clientX + delta.x;

        // Get the scroll offset to account for horizontal scrolling
        const scrollLeft = tracksScrollContainer.scrollLeft;

        // Get the tracks container position
        const containerRect = tracksScrollContainer.getBoundingClientRect();

        // Track headers width (w-56 = 224px)
        const trackHeaderWidth = 224;

        // Calculate mouse position relative to timeline content area
        const mouseXInContainer = currentMouseX - containerRect.left - trackHeaderWidth + scrollLeft;

        // Subtract the grab offset to get the clip's left edge position
        const clipLeftX = mouseXInContainer - activeDragItem.offsetX;

        // Convert pixels to milliseconds
        const positionMs = Math.max(0, pixelsToMs(clipLeftX, zoom));

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

    if (!over) {
      // Clear drag data even if no valid drop target
      setClipDragData(null);
      setActiveDragItem(null);
      return;
    }

    // Use the tracked position from drag movement, or fall back to over data
    let positionMs = clipDragData?.positionMs ?? (over.data.current as { trackId: string; positionMs: number }).positionMs ?? 0;
    const dropResult = {
      trackId: over.data.current?.trackId,
      positionMs
    };

    // Prevent audio assets/clips from being dropped on video tracks
    if (dropResult.trackId) {
      const { tracks } = useProjectStore.getState();
      const targetTrack = tracks.find(t => t.id === dropResult.trackId);
      
      if (targetTrack && targetTrack.type === 'video') {
        // Check if dragging audio asset
        if (dragItem.type === 'asset') {
          const asset = getAssetById(dragItem.id);
          if (asset?.type === 'audio') {
            console.log('Drop cancelled - audio assets cannot be placed on video tracks');
            setClipDragData(null);
            setActiveDragItem(null);
            return;
          }
        }
        // Check if dragging audio clip
        else if (dragItem.type === 'clip') {
          const clip = useProjectStore.getState().clips[dragItem.id];
          if (clip) {
            const asset = getAssetById(clip.assetId);
            if (asset?.type === 'audio') {
              console.log('Drop cancelled - audio clips cannot be placed on video tracks');
              setClipDragData(null);
              setActiveDragItem(null);
              return;
            }
          }
        }
      }
    }

    if (dragItem.type === 'asset' && dropResult.trackId) {
      // Create new clip from asset - check for collisions
      const { assets } = useProjectStore.getState();
      const { zoom } = usePlaybackStore.getState();
      const asset = assets.find(a => a.id === dragItem.id);

      if (asset) {
        const trackClips = getClipsByTrack(dropResult.trackId);
        const clipDuration = asset.duration;

        // Convert mouse offset from pixels to milliseconds
        const mouseOffsetMs = activeDragItem ? pixelsToMs(activeDragItem.offsetX, zoom) : undefined;

        // Resolve collision with smart insertion
        const resolution = resolveClipCollision(
          positionMs,
          clipDuration,
          trackClips,
          undefined,
          mouseOffsetMs
        );

        // If drop should be cancelled, don't create the clip
        if (resolution.shouldCancel) {
          console.log('Drop cancelled - would overlap existing clip');
          setClipDragData(null);
          setActiveDragItem(null);
          return;
        }

        // If we need to insert before a clip, shift it and subsequent clips first
        if (resolution.shouldShift && resolution.targetClipId) {
          // Calculate where the target clip should start (at the end of the dragged clip)
          const newTargetStartMs = resolution.resolvedStartMs + clipDuration;
          shiftClipsRight(dropResult.trackId, resolution.targetClipId, newTargetStartMs);
        }

        // Create the clip at the resolved position
        createClip(dragItem.id, dropResult.trackId, resolution.resolvedStartMs);
      }
    } else if (dragItem.type === 'clip' && dropResult.trackId) {
      // Move existing clip - check for collisions
      const { clips } = useProjectStore.getState();
      const { zoom } = usePlaybackStore.getState();
      const clip = clips[dragItem.id];

      if (clip) {
        const trackClips = getClipsByTrack(dropResult.trackId);
        const clipDuration = clip.endMs - clip.startMs;

        // Convert mouse offset from pixels to milliseconds
        const mouseOffsetMs = activeDragItem ? pixelsToMs(activeDragItem.offsetX, zoom) : undefined;

        // Resolve collision with smart insertion (exclude the clip being moved)
        const resolution = resolveClipCollision(
          positionMs,
          clipDuration,
          trackClips,
          dragItem.id,
          mouseOffsetMs
        );

        // If drop should be cancelled, don't move the clip (it stays where it was)
        if (resolution.shouldCancel) {
          console.log('Drop cancelled - would overlap existing clip');
          setClipDragData(null);
          setActiveDragItem(null);
          return;
        }

        // If we need to insert before a clip, shift it and subsequent clips first
        if (resolution.shouldShift && resolution.targetClipId) {
          // Calculate where the target clip should start (at the end of the dragged clip)
          const newTargetStartMs = resolution.resolvedStartMs + clipDuration;
          shiftClipsRight(dropResult.trackId, resolution.targetClipId, newTargetStartMs);
        }

        // Move the clip to the resolved position
        moveClip(dragItem.id, dropResult.trackId, resolution.resolvedStartMs);
      }
    } else if (dragItem.type === 'trim-handle' && dragItem.clipId) {
      // Handle trim operation
      const deltaMs = dropResult.positionMs - (dragItem.side === 'left' ? 0 : 1000); // Simplified
      trimClip(dragItem.clipId, dragItem.side!, deltaMs);
    }

    // Clear drag data
    setClipDragData(null);
    setActiveDragItem(null);
  };

  // Helper to render the active left pane
  const renderActivePane = () => {
    switch (activeLeftPaneTab) {
      case 'utilities':
        return <UtilitiesPane />;
      case 'ai':
        return <AIPane />;
      case 'library':
      default:
        return <LibraryPane />;
    }
  };

  // Helper to render the active right pane
  const renderActiveRightPane = () => {
    switch (activeRightPaneTab) {
      case 'effects':
        return <EffectsPane />;
      case 'transitions':
      default:
        return <TransitionsPane />;
    }
  };

  // Helper to render drag overlay for clips
  const renderDragOverlay = () => {
    if (!activeDragItem) return null;

    const { item, clip } = activeDragItem;
    const { zoom } = usePlaybackStore.getState();

    // Render clip overlay
    if (item.type === 'clip' && clip) {
      const asset = getAssetById(clip.assetId);
      if (!asset) return null;

      const clipWidth = msToPixels(clip.endMs - clip.startMs, zoom);
      const getClipIcon = (type: string) => {
        switch (type) {
          case 'video': return Play;
          case 'audio': return Music;
          case 'image': return Image;
          default: return Play;
        }
      };
      const Icon = getClipIcon(asset.type);

      return (
        <div
          className="timeline-clip cursor-grabbing rounded-sm shadow-2xl bg-linear-to-r from-light-blue/30 to-cyan-500/30 border-2 border-light-blue/50 opacity-90"
          style={{
            width: `${Math.max(clipWidth, 20)}px`,
            height: '112px', // Match track height (h-32 = 128px minus padding)
          }}
        >
          <div className="h-full flex items-center px-sm">
            <Icon className="h-3 w-3 text-white/70 mr-xs shrink-0" />
            <span className="text-caption text-white truncate">
              {asset.name}
            </span>
          </div>
          {clipWidth > 60 && (
            <div className="absolute bottom-1 right-1 text-caption text-white/70 bg-black/50 px-xs rounded">
              {formatTimecode(clip.endMs - clip.startMs)}
            </div>
          )}
        </div>
      );
    }

    // Render asset overlay (from library)
    if (item.type === 'asset') {
      const asset = getAssetById(item.id);
      if (!asset) return null;

      const clipWidth = msToPixels(asset.duration, zoom);
      const getClipIcon = (type: string) => {
        switch (type) {
          case 'video': return Play;
          case 'audio': return Music;
          case 'image': return Image;
          default: return Play;
        }
      };
      const Icon = getClipIcon(asset.type);

      return (
        <div
          className="timeline-clip cursor-grabbing rounded-sm shadow-2xl bg-linear-to-r from-light-blue/30 to-cyan-500/30 border-2 border-light-blue/50 opacity-90"
          style={{
            width: `${Math.max(clipWidth, 20)}px`,
            height: '112px',
          }}
        >
          <div className="h-full flex items-center px-sm">
            <Icon className="h-3 w-3 text-white/70 mr-xs shrink-0" />
            <span className="text-caption text-white truncate">
              {asset.name}
            </span>
          </div>
          {clipWidth > 60 && (
            <div className="absolute bottom-1 right-1 text-caption text-white/70 bg-black/50 px-xs rounded">
              {formatTimecode(asset.duration)}
            </div>
          )}
        </div>
      );
    }

    return null;
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
        {/* Three-row layout with flexible columns */}
        <div className="h-full flex flex-col">
          {/* TopBar - fixed height */}
          <div className="h-[60px]">
            <TopBar />
          </div>

          {/* Middle section - main content area */}
          <div className="flex-1 flex overflow-hidden">
            {/* LeftRail - fixed width */}
            <div className="w-[60px] shrink-0">
              <LeftRail />
            </div>

            {/* Left Panes Container - collapsible from left */}
            <div className={cn(
              "shrink-0 transition-all duration-300 overflow-hidden",
              leftPaneCollapsed ? "w-0" : "w-[300px]"
            )}>
              {renderActivePane()}
            </div>

            {/* Collapsed left pane indicator */}
            {leftPaneCollapsed && (
              <div className="w-1 shrink-0 bg-mid-navy border-r border-light-blue/20 flex items-center justify-center relative group">
                <button
                  onClick={() => setLeftPaneCollapsed(false)}
                  className="absolute inset-0 flex items-center justify-center text-white/30 hover:text-white hover:bg-light-blue/10 transition-all"
                  title="Expand left pane"
                >
                  <span className="transform rotate-90 text-xl">›</span>
                </button>
              </div>
            )}

            {/* Stage - center responsive area */}
            <div className="flex-1 min-w-0">
              <Stage />
            </div>

            {/* Collapsed right pane indicator */}
            {rightPaneCollapsed && (
              <div className="w-1 shrink-0 bg-mid-navy border-l border-light-blue/20 flex items-center justify-center relative group">
                <button
                  onClick={() => setRightPaneCollapsed(false)}
                  className="absolute inset-0 flex items-center justify-center text-white/30 hover:text-white hover:bg-light-blue/10 transition-all"
                  title="Expand right pane"
                >
                  <span className="transform rotate-90 text-xl">‹</span>
                </button>
              </div>
            )}

            {/* Right Panes Container - collapsible from right */}
            <div className={cn(
              "shrink-0 transition-all duration-300 overflow-hidden",
              rightPaneCollapsed ? "w-0" : "w-[300px]"
            )}>
              {renderActiveRightPane()}
            </div>

            {/* RightRail - fixed width */}
            <div className="w-[60px] shrink-0">
              <RightRail />
            </div>
          </div>

          {/* TimelineDock - fixed height */}
          <div className="h-[320px]">
            <TimelineDock />
          </div>
        </div>

        {/* Drag overlay to show clip following cursor */}
        <DragOverlay dropAnimation={null}>
          {renderDragOverlay()}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export default App;
