import { useState, useEffect } from "react";
import { LibraryGrid } from "./LibraryGrid";
import { UploadModal } from "./UploadModal";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/uiStore";
import { ChevronLeft } from "lucide-react";

export function LibraryPane() {
  const [showUploadModal, setShowUploadModal] = useState(false);
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
          <button
            onClick={() => setLeftPaneCollapsed(true)}
            className="text-white/50 hover:text-white transition-colors"
            title="Collapse media library pane"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
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
      />
    </>
  );
}
