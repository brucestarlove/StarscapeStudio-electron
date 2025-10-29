import { usePlaybackStore } from "@/store/playbackStore";
import { formatTimecode, msToPixels, pixelsToMs, snapToTimeline } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Ruler() {
  const { zoom, seek, snapEnabled } = usePlaybackStore();

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

  // Handle ruler click to seek
  const handleRulerClick = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const timeMs = pixelsToMs(clickX, zoom);
    const snappedTime = snapToTimeline(timeMs, zoom, snapEnabled);
    seek(Math.max(0, snappedTime));
  };

  return (
    <div 
      className="h-full relative bg-gradient-to-b from-mid-navy/90 to-dark-navy/90 min-w-[6000px] cursor-pointer"
      onClick={handleRulerClick}
      title="Click to seek to position"
    >
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
              "w-px",
              marker.isMajor 
                ? "h-full bg-light-blue/60 shadow-sm shadow-light-blue/20" 
                : "h-1/2 bg-white/40"
            )}
          />
          
          {/* Time label */}
          {marker.isMajor && marker.label && (
            <div className="absolute top-1 left-1 text-caption text-light-blue/90 font-mono font-medium bg-dark-navy/80 px-xs py-xs rounded-sm shadow-sm">
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
              className="absolute top-0 w-px h-full bg-white/5"
              style={{ left: `${marker.x}px` }}
            />
          ))}
        </div>
      )}

      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
    </div>
  );
}
