import { useDraggable } from "@dnd-kit/core";
import { Play, Music, Image } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { usePlaybackStore } from "@/store/playbackStore";
import { msToPixels, formatTimecode } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import type { Clip } from "@/types";

interface ClipViewProps {
  clip: Clip;
}

export function ClipView({ clip }: ClipViewProps) {
  const { selectedClipIds, selectClip, getAssetById, trimClip } = useProjectStore();
  const { zoom } = usePlaybackStore();

  const asset = getAssetById(clip.assetId);
  const isSelected = selectedClipIds.includes(clip.id);

  // Trim state - track start position, last position, and boundary state
  // maxDragDistance tracks the farthest we've dragged in either direction
  // When dragging beyond boundaries, we need to drag back past the original point before trimming resumes
  const [trimming, setTrimming] = useState<{
    side: 'left' | 'right';
    startX: number;
    lastX: number;
    maxDragDistance: number; // positive = right, negative = left
    beyondBoundary: boolean; // true if we've hit a boundary limit
    boundaryX: number; // the X position where we hit the boundary
  } | null>(null);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: clip.id,
    data: {
      type: 'clip' as const,
      id: clip.id,
    },
  });

  if (!asset) return null;

  const getClipIcon = (type: string) => {
    switch (type) {
      case 'video': return Play;
      case 'audio': return Music;
      case 'image': return Image;
      default: return Play;
    }
  };

  const Icon = getClipIcon(asset.type);

  // Calculate clip dimensions and position
  const clipWidth = msToPixels(clip.endMs - clip.startMs, zoom);
  const clipLeft = msToPixels(clip.startMs, zoom);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectClip(clip.id);
  };

  // Trim handle mouse events
  const handleTrimStart = (side: 'left' | 'right', e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setTrimming({
      side,
      startX: e.clientX,
      lastX: e.clientX,
      maxDragDistance: 0,
      beyondBoundary: false,
      boundaryX: e.clientX,
    });
  };

  // Global mouse handlers for trimming
  useEffect(() => {
    if (!trimming) return;

    const handleMove = (e: MouseEvent) => {
      // Calculate total distance from start
      const totalDragDistance = e.clientX - trimming.startX;
      
      // Calculate incremental delta since last mouse move
      const deltaX = e.clientX - trimming.lastX;
      
      // Track if we're dragging further out than we've been before
      const isDraggingFurtherOut = Math.abs(totalDragDistance) > Math.abs(trimming.maxDragDistance);
      
      // If we're currently beyond the boundary
      if (trimming.beyondBoundary) {
        // Check if we've dragged back past the boundary point
        const draggedBackPastBoundary = trimming.side === 'left'
          ? e.clientX > trimming.boundaryX
          : e.clientX < trimming.boundaryX;
        
        if (draggedBackPastBoundary) {
          // We've re-entered the valid region - resume trimming
          setTrimming(prev => prev ? {
            ...prev,
            lastX: e.clientX,
            maxDragDistance: totalDragDistance,
            beyondBoundary: false,
          } : null);
        } else {
          // Still beyond boundary, just update position tracking
          setTrimming(prev => prev ? {
            ...prev,
            lastX: e.clientX,
            maxDragDistance: isDraggingFurtherOut ? totalDragDistance : prev.maxDragDistance,
          } : null);
        }
        return; // Don't apply trim while beyond boundary
      }

      // Get current clip state to check boundaries before applying trim
      const currentClip = useProjectStore.getState().clips[clip.id];
      const currentAsset = asset;
      
      if (!currentClip || !currentAsset) return;

      // Convert pixels to milliseconds: zoom is in px/ms, so ms = px / (px/ms)
      const deltaMs = deltaX / zoom;

      // Check if this delta would hit a boundary
      let wouldHitBoundary = false;
      if (trimming.side === 'left') {
        const newTrimStart = currentClip.trimStartMs + deltaMs;
        const newStartMs = currentClip.startMs + deltaMs;
        wouldHitBoundary = newTrimStart <= 0 || newStartMs <= 0;
      } else {
        const newTrimEnd = currentClip.trimEndMs + deltaMs;
        // For images, allow extending up to 60 seconds (handled by trimClip)
        // For videos, check against asset duration
        if (currentAsset.type === 'image') {
          const maxImageDuration = 60000;
          wouldHitBoundary = newTrimEnd >= maxImageDuration;
        } else {
          wouldHitBoundary = newTrimEnd >= currentAsset.duration;
        }
      }

      // Apply the trim (trimClip handles minimum durations internally)
      trimClip(clip.id, trimming.side, deltaMs);

      // Update state with boundary detection
      setTrimming(prev => {
        if (!prev) return null;
        return {
          ...prev,
          lastX: e.clientX,
          maxDragDistance: totalDragDistance,
          beyondBoundary: wouldHitBoundary,
          boundaryX: wouldHitBoundary ? e.clientX : prev.boundaryX,
        };
      });
    };

    const handleUp = () => {
      setTrimming(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [trimming, clip, zoom, trimClip, getAssetById]);

  return (
    <div
      ref={setNodeRef}
      data-clip-id={clip.id}
      className={cn(
        "absolute top-2 bottom-2 timeline-clip rounded-sm shadow-lg",
        "bg-linear-to-r from-light-blue/20 to-cyan-500/20 border border-light-blue/30",
        isSelected && "ring-2 ring-light-blue ring-opacity-60 shadow-xl shadow-light-blue/30",
        isDragging && "opacity-50"
      )}
      style={{
        left: `${clipLeft}px`,
        width: `${Math.max(clipWidth, 20)}px`, // Minimum width
      }}
      onClick={handleClick}
    >
      {/* Clip content - this is the draggable area */}
      <div
        className="h-full flex items-center px-sm cursor-pointer"
        {...listeners}
        {...attributes}
      >
        <Icon className="h-3 w-3 text-white/70 mr-xs shrink-0" />
        <span className="text-caption text-white truncate">
          {asset.name}
        </span>
      </div>

      {/* Duration badge */}
      {clipWidth > 60 && (
        <div className="absolute bottom-1 right-1 text-caption text-white/70 bg-black/50 px-xs rounded">
          {formatTimecode(clip.endMs - clip.startMs)}
        </div>
      )}

      {/* Trim handles (shown on hover or when selected) */}
      {(isSelected || clipWidth > 40) && (
        <>
          {/* Left trim handle */}
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize rounded-l-sm",
              "bg-linear-to-r from-light-blue/60 to-light-blue/40",
              isSelected ? "opacity-100" : "opacity-0"
            )}
            onMouseDown={(e) => handleTrimStart('left', e)}
          />

          {/* Right trim handle */}
          <div
            className={cn(
              "absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize rounded-r-sm",
              "bg-linear-to-l from-light-blue/60 to-light-blue/40",
              isSelected ? "opacity-100" : "opacity-0"
            )}
            onMouseDown={(e) => handleTrimStart('right', e)}
          />
        </>
      )}
    </div>
  );
}
