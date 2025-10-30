import { useUiStore } from "@/store/uiStore";
import { ChevronRight, Contrast, Palette, Droplet, Lightbulb, Wind, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EffectsPane() {
  const { setRightPaneCollapsed } = useUiStore();

  // Stub effect data
  const effects = [
    { id: 'brightness', name: 'Brightness', icon: Lightbulb },
    { id: 'contrast', name: 'Contrast', icon: Contrast },
    { id: 'saturation', name: 'Saturation', icon: Palette },
    { id: 'blur', name: 'Blur', icon: Wind },
    { id: 'color', name: 'Color', icon: Droplet },
    { id: 'glow', name: 'Glow', icon: Zap },
  ];

  return (
    <div className="h-full flex flex-col bg-mid-navy border-l border-light-blue/20 w-[300px]">
      {/* Header */}
      <div className="flex items-center justify-between p-md border-b border-white/10">
        <h2 className="text-h3 font-semibold text-light-blue">Effects</h2>
        <button
          onClick={() => setRightPaneCollapsed(true)}
          className="text-white/50 hover:text-white transition-colors"
          title="Collapse effects pane"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Content - 2 column grid of effect buttons */}
      <div className="flex-1 overflow-y-auto p-md">
        <div className="grid grid-cols-2 gap-sm">
          {effects.map((effect) => {
            const Icon = effect.icon;
            return (
              <Button
                key={effect.id}
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-xs bg-dark-navy/50 border-light-blue/20 hover:bg-light-blue/10 hover:border-light-blue/40 transition-all"
                onClick={() => console.log('Effect clicked:', effect.name)}
              >
                <Icon className="h-6 w-6 text-light-blue" />
                <span className="text-caption text-white/90">{effect.name}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
