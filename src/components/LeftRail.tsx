import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpen, Zap, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/uiStore";

type RailTab = 'library' | 'effects' | 'export';

export function LeftRail() {
  const [activeTab, setActiveTab] = useState<RailTab>('library');
  const { setLeftPaneCollapsed } = useUiStore();

  const tabs = [
    { id: 'library' as const, icon: FolderOpen, label: 'Library', disabled: false },
    { id: 'effects' as const, icon: Zap, label: 'Effects', disabled: true },
    { id: 'export' as const, icon: Download, label: 'Export', disabled: false },
  ];

  const handleTabClick = (tabId: RailTab) => {
    setActiveTab(tabId);
    if (tabId === 'library') setLeftPaneCollapsed(false);
  };

  return (
    <nav className="h-full w-full bg-dark-navy border-r border-light-blue/20 flex flex-col items-center py-lg space-y-sm">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
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
