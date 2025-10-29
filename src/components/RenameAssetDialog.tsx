import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjectStore } from "@/store/projectStore";

interface RenameAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string | null;
}

export function RenameAssetDialog({ open, onOpenChange, assetId }: RenameAssetDialogProps) {
  const { getAssetById, renameAsset } = useProjectStore();
  const asset = assetId ? getAssetById(assetId) : null;

  const [newName, setNewName] = useState<string>("");

  // Update the name when the asset changes
  useEffect(() => {
    if (asset) {
      setNewName(asset.name);
    }
  }, [asset]);

  const handleSave = () => {
    if (assetId && newName.trim()) {
      renameAsset(assetId, newName.trim());
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    // Reset to original name
    if (asset) {
      setNewName(asset.name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl min-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-h3 font-semibold gradient-text">
            Rename Asset
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-lg">
          {/* Filename Input */}
          <div className="space-y-sm">
            <label className="text-body-small text-white/70">Asset Name</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-white/10 border-white/20 text-white"
              placeholder="Enter asset name"
              autoFocus
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-sm">
            <Button
              variant="outline"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              variant="gradient"
              onClick={handleSave}
              disabled={!newName.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

