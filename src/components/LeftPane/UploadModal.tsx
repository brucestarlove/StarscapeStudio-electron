import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { openFileDialog } from "@/lib/bindings";

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadModal({ open, onOpenChange }: UploadModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { addAssetsFromPaths } = useProjectStore();

  const handleUploadClick = async () => {
    setIsUploading(true);
    try {
      const result = await openFileDialog();
      if (result.filePaths && result.filePaths.length > 0) {
        await addAssetsFromPaths(result.filePaths);
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error selecting files:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-h3 font-semibold gradient-text">
            Upload Media Files
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-lg">
          {/* Upload area */}
          <div
            className="border-2 border-dashed rounded-xl p-xl text-center transition-all duration-200 border-white/30 hover:border-light-blue/50"
          >
            <Upload className="h-12 w-12 text-white/50 mx-auto mb-md" />
            <p className="text-body text-white mb-sm">
              Click to select files
            </p>
            <Button
              variant="outline"
              onClick={handleUploadClick}
              disabled={isUploading}
            >
              Choose Files
            </Button>
            <p className="text-caption text-white/50 mt-sm">
              Supports MP4, MOV, MP3, WAV, JPG, PNG
            </p>
          </div>

          {/* Upload status */}
          {isUploading && (
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-light-blue mb-sm"></div>
              <p className="text-body-small text-white/70">Processing files...</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-sm">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
