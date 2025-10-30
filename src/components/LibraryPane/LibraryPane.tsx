import { useState, useEffect } from "react";
import { LibraryGrid } from "./LibraryGrid";
import { UploadModal } from "./UploadModal";
import { useUiStore } from "@/store/uiStore";
import { ChevronLeft, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function LibraryPane() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [duplicateAsset, setDuplicateAsset] = useState<string | null>(null);
  const { leftPaneCollapsed, setLeftPaneCollapsed } = useUiStore();

  // Ensure pane is visible when upload modal is opened
  useEffect(() => {
    if (showUploadModal && leftPaneCollapsed) setLeftPaneCollapsed(false);
  }, [showUploadModal, leftPaneCollapsed, setLeftPaneCollapsed]);

  return (
    <>
      <div className="h-full flex flex-col bg-mid-navy border-r border-light-blue/20 w-[300px]">
        {/* Header */}
        <div className="flex items-center justify-between p-md border-b border-white/10">
          <h2 className="text-h3 font-semibold text-light-blue">Media Library</h2>
          <div className="flex items-center gap-sm">
            {/* Collapse button */}
            <button
              onClick={() => setLeftPaneCollapsed(true)}
              className="text-white/50 hover:text-white transition-colors"
              title="Collapse media library pane"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <LibraryGrid onUploadClick={() => setShowUploadModal(true)} />
        </div>
      </div>

      {/* Upload Modal */}
      <UploadModal 
        open={showUploadModal} 
        onOpenChange={setShowUploadModal}
        onDuplicateDetected={setDuplicateAsset}
      />

      {/* Duplicate Asset Warning Dialog */}
      <Dialog open={!!duplicateAsset} onOpenChange={() => setDuplicateAsset(null)}>
        <DialogContent className="max-w-sm min-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-sm text-h3 font-semibold text-white">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
              Asset Already Exists
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-lg py-2">
            <p className="text-body text-white/70">
              An asset with the filename <span className="font-mono text-light-blue">{duplicateAsset}</span> already exists in your project.
            </p>

            <div className="flex justify-end pt-2">
              <Button
                variant="gradient"
                onClick={() => setDuplicateAsset(null)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
