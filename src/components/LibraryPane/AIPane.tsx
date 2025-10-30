import { useState } from "react";
import { useUiStore } from "@/store/uiStore";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { GenerateCosmicImageDialog } from "./GenerateCosmicImageDialog";

export function AIPane() {
  const { setLeftPaneCollapsed } = useUiStore();
  
  // Generate cosmic image dialog state
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);

  return (
    <>
      <div className="h-full flex flex-col bg-mid-navy border-r border-light-blue/20 w-[300px]">
        {/* Header */}
        <div className="flex items-center justify-between p-md border-b border-white/10">
          <h2 className="text-h3 font-semibold text-light-blue">AI</h2>
          <button
            onClick={() => setLeftPaneCollapsed(true)}
            className="text-white/50 hover:text-white transition-colors"
            title="Collapse AI pane"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-md space-y-md">
          {/* AI Generation Section */}
          <div className="space-y-sm">
            <h3 className="text-sm font-semibold text-white/80">Image Generation</h3>
            <Button
              onClick={() => setGenerateDialogOpen(true)}
              className="w-full py-2 bg-gradient-cyan-purple text-white hover:opacity-90 rounded transition-all"
            >
              ✨ Generate Cosmic Image
            </Button>
          </div>
        </div>
      </div>

      {/* Generate Cosmic Image Dialog */}
      <GenerateCosmicImageDialog 
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
      />
    </>
  );
}

