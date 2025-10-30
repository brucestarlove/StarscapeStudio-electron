import { Button } from "@/components/ui/button";
import { Wand2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/uiStore";
import type { RightPaneTab } from "@/store/uiStore";

export function RightRail() {
  const { rightPaneCollapsed, setRightPaneCollapsed, activeRightPaneTab, setActiveRightPaneTab } = useUiStore();

  const tabs = [
    { id: 'transitions' as const, icon: Sparkles, label: 'Transitions', disabled: false },
    { id: 'effects' as const, icon: Wand2, label: 'Effects', disabled: false },
  ];

  const handleTabClick = (tabId: RightPaneTab) => {
    // If clicking the active tab and pane is expanded, collapse it
    if (activeRightPaneTab === tabId && !rightPaneCollapsed) {
      setRightPaneCollapsed(true);
    } else {
      // Otherwise, set as active tab and expand pane
      setActiveRightPaneTab(tabId);
      setRightPaneCollapsed(false);
    }
  };

  return (
    <nav className="h-full w-full bg-dark-navy border-l border-light-blue/20 flex flex-col items-center py-lg space-y-sm">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeRightPaneTab === tab.id;
        
        return (
          <Button
            key={tab.id}
            variant="ghost"
            size="icon"
            disabled={tab.disabled}
            onClick={() => handleTabClick(tab.id)}
            className={cn(
              "w-12 h-12 rounded-lg transition-all duration-200",
              isActive 
                ? "bg-gradient-cyan-purple text-white shadow-default" 
                : "text-white/70 hover:text-white hover:bg-light-blue/20",
              tab.disabled && "opacity-50 cursor-not-allowed"
            )}
            title={tab.label}
          >
            <Icon className="h-5 w-5" />
          </Button>
        );
      })}
    </nav>
  );
}

