import { Ruler } from "./Ruler";
import { Track } from "./Track";
import { Playhead } from "./Playhead";
import { TransportControls } from "../Transport/TransportControls";
import { TrackHeader } from "./TrackHeader";
import { useProjectStore } from "@/store/projectStore";
import { usePlaybackStore } from "@/store/playbackStore";
import { msToPixels } from "@/lib/utils";
import { useRef, useEffect } from "react";

export function TimelineDock() {
  const { tracks, getTimelineDuration } = useProjectStore();
  const { zoom, setZoom } = usePlaybackStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Handle scroll wheel for zooming
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (event: WheelEvent) => {
      // Only zoom if scroll is vertical (deltaY)
      if (Math.abs(event.deltaY) === 0) return;

      // Prevent default scroll behavior and zoom instead
      event.preventDefault();

      // Zoom with smaller increments (0.02 per scroll event)
      const zoomIncrement = 0.02;
      if (event.deltaY < 0) {
        // Scroll up = zoom in
        setZoom(zoom + zoomIncrement);
      } else {
        // Scroll down = zoom out
        setZoom(zoom - zoomIncrement);
      }
    };

    // Add listener with passive: false to allow preventDefault
    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [zoom, setZoom]);

  // Calculate minimum width based on timeline duration
  const timelineDuration = getTimelineDuration();
  const minWidth = Math.max(msToPixels(timelineDuration, zoom), 2000); // At least 2000px

  return (
    <div className="h-full bg-linear-to-b from-dark-navy to-mid-navy border-t border-light-blue/30 shadow-lg flex flex-col">
      {/* Fixed row for ruler and track headers */}
      <div className="flex h-10 border-b border-white/20 bg-linear-to-b from-mid-navy/80 to-dark-navy/80 shrink-0">
        {/* Spacer for track headers - matches track header width */}
        <div className="w-56 border-r border-white/10 bg-linear-to-r from-mid-navy/50 to-mid-navy/30" />

        {/* Ruler - fixed, doesn't scroll */}
        <div className="flex-1 overflow-hidden">
          <Ruler />
        </div>
      </div>

      {/* Scrollable tracks area - headers and tracks together */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto scrollbar-starscape bg-linear-to-b from-dark-navy/50 to-mid-navy/30 relative"
        id="tracks-scroll"
      >
        {/* Wide container for timeline */}
        <div className="flex">
          {/* Fixed track headers column */}
          <div className="w-56 shrink-0 border-r border-white/10">
            {tracks.map((track) => (
              <TrackHeader key={`header-${track.id}`} trackId={track.id} />
            ))}
          </div>

          {/* Scrollable track content area - width based on timeline duration */}
          <div className="relative flex-1" style={{ minWidth: `${minWidth}px` }}>
            {/* Playhead - positioned absolutely in this container */}
            <Playhead />

            {/* Track lanes */}
            {tracks.map((track) => (
              <Track key={track.id} trackId={track.id} />
            ))}
          </div>
        </div>
      </div>

      {/* Transport controls */}
      <div className="border-t border-white/20 bg-linear-to-r from-mid-navy/50 to-dark-navy/50 shrink-0">
        <TransportControls />
      </div>
    </div>
  );
}
