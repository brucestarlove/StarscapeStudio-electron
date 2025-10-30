import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Play, Image, Music, Video, ListPlus, Edit, Trash2 } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { usePlaybackStore } from "@/store/playbackStore";
import { formatTimecode, formatFileSize } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/uiStore";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { RenameAssetDialog } from "@/components/RenameAssetDialog";
import type { Asset } from "@/types";

interface AssetCardProps {
  asset: Asset;
  onDoubleClick: () => void;
  onAddToTimeline: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function AssetCard({ asset, onDoubleClick, onAddToTimeline, onRename, onDelete }: AssetCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: asset.id,
    data: {
      type: 'asset' as const,
      id: asset.id,
    },
  });

  const getAssetIcon = (type: Asset['type']) => {
    switch (type) {
      case 'video': return Video;
      case 'audio': return Music;
      case 'image': return Image;
      default: return Play;
    }
  };

  const getAssetColor = (type: Asset['type']) => {
    switch (type) {
      case 'video': return 'from-purple-500/20 to-blue-500/20';
      case 'audio': return 'from-pink-500/20 to-purple-500/20';
      case 'image': return 'from-blue-500/20 to-cyan-500/20';
      default: return 'from-purple-500/20 to-blue-500/20';
    }
  };

  const Icon = getAssetIcon(asset.type);
  const gradientColor = getAssetColor(asset.type);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card
          ref={setNodeRef}
          variant="dark-glass"
          className={cn(
            "group cursor-grab active:cursor-grabbing transition-all duration-200 overflow-hidden p-0",
            "hover:scale-[1.02] hover:shadow-elevated hover:border-light-blue/40",
            isDragging && "opacity-50 scale-95"
          )}
          onDoubleClick={onDoubleClick}
          {...listeners}
          {...attributes}
        >
          {/* Thumbnail/Preview Area - Top Half */}
          <div className={cn(
            "aspect-video flex items-center justify-center overflow-hidden relative",
            "bg-linear-to-br",
            gradientColor
          )}>
            {asset.thumbnailUrl ? (
              <img
                src={asset.thumbnailUrl}
                alt={asset.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  // Fallback to icon if thumbnail fails to load
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <Icon className="h-10 w-10 text-white/70 group-hover:text-white group-hover:scale-110 transition-all duration-200" />
            )}
          </div>

          {/* Asset Info - Bottom Half */}
          <CardContent className="space-y-1.5">
            <h3
              className="text-xs font-medium text-white truncate leading-tight group-hover:text-light-blue transition-colors"
              title={asset.name}
            >
              {asset.name}
            </h3>

            <div className="flex items-center gap-1.5">
              {/* Type pill */}
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/10 text-white/80 capitalize">
                {asset.type}
              </span>
              {/* Duration - only show for non-image assets */}
              {asset.type !== 'image' && (
                <span className="text-[10px] text-white/50 font-mono">
                  {formatTimecode(asset.duration)}
                </span>
              )}
            </div>

            {/* Resolution and file size */}
            <div className="text-[10px] text-white/40 flex items-center gap-2">
              {asset.type !== 'audio' && asset.metadata.width && asset.metadata.height && (
                <>
                  <span>{asset.metadata.width}×{asset.metadata.height}</span>
                  {asset.fileSize && <span>•</span>}
                </>
              )}
              {asset.fileSize && (
                <span>{formatFileSize(asset.fileSize)}</span>
              )}
            </div>
          </CardContent>
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48 bg-[#0a0a0f]/95 backdrop-blur-xl border-white/20">
        <ContextMenuItem
          onClick={onAddToTimeline}
          className="flex items-center gap-2 text-white/90 hover:text-white focus:bg-white/10 focus:text-white cursor-pointer"
        >
          <ListPlus className="h-4 w-4" />
          <span>Add to Timeline</span>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={onRename}
          className="flex items-center gap-2 text-white/90 hover:text-white focus:bg-white/10 focus:text-white cursor-pointer"
        >
          <Edit className="h-4 w-4" />
          <span>Rename</span>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={onDelete}
          className="flex items-center gap-2 text-white/90 hover:text-white focus:bg-white/10 focus:text-white cursor-pointer"
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface LibraryGridProps {
  onUploadClick: () => void;
}

export function LibraryGrid({ onUploadClick }: LibraryGridProps) {
  const { assets, createClip } = useProjectStore();
  const { currentTimeMs } = usePlaybackStore();
  const { leftPaneCollapsed, setLeftPaneCollapsed } = useUiStore();
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const handleUploadClick = () => {
    if (leftPaneCollapsed) setLeftPaneCollapsed(false);
    onUploadClick();
  };

  const handleAssetDoubleClick = (asset: Asset) => {
    const state = useProjectStore.getState();

    // Determine target track based on asset type
    let targetTrack = null;
    if (asset.type === 'audio') {
      // For audio assets, always use Audio Track 1 (first audio track)
      targetTrack = state.tracks.find(t => t.type === 'audio');
    } else {
      // For video/image assets, use selected track if available, otherwise fall back to first video track
      if (state.selectedTrackId) {
        targetTrack = state.tracks.find(t => t.id === state.selectedTrackId);
      }
      if (!targetTrack) {
        targetTrack = state.tracks.find(t => t.type === 'video');
      }
    }

    if (targetTrack) {
      // Get all clips on the target track to find the end position
      const trackClips = state.tracks
        .filter(t => t.id === targetTrack.id)
        .flatMap(t => t.clips)
        .map(id => state.clips[id])
        .filter(clip => clip !== undefined)
        .sort((a, b) => b.endMs - a.endMs); // Sort by end time, descending

      // Calculate where to place the clip
      let insertPosition: number;
      if (asset.type === 'audio') {
        // For audio: start at 0 seconds unless there's an existing clip, then place at end of last clip
        if (trackClips.length > 0) {
          insertPosition = trackClips[0].endMs;
        } else {
          insertPosition = 0;
        }
      } else {
        // For video/image: after all existing clips, or at currentTime if earlier
        insertPosition = currentTimeMs;
        if (trackClips.length > 0) {
          const lastClipEnd = trackClips[0].endMs;
          insertPosition = Math.max(currentTimeMs, lastClipEnd);
        }
      }

      // Create clip and get the returned clipId
      const clipId = createClip(asset.id, targetTrack.id, insertPosition);

      // Canvas node is already created in createClip action, no need to create again
      console.log(`Created clip ${clipId} for asset ${asset.name} at ${insertPosition}ms`);
    }
  };

  const handleAddToTimeline = (asset: Asset) => {
    const state = useProjectStore.getState();

    // Use selected track if available, otherwise fall back to first video track
    let targetTrack = null;
    if (state.selectedTrackId) {
      targetTrack = state.tracks.find(t => t.id === state.selectedTrackId);
    }
    if (!targetTrack) {
      targetTrack = state.tracks.find(t => t.type === 'video');
    }

    if (targetTrack) {
      // Get all clips on the target track to find the end position
      const trackClips = state.tracks
        .filter(t => t.id === targetTrack.id)
        .flatMap(t => t.clips)
        .map(id => state.clips[id])
        .filter(clip => clip !== undefined)
        .sort((a, b) => b.endMs - a.endMs); // Sort by end time, descending

      // Calculate where to place the clip (after all existing clips, or at currentTime if earlier)
      let insertPosition = currentTimeMs;
      if (trackClips.length > 0) {
        const lastClipEnd = trackClips[0].endMs;
        insertPosition = Math.max(currentTimeMs, lastClipEnd);
      }

      const clipId = createClip(asset.id, targetTrack.id, insertPosition);
      console.log(`Added clip ${clipId} for asset ${asset.name} to timeline at ${insertPosition}ms`);
    }
  };

  const handleRename = (assetId: string) => {
    setSelectedAssetId(assetId);
    setRenameDialogOpen(true);
  };

  const handleDelete = (assetId: string) => {
    // Delete asset without confirmation
    const state = useProjectStore.getState();
    state.removeAsset(assetId);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Assets grid with Upload button always first */}
      <div className="flex-1 overflow-auto scrollbar-starscape p-md">
        {assets.length === 0 ? (
          // Empty state with upload button
          <div className="grid grid-cols-2 gap-md h-fit">
            {/* Upload Media button */}
            <Button
              variant="outline"
              className="h-full flex flex-col items-center justify-center space-y-sm border-dashed border-2 border-light-blue/50 hover:border-light-blue hover:bg-light-blue/10"
              onClick={handleUploadClick}
            >
              <Plus className="h-6 w-6 text-light-blue" />
              <span className="text-light-blue font-medium">Upload Media</span>
            </Button>
          </div>
        ) : (
          // Grid with upload button and assets
          <div className="grid grid-cols-2 gap-md">
            {/* Upload Media button - same size as asset cards */}
            <Button
              variant="outline"
              className="h-full flex flex-col items-center justify-center space-y-sm border-dashed border-2 border-light-blue/50 hover:border-light-blue hover:bg-light-blue/10"
              onClick={handleUploadClick}
            >
              <Plus className="h-6 w-6 text-light-blue" />
              <span className="text-light-blue font-medium">Upload Media</span>
            </Button>

            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onDoubleClick={() => handleAssetDoubleClick(asset)}
                onAddToTimeline={() => handleAddToTimeline(asset)}
                onRename={() => handleRename(asset.id)}
                onDelete={() => handleDelete(asset.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rename Asset Dialog */}
      <RenameAssetDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        assetId={selectedAssetId}
      />
    </div>
  );
}
