import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, Magnet, Volume2, VolumeX, Scissors } from "lucide-react";
import { usePlaybackStore } from "@/store/playbackStore";
import { useProjectStore } from "@/store/projectStore";
import { audioManager } from "@/lib/AudioManager";
import { formatTimecode } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

export function TransportControls() {
  const {
    playing,
    currentTimeMs,
    zoom,
    snapEnabled,
    volume,
    isMuted,
    togglePlay,
    stepBackward,
    stepForward,
    setZoom,
    toggleSnap,
    setVolume,
    toggleMute,
  } = usePlaybackStore();

  const { selectedClipIds, splitClip, getSelectedClips } = useProjectStore();

  // Sync volume and mute state with AudioManager
  useEffect(() => {
    audioManager.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    audioManager.setMuted(isMuted);
  }, [isMuted]);

  const handleZoomChange = (value: number[]) => {
    setZoom(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
  };

  const handleSplit = () => {
    // Check if a clip is selected
    if (selectedClipIds.length !== 1) {
      console.warn('Please select exactly one clip to split');
      return;
    }

    const selectedClip = getSelectedClips()[0];
    if (!selectedClip) return;

    // Check if playhead is within the clip bounds
    if (currentTimeMs <= selectedClip.startMs || currentTimeMs >= selectedClip.endMs) {
      console.warn('Playhead must be inside the clip bounds to split');
      return;
    }

    // Split the clip at the current playhead position
    splitClip(selectedClipIds[0], currentTimeMs);
  };

  return (
    <div className="p-md flex items-center justify-between">
      {/* Left: Playback controls */}
      <div className="flex items-center space-x-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={stepBackward}
          className="text-white hover:bg-light-blue/20"
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button
          variant="gradient"
          size="icon"
          onClick={togglePlay}
          className="w-10 h-10"
        >
          {playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={stepForward}
          className="text-white hover:bg-light-blue/20"
        >
          <SkipForward className="h-4 w-4" />
        </Button>

        {/* Split button */}
        <Button
          variant={selectedClipIds.length === 1 ? "ghost" : "ghost"}
          size="icon"
          onClick={handleSplit}
          disabled={selectedClipIds.length !== 1}
          className={cn(
            "text-white",
            selectedClipIds.length === 1
              ? "hover:bg-light-blue/20 cursor-pointer"
              : "opacity-40 cursor-not-allowed"
          )}
          title={selectedClipIds.length === 1 
            ? "Split selected clip at playhead (S)" 
            : "Select a clip to split"}
        >
          <Scissors className="h-4 w-4" />
        </Button>

        {/* Audio controls */}
        <div className="flex items-center space-x-sm ml-md pl-md border-l border-white/10">
          {/* Mute button */}
          <Button
            variant={isMuted ? "default" : "ghost"}
            size="icon"
            onClick={toggleMute}
            className={cn(
              "text-white",
              isMuted
                ? "bg-red-500/20"
                : "hover:bg-light-blue/20"
            )}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>

          {/* Volume slider */}
          <div className="w-24">
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              min={0}
              max={1}
              step={0.05}
              className="w-full"
              title={`Volume: ${Math.round(volume * 100)}%`}
            />
          </div>
        </div>
      </div>

      {/* Center: Timecode */}
      <div className="text-body font-mono text-white">
        {formatTimecode(currentTimeMs)}
      </div>

      {/* Right: Zoom and snap controls */}
      <div className="flex items-center space-x-md">
        {/* Snap toggle */}
        <Button
          variant={snapEnabled ? "default" : "ghost"}
          size="icon"
          onClick={toggleSnap}
          className={cn(
            "text-white",
            snapEnabled 
              ? "bg-gradient-cyan-purple" 
              : "hover:bg-light-blue/20"
          )}
          title="Snap to grid"
        >
          <Magnet className="h-4 w-4" />
        </Button>

        {/* Zoom controls */}
        <div className="flex items-center space-x-sm">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setZoom(Math.max(0.01, zoom / 1.5))}
            className="text-white hover:bg-light-blue/20"
            title="Zoom out (Shift + scroll to zoom)"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          <div className="w-24">
            <Slider
              value={[zoom]}
              onValueChange={handleZoomChange}
              min={0.01}
              max={2}
              step={0.01}
              className="w-full"
            />
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setZoom(Math.min(2, zoom * 1.5))}
            className="text-white hover:bg-light-blue/20"
            title="Zoom in (Shift + scroll to zoom)"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
