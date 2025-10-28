import { useDraggable } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Play, Image, Music, Video, Trash2 } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { usePlaybackStore } from "@/store/playbackStore";
import { formatTimecode } from "@/lib/utils";
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

  const Icon = getAssetIcon(asset.type);

  return (
    <Card
      ref={setNodeRef}
      variant="dark-glass"
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-elevated",
        isDragging && "opacity-50"
      )}
      onDoubleClick={onDoubleClick}
      {...listeners}
      {...attributes}
    >
      <CardContent className="p-md">
        <div className="aspect-video bg-gradient-purple-blue rounded-md flex items-center justify-center mb-sm">
          <Icon className="h-8 w-8 text-white" />
        </div>
        
        <div className="space-y-xs">
          <h3 className="text-body-small font-medium text-white truncate">
            {asset.name}
          </h3>
          
          <div className="flex items-center justify-between text-caption text-white/70">
            <span className="capitalize">{asset.type}</span>
            <span>{formatTimecode(asset.duration)}</span>
          </div>
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
