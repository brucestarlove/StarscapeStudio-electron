import { Card } from "@/components/ui/card";
import { Ruler } from "./Ruler";
import { Track } from "./Track";
import { Playhead } from "./Playhead";
import { TransportControls } from "../Transport/TransportControls";
import { useProjectStore } from "@/store/projectStore";

export function TimelineDock() {
  const { tracks } = useProjectStore();

  return (
    <div className="h-full bg-gradient-to-b from-dark-navy to-mid-navy border-t border-light-blue/30 shadow-lg">
      <Card variant="dark-glass" className="h-full border-0 shadow-none">
        <div className="h-full flex flex-col">
          {/* Timeline header */}
          <div className="flex items-center justify-between p-md border-b border-white/20 bg-gradient-to-r from-mid-navy/50 to-dark-navy/50">
            <h2 className="text-h3 font-semibold text-light-blue flex items-center">
              <div className="w-2 h-2 bg-light-blue rounded-full mr-sm animate-pulse"></div>
              Timeline
            </h2>
            <div className="text-caption text-white/70 bg-white/5 px-sm py-xs rounded-md">
              {tracks.length} tracks
            </div>
          </div>

          {/* Timeline content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Ruler */}
            <div className="h-10 border-b border-white/20 bg-gradient-to-b from-mid-navy/80 to-dark-navy/80">
              <Ruler />
            </div>

            {/* Tracks area */}
            <div className="flex-1 relative overflow-auto scrollbar-starscape bg-gradient-to-b from-dark-navy/50 to-mid-navy/30">
              {/* Playhead */}
              <Playhead />
              
              {/* Tracks */}
              <div className="space-y-xs p-md">
                {tracks.map((track) => (
                  <Track key={track.id} trackId={track.id} />
                ))}
              </div>
            </div>

            {/* Transport controls */}
            <div className="border-t border-white/20 bg-gradient-to-r from-mid-navy/50 to-dark-navy/50">
              <TransportControls />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
