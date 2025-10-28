import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Settings } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";

export function TopBar() {
  const { projectName, updateProjectName } = useProjectStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(projectName);

  const handleNameClick = () => {
    setIsEditingName(true);
    setTempName(projectName);
  };

  const handleNameSubmit = () => {
    if (tempName.trim()) {
      updateProjectName(tempName.trim());
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setTempName(projectName);
      setIsEditingName(false);
    }
  };

  const handleExport = () => {
    console.log('Export project:', projectName);
    // TODO: Open export modal
  };

  return (
    <header className="h-full bg-dark-navy border-b border-light-blue/20 flex items-center justify-between px-lg shadow-default z-header">
      {/* Left: Project name */}
      <div className="flex items-center space-x-md">
        <div className="w-8 h-8 bg-gradient-cyan-vibrant rounded-md flex items-center justify-center">
          <span className="text-white font-bold text-sm">S</span>
        </div>
        
        {isEditingName ? (
          <Input
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleNameKeyDown}
            className="h-8 px-sm text-h3 font-semibold bg-transparent border-none shadow-none focus:bg-white/10 focus:border-light-blue"
            autoFocus
          />
        ) : (
          <h1 
            className="text-h3 font-semibold gradient-text cursor-pointer hover:text-light-blue transition-colors"
            onClick={handleNameClick}
          >
            {projectName}
          </h1>
        )}
      </div>

      {/* Center: Last edited timestamp (placeholder) */}
      <div className="text-body-small text-white/50">
        Last edited: Just now
      </div>

      {/* Right: Actions */}
      <div className="flex items-center space-x-sm">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-light-blue/20"
        >
          <Settings className="h-5 w-5" />
        </Button>
        
        <Button
          variant="gradient"
          onClick={handleExport}
          className="flex items-center space-x-sm"
        >
          <Download className="h-4 w-4" />
          <span>Export</span>
        </Button>
      </div>
    </header>
  );
}
