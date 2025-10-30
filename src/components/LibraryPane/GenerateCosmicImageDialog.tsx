import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { generateCosmicImage, revealInFinder, deleteFile } from "@/lib/bindings";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

interface GenerateCosmicImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type GenerationState = 'idle' | 'generating' | 'success';

export function GenerateCosmicImageDialog({ open, onOpenChange }: GenerateCosmicImageDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [generationState, setGenerationState] = useState<GenerationState>('idle');
  const [generatedImagePath, setGeneratedImagePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { addAssetsFromPaths } = useProjectStore();
  const { setActiveLeftPaneTab } = useUiStore();

  // Reset state when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setPrompt("");
      setGenerationState('idle');
      setGeneratedImagePath(null);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setError(null);
    setGenerationState('generating');
    setGeneratedImagePath(null);

    try {
      const result = await generateCosmicImage(prompt.trim());
      if (result.success && result.path) {
        setGeneratedImagePath(result.path);
        setGenerationState('success');
      } else {
        throw new Error("Failed to generate image");
      }
    } catch (err) {
      console.error('Error generating image:', err);
      setError(err instanceof Error ? err.message : "Failed to generate image. Please try again.");
      setGenerationState('idle');
    }
  };

  const handleImport = async () => {
    if (!generatedImagePath) return;

    try {
      await addAssetsFromPaths([generatedImagePath]);
      // Delete the temporary file after successful import
      try {
        await deleteFile(generatedImagePath);
      } catch (deleteError) {
        console.warn('Failed to delete temporary file:', deleteError);
        // Don't block the import if deletion fails
      }
      handleOpenChange(false);
      setActiveLeftPaneTab('library');
    } catch (err) {
      console.error('Error importing image:', err);
      setError("Failed to import image to library.");
    }
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl min-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-h3 font-semibold text-white">
            Generate Cosmic Image
          </DialogTitle>
          {generationState !== 'success' && (
            <DialogDescription className="text-body text-white/70">
              Describe what you'd like to see. We'll add a celestial theme with space, nebulas, starfields, or other cosmic elements.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-lg py-4">
          {/* Prompt Input */}
          {generationState !== 'success' && (
            <div className="space-y-sm">
              <label htmlFor="prompt" className="text-sm font-medium text-white/80">
                Prompt
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., a distant planet with rings, or a swirling galaxy"
                rows={4}
                className={cn(
                  "w-full rounded-md px-4 py-3",
                  "bg-white/10 border-2 border-white/10",
                  "text-white placeholder:text-white/50",
                  "transition-all duration-200",
                  "focus-visible:bg-white focus-visible:text-dark-navy",
                  "focus-visible:border-deep-blue focus-visible:shadow-subtle",
                  "focus-visible:outline-none",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "resize-none"
                )}
                disabled={generationState === 'generating'}
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-md p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Generated Image Preview */}
          {generationState === 'success' && generatedImagePath && (
            <div className="space-y-sm">
              <div className="space-y-xs">
                <label className="text-xs font-medium text-white/60 uppercase tracking-wide">
                  Your Prompt
                </label>
                <p className="text-body text-white/90 italic">
                  {prompt}
                </p>
              </div>
              <label className="text-sm font-medium text-white/80">
                Generated Image
              </label>
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <img
                  src={`media://${generatedImagePath}`}
                  alt="Generated cosmic image"
                  className="w-full h-auto rounded-md max-h-96 object-contain"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-sm pt-2">
            {generationState === 'idle' && (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  variant="gradient"
                  onClick={handleGenerate}
                  disabled={!prompt.trim()}
                >
                  Generate
                </Button>
              </>
            )}
            
            {generationState === 'generating' && (
              <Button variant="gradient" disabled>
                Generating...
              </Button>
            )}

            {generationState === 'success' && (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (generatedImagePath) {
                      await revealInFinder(generatedImagePath);
                    }
                  }}
                >
                  Reveal in Finder
                </Button>
                <Button
                  variant="gradient"
                  onClick={handleImport}
                >
                  Import
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

