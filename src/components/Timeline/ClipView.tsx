import { useDraggable } from "@dnd-kit/core";
import { Play, Music, Image } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { usePlaybackStore } from "@/store/playbackStore";
import { msToPixels, formatTimecode } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Clip } from "@/types";

interface ClipViewProps {
  clip: Clip;
}

export function ClipView({ clip }: ClipViewProps) {
  const { selectedClipIds, selectClip, getAssetById } = useProjectStore();
  const { zoom } = usePlaybackStore();
  
  const asset = getAssetById(clip.assetId);
  const isSelected = selectedClipIds.includes(clip.id);

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

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute top-2 bottom-2 timeline-clip cursor-pointer transition-all duration-200",
        isSelected && "timeline-clip selected",
        isDragging && "opacity-50"
      )}
      style={{
        left: `${clipLeft}px`,
        width: `${Math.max(clipWidth, 20)}px`, // Minimum width
      }}
      onClick={handleClick}
      {...listeners}
      {...attributes}
    >
      {/* Clip content */}
      <div className="h-full flex items-center px-sm">
        <Icon className="h-3 w-3 text-white/70 mr-xs flex-shrink-0" />
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
            className="absolute left-0 top-0 bottom-0 w-2 bg-light-blue/50 hover:bg-light-blue cursor-ew-resize"
            style={{ opacity: isSelected ? 1 : 0 }}
          />
          
          {/* Right trim handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-2 bg-light-blue/50 hover:bg-light-blue cursor-ew-resize"
            style={{ opacity: isSelected ? 1 : 0 }}
          />
        </>
      )}
    </div>
  );
}
