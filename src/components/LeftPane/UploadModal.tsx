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
      <DialogContent className="max-w-xl min-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-h3 font-semibold gradient-text">
            Upload Media Files
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-lg py-2">
          {/* Upload area */}
          <div
            className="border-2 border-dashed rounded-xl p-2xl text-center transition-all duration-200 border-white/30 hover:border-light-blue/50 bg-white/5 hover:bg-white/10"
          >
            <Upload className="h-16 w-16 text-white/50 mx-auto mb-lg" />
            <p className="text-h4 text-white mb-md font-medium">
              Click to select files
            </p>
            <Button
              variant="gradient"
              size="lg"
              onClick={handleUploadClick}
              disabled={isUploading}
              className="mb-md"
            >
              Choose Files
            </Button>
            <p className="text-body-small text-white/50 mt-md">
              Supports MP4, MOV, MP3, WAV, JPG, PNG
            </p>
          </div>

          {/* Upload status */}
          {isUploading && (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-light-blue mb-md"></div>
              <p className="text-body text-white/70">Processing files...</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-sm pt-2">
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
