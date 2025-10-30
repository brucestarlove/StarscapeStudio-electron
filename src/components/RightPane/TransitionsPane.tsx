import { useUiStore } from "@/store/uiStore";
import { ChevronRight, ArrowRightLeft, Blend, Expand, ZoomIn, Split, Grid3x3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TransitionsPane() {
  const { setRightPaneCollapsed } = useUiStore();

  // Stub transition data
  const transitions = [
    { id: 'fade', name: 'Fade', icon: Blend },
    { id: 'dissolve', name: 'Dissolve', icon: Expand },
    { id: 'wipe', name: 'Wipe', icon: ArrowRightLeft },
    { id: 'zoom', name: 'Zoom', icon: ZoomIn },
    { id: 'slide', name: 'Slide', icon: Split },
    { id: 'cross', name: 'Cross', icon: Grid3x3 },
  ];

  return (
    <div className="h-full flex flex-col bg-mid-navy border-l border-light-blue/20 w-[300px]">
      {/* Header */}
      <div className="flex items-center justify-between p-md border-b border-white/10">
        <h2 className="text-h3 font-semibold text-light-blue">Transitions</h2>
        <button
          onClick={() => setRightPaneCollapsed(true)}
          className="text-white/50 hover:text-white transition-colors"
          title="Collapse transitions pane"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Content - 2 column grid of transition buttons */}
      <div className="flex-1 overflow-y-auto p-md">
        <div className="grid grid-cols-2 gap-sm">
          {transitions.map((transition) => {
            const Icon = transition.icon;
            return (
              <Button
                key={transition.id}
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-xs bg-dark-navy/50 border-light-blue/20 hover:bg-light-blue/10 hover:border-light-blue/40 transition-all"
                onClick={() => console.log('Transition clicked:', transition.name)}
              >
                <Icon className="h-6 w-6 text-light-blue" />
                <span className="text-caption text-white/90">{transition.name}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

