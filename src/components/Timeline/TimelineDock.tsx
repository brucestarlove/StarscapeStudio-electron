import { Ruler } from "./Ruler";
import { Track } from "./Track";
import { Playhead } from "./Playhead";
import { TransportControls } from "../Transport/TransportControls";
import { TrackHeader } from "./TrackHeader";
import { useProjectStore } from "@/store/projectStore";

export function TimelineDock() {
  const { tracks } = useProjectStore();

  return (
    <div className="h-full bg-gradient-to-b from-dark-navy to-mid-navy border-t border-light-blue/30 shadow-lg flex flex-col">
      {/* Fixed row for ruler and track headers */}
      <div className="flex h-10 border-b border-white/20 bg-gradient-to-b from-mid-navy/80 to-dark-navy/80 flex-shrink-0">
        {/* Spacer for track headers - matches track header width */}
        <div className="w-56 border-r border-white/10 bg-gradient-to-r from-mid-navy/50 to-mid-navy/30" />
        
        {/* Ruler - fixed, doesn't scroll */}
        <div className="flex-1 overflow-hidden">
          <Ruler />
        </div>
      </div>

      {/* Scrollable tracks area - headers and tracks together */}
      <div className="flex-1 overflow-auto scrollbar-starscape bg-gradient-to-b from-dark-navy/50 to-mid-navy/30 relative" id="tracks-scroll">
        {/* Wide container for timeline */}
        <div className="flex">
          {/* Fixed track headers column */}
          <div className="w-56 flex-shrink-0 border-r border-white/10">
            {tracks.map((track) => (
              <TrackHeader key={`header-${track.id}`} trackId={track.id} />
            ))}
          </div>

          {/* Scrollable track content area */}
          <div className="relative min-w-[6000px] flex-1">
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
      <div className="border-t border-white/20 bg-gradient-to-r from-mid-navy/50 to-dark-navy/50 flex-shrink-0">
        <TransportControls />
      </div>
    </div>
  );
}
