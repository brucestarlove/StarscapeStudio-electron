import { Card } from "@/components/ui/card";
import { Ruler } from "./Ruler";
import { Track } from "./Track";
import { Playhead } from "./Playhead";
import { TransportControls } from "../Transport/TransportControls";
import { useProjectStore } from "@/store/projectStore";

export function TimelineDock() {
  const { tracks } = useProjectStore();

  return (
    <div className="h-full bg-dark-navy border-t border-light-blue/20">
      <Card variant="dark-glass" className="h-full">
        <div className="h-full flex flex-col">
          {/* Timeline header */}
          <div className="flex items-center justify-between p-sm border-b border-white/10">
            <h2 className="text-h3 font-semibold text-light-blue">Timeline</h2>
            <div className="text-caption text-white/50">
              {tracks.length} tracks
            </div>
          </div>

          {/* Timeline content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Ruler */}
            <div className="h-8 border-b border-white/10">
              <Ruler />
            </div>

            {/* Tracks area */}
            <div className="flex-1 relative overflow-auto scrollbar-starscape">
              {/* Playhead */}
              <Playhead />
              
              {/* Tracks */}
              <div className="space-y-xs p-sm">
                {tracks.map((track) => (
                  <Track key={track.id} trackId={track.id} />
                ))}
              </div>
            </div>

            {/* Transport controls */}
            <div className="border-t border-white/10">
              <TransportControls />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
