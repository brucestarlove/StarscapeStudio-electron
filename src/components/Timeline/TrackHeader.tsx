import { Button } from "@/components/ui/button";
import { Eye, Lock, Volume2 } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { cn } from "@/lib/utils";

interface TrackHeaderProps {
  trackId: string;
}

export function TrackHeader({ trackId }: TrackHeaderProps) {
  const { tracks, getClipsByTrack, updateTrack } = useProjectStore();

  const track = tracks.find(t => t.id === trackId);
  const clips = getClipsByTrack(trackId);

  if (!track) return null;

  // Check if this is the first video track (Main Track)
  const firstVideoTrack = tracks.find(t => t.type === 'video');
  const isMainTrack = track.type === 'video' && track.id === firstVideoTrack?.id;

  const getTrackIcon = (type: string) => {
    switch (type) {
      case 'video': return Eye;
      case 'audio': return Volume2;
      default: return Eye;
    }
  };

  const Icon = getTrackIcon(track.type);

  const handleToggleVisibility = () => {
    updateTrack(trackId, { visible: !track.visible });
  };

  const handleToggleLock = () => {
    updateTrack(trackId, { locked: !track.locked });
  };

  return (
    <div className={cn(
      "h-32 flex flex-col justify-center px-md py-sm bg-linear-to-r from-mid-navy/80 to-mid-navy/50 border-b border-white/10",
      !track.visible && "opacity-50"
    )}>
      {/* Track name and icon */}
      <div className="flex items-center space-x-sm mb-xs">
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded-md",
          track.type === 'video' ? "bg-light-blue/20" : "bg-purple/20"
        )}>
          <Icon className={cn(
            "h-4 w-4",
            track.type === 'video' ? "text-light-blue" : "text-purple"
          )} />
        </div>
        <span className="text-body text-white font-semibold truncate flex-1">
          {track.name}
        </span>
        {/* MAIN badge for Track 1 */}
        {isMainTrack && (
          <span className="px-xs py-xs text-caption font-bold bg-gradient-to-r from-light-blue to-purple bg-clip-text text-transparent border border-light-blue/30 rounded-sm">
            MAIN
          </span>
        )}
      </div>

      {/* Track controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-xs">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-md",
              track.visible ? "text-white" : "text-white/30"
            )}
            onClick={handleToggleVisibility}
            title="Toggle visibility"
          >
            <Eye className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-md",
              track.locked ? "text-white" : "text-white/30"
            )}
            onClick={handleToggleLock}
            title="Toggle lock"
          >
            <Lock className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-caption text-white/50">
          {clips.length} {clips.length === 1 ? 'clip' : 'clips'}
        </div>
      </div>
    </div>
  );
}

