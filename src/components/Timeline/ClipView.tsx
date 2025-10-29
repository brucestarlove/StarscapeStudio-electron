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

  // Trim state - track both start position and last position to calculate incremental deltas
  const [trimming, setTrimming] = useState<{ side: 'left' | 'right', startX: number, lastX: number } | null>(null);

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
    setTrimming({ side, startX: e.clientX, lastX: e.clientX });
  };

  // Global mouse handlers for trimming
  useEffect(() => {
    if (!trimming) return;

    const handleMove = (e: MouseEvent) => {
      // Calculate incremental delta since last mouse move
      const deltaX = e.clientX - trimming.lastX;

      // Convert pixels to milliseconds: zoom is in px/ms, so ms = px / (px/ms)
      const deltaMs = deltaX / zoom;

      // Apply the trim
      trimClip(clip.id, trimming.side, deltaMs);

      // Update last position for next delta calculation
      setTrimming(prev => prev ? { ...prev, lastX: e.clientX } : null);
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
  }, [trimming, clip.id, zoom, trimClip]);

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
