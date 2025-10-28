import { useRef, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { cn } from "@/lib/utils";

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadModal({ open, onOpenChange }: UploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const { addAssets, addAssetsFromPaths } = useProjectStore();

  // Handle native file drop events from outside the app
  useEffect(() => {
    const handleNativeDrop = (event: DragEvent) => {
      // Only handle drops when the modal is open
      if (!open) return;
      
      event.preventDefault();
      event.stopPropagation();
      
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) {
        // Check if files are from external sources (not from within the app)
        const isExternalDrop = event.dataTransfer?.effectAllowed === 'all' || 
                              event.dataTransfer?.dropEffect === 'copy';
        
        if (isExternalDrop) {
          handleExternalFileDrop(files);
        }
      }
    };

    const handleNativeDragOver = (event: DragEvent) => {
      if (!open) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const handleNativeDragEnter = (event: DragEvent) => {
      if (!open) return;
      event.preventDefault();
      event.stopPropagation();
    };

    // Add global event listeners for native drag and drop
    document.addEventListener('drop', handleNativeDrop);
    document.addEventListener('dragover', handleNativeDragOver);
    document.addEventListener('dragenter', handleNativeDragEnter);

    return () => {
      document.removeEventListener('drop', handleNativeDrop);
      document.removeEventListener('dragover', handleNativeDragOver);
      document.removeEventListener('dragenter', handleNativeDragEnter);
    };
  }, [open]);

  const handleExternalFileDrop = async (files: FileList) => {
    setIsUploading(true);
    try {
      // Convert FileList to file paths for backend ingestion
      const filePaths: string[] = [];
      
      // For external files, we need to get their paths
      // This is a limitation of web APIs - we can't get file paths directly
      // We'll fall back to the existing File API approach for now
      await addAssets(Array.from(files));
      onOpenChange(false);
    } catch (error) {
      console.error('Error uploading external files:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      await addAssets(Array.from(files));
      onOpenChange(false);
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setIsUploading(false);
      setIsDragging(false);
      setDragCounter(0);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((c) => c + 1);
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((c) => {
      const next = Math.max(0, c - 1);
      if (next === 0) setIsDragging(false);
      return next;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
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
          {/* Drag and drop area */}
          <div
            className={cn(
              "border-2 border-dashed rounded-xl p-xl text-center transition-all duration-200",
              isDragging
                ? "border-light-blue bg-light-blue/10"
                : "border-white/30 hover:border-light-blue/50"
            )}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 text-white/50 mx-auto mb-md" />
            <p className="text-body text-white mb-sm">
              Drag and drop files here, or
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

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="video/*,audio/*,image/*"
            onChange={handleFileInputChange}
            className="hidden"
          />

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
