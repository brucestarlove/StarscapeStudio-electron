import { useDraggable } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Play, Image, Music, Video, Trash2 } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { usePlaybackStore } from "@/store/playbackStore";
import { formatTimecode, formatFileSize } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/uiStore";
import type { Asset } from "@/types";

interface AssetCardProps {
  asset: Asset;
  onDoubleClick: () => void;
}

function AssetCard({ asset, onDoubleClick }: AssetCardProps) {
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
        "bg-gradient-to-br",
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
          {/* Duration */}
          <span className="text-[10px] text-white/50 font-mono">
            {formatTimecode(asset.duration)}
          </span>
        </div>
        
        {/* Resolution and file size */}
        <div className="text-[10px] text-white/40 flex items-center gap-2">
          {asset.metadata.width && asset.metadata.height && (
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
  );
}

interface LibraryGridProps {
  onUploadClick: () => void;
}

export function LibraryGrid({ onUploadClick }: LibraryGridProps) {
  const { assets, createClip, clearProject } = useProjectStore();
  const { currentTimeMs } = usePlaybackStore();
  const { leftPaneCollapsed, setLeftPaneCollapsed } = useUiStore();

  const handleUploadClick = () => {
    if (leftPaneCollapsed) setLeftPaneCollapsed(false);
    onUploadClick();
  };

  const handleAssetDoubleClick = (asset: Asset) => {
    const state = useProjectStore.getState();
    const videoTrack = state.tracks.find(t => t.type === 'video');
    if (videoTrack) {
      // Create clip and get the returned clipId
      const clipId = createClip(asset.id, videoTrack.id, currentTimeMs);
      
      // Canvas node is already created in createClip action, no need to create again
      console.log(`Created clip ${clipId} for asset ${asset.name}`);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all assets and reset the project? This cannot be undone.')) {
      clearProject();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Upload button */}
      <div className="p-md space-y-sm">
        <Button
          variant="outline"
          className="w-full h-20 flex flex-col items-center justify-center space-y-sm border-dashed border-2 border-light-blue/50 hover:border-light-blue hover:bg-light-blue/10"
          onClick={handleUploadClick}
        >
          <Plus className="h-6 w-6 text-light-blue" />
          <span className="text-light-blue font-medium">Upload Media</span>
        </Button>
        
        {assets.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={handleClearAll}
          >
            <Trash2 className="h-4 w-4 mr-xs" />
            Clear All Assets
          </Button>
        )}
      </div>

      {/* Assets grid */}
      <div className="flex-1 overflow-auto scrollbar-starscape p-md">
        {assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Play className="h-12 w-12 text-white/30 mb-md" />
            <p className="text-body-small text-white/50">
              No media files yet.<br />
              Click "Upload Media" to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-md">
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onDoubleClick={() => handleAssetDoubleClick(asset)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
