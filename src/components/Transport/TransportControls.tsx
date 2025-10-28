import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, Magnet } from "lucide-react";
import { usePlaybackStore } from "@/store/playbackStore";
import { formatTimecode } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function TransportControls() {
  const {
    playing,
    currentTimeMs,
    zoom,
    snapEnabled,
    togglePlay,
    stepBackward,
    stepForward,
    setZoom,
    toggleSnap,
  } = usePlaybackStore();

  const handleZoomChange = (value: number[]) => {
    setZoom(value[0]);
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
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
