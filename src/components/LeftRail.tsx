import { Button } from "@/components/ui/button";
import { FolderOpen, Wrench, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/uiStore";
import type { LeftPaneTab } from "@/store/uiStore";

export function LeftRail() {
  const { leftPaneCollapsed, setLeftPaneCollapsed, activeLeftPaneTab, setActiveLeftPaneTab } = useUiStore();

  const tabs = [
    { id: 'library' as const, icon: FolderOpen, label: 'Library', disabled: false },
    { id: 'utilities' as const, icon: Wrench, label: 'Utilities', disabled: false },
    { id: 'ai' as const, icon: Sparkles, label: 'AI', disabled: false },
  ];

  const handleTabClick = (tabId: LeftPaneTab) => {
    // If clicking the active tab and pane is expanded, collapse it
    if (activeLeftPaneTab === tabId && !leftPaneCollapsed) {
      setLeftPaneCollapsed(true);
    } else {
      // Otherwise, set as active tab and expand pane
      setActiveLeftPaneTab(tabId);
      setLeftPaneCollapsed(false);
    }
  };

  return (
    <nav className="h-full w-full bg-dark-navy border-r border-light-blue/20 flex flex-col items-center py-lg space-y-sm">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeLeftPaneTab === tab.id;
        
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
