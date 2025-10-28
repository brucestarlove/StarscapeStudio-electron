import { usePlaybackStore } from "@/store/playbackStore";
import { formatTimecode, msToPixels } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Ruler() {
  const { zoom } = usePlaybackStore();

  // Generate time markers based on zoom level
  const generateMarkers = () => {
    const markers = [];
    const maxTime = 60000; // 1 minute for MVP
    
    // Determine marker interval based on zoom
    let intervalMs = 1000; // 1 second default
    if (zoom > 0.5) intervalMs = 100; // 100ms for high zoom
    else if (zoom > 0.1) intervalMs = 500; // 500ms for medium zoom
    else if (zoom < 0.05) intervalMs = 5000; // 5 seconds for low zoom

    for (let time = 0; time <= maxTime; time += intervalMs) {
      const x = msToPixels(time, zoom);
      const isMajor = time % (intervalMs * 5) === 0; // Every 5th marker is major
      
      markers.push({
        time,
        x,
        isMajor,
        label: isMajor ? formatTimecode(time) : '',
      });
    }

    return markers;
  };

  const markers = generateMarkers();

  return (
    <div className="h-full relative bg-mid-navy">
      {/* Time markers */}
      {markers.map((marker) => (
        <div
          key={marker.time}
          className="absolute top-0 h-full flex flex-col"
          style={{ left: `${marker.x}px` }}
        >
          {/* Tick mark */}
          <div
            className={cn(
              "w-px bg-white/50",
              marker.isMajor ? "h-full" : "h-1/2"
            )}
          />
          
          {/* Time label */}
          {marker.isMajor && marker.label && (
            <div className="absolute top-1 left-1 text-caption text-white/70 font-mono">
              {marker.label}
            </div>
          )}
        </div>
      ))}

      {/* Grid lines (optional, for high zoom) */}
      {zoom > 0.2 && (
        <div className="absolute inset-0 pointer-events-none">
          {markers.map((marker) => (
            <div
              key={`grid-${marker.time}`}
              className="absolute top-0 w-px h-full bg-white/10"
              style={{ left: `${marker.x}px` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
