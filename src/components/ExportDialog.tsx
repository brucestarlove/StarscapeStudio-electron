import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, X, CheckCircle } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { exportProject, listenExportProgress, revealInFinder, type ExportSettings, type ProgressEvent } from "@/lib/bindings";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const { id, projectName, assets, tracks, clips, canvasNodes } = useProjectStore();
  
  // Export settings state
  const [settings, setSettings] = useState<ExportSettings>({
    format: 'mp4',
    width: 1920,
    height: 1080,
    fps: 30,
    bitrate: 5000,
  });
  
  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [exportResult, setExportResult] = useState<{ path: string; success: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Filename state - initialize with cleaned project name
  const [filename, setFilename] = useState<string>(
    `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_export`
  );

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setError(null);
      setProgress(null);
      setExportResult(null);

      // Transform project state to backend format
      // Backend expects: { id, assets: {}, clips: {}, tracks: {} }
      // where tracks have clipOrder and role fields
      const backendAssets: Record<string, any> = {};
      assets.forEach(asset => {
        // Convert media:// URL to file path
        let srcPath = asset.url;
        if (srcPath.startsWith('media://')) {
          srcPath = srcPath.replace('media://', '');
        }
        
        backendAssets[asset.id] = {
          id: asset.id,
          src: srcPath,
          duration_ms: asset.duration,
          width: asset.metadata.width,
          height: asset.metadata.height,
        };
      });
      
      const backendClips: Record<string, any> = {};
      Object.values(clips).forEach(clip => {
        backendClips[clip.id] = {
          id: clip.id,
          assetId: clip.assetId,
          inMs: clip.trimStartMs,    // Trim start in source
          outMs: clip.trimEndMs,      // Trim end in source
          startMs: clip.startMs,      // Position on timeline
          endMs: clip.endMs,          // Position on timeline
        };
      });
      
      const backendTracks: Record<string, any> = {};
      // Find first video track to determine main track
      const firstVideoTrack = tracks.find(t => t.type === 'video');
      
      tracks.forEach((track) => {
        // First video track is 'main', subsequent video tracks are 'overlay' (PiP)
        // Audio tracks are 'overlay' (they'll be mixed together)
        let role: string;
        if (track.type === 'video') {
          role = track.id === firstVideoTrack?.id ? 'main' : 'overlay';
        } else {
          role = 'overlay';
        }
        
        backendTracks[track.id] = {
          id: track.id,
          name: track.name,
          type: track.type,
          role: role,
          clipOrder: track.clips,
        };
      });

      // Create project JSON in backend format
      // Include canvasNodes for PiP transforms
      const backendCanvasNodes: Record<string, any> = {};
      Object.values(canvasNodes).forEach(node => {
        backendCanvasNodes[node.id] = {
          id: node.id,
          clipId: node.clipId,
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
          rotation: node.rotation,
          opacity: node.opacity,
        };
      });

      const projectJson = JSON.stringify({
        id,
        projectName,
        assets: backendAssets,
        clips: backendClips,
        tracks: backendTracks,
        canvasNodes: backendCanvasNodes,
      });

      // Set up progress listener
      const cleanup = await listenExportProgress((event) => {
        setProgress(event);
      });

      // Start export
      const result = await exportProject(projectJson, { ...settings, filename });
      
      cleanup();
      setExportResult({ path: result.path, success: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    if (!isExporting) {
      onOpenChange(false);
      // Reset state
      setProgress(null);
      setExportResult(null);
      setError(null);
    }
  };

  const formatOptions = [
    { value: 'mp4', label: 'MP4' },
    { value: 'mov', label: 'MOV' },
  ];

  const resolutionOptions = [
    { value: '720p', label: '720p (1280x720)', width: 1280, height: 720 },
    { value: '1080p', label: '1080p (1920x1080)', width: 1920, height: 1080 },
    { value: 'source', label: 'Source Resolution', width: -1, height: -1 }, // -1 indicates source resolution
  ];

  const qualityOptions = [
    { value: 'low', label: 'Low (2 Mbps)', bitrate: 2000 },
    { value: 'medium', label: 'Medium (5 Mbps)', bitrate: 5000 },
    { value: 'high', label: 'High (10 Mbps)', bitrate: 10000 },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl min-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-h3 font-semibold gradient-text">
            Export Video
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-lg">
          {/* Export Settings */}
          {!isExporting && !exportResult && (
            <>
              {/* Format */}
              <div className="space-y-sm">
                <label className="text-body-small text-white/70">Format</label>
                <div className="flex space-x-sm">
                  {formatOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant={settings.format === option.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSettings(prev => ({ ...prev, format: option.value as 'mp4' | 'mov' }))}
                      className="flex-1"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Resolution */}
              <div className="space-y-sm">
                <label className="text-body-small text-white/70">Resolution</label>
                <div className="space-y-xs">
                  {resolutionOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant={settings.width === option.width && settings.height === option.height ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSettings(prev => ({ 
                        ...prev, 
                        width: option.width, 
                        height: option.height 
                      }))}
                      className="w-full justify-start"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Quality */}
              <div className="space-y-sm">
                <label className="text-body-small text-white/70">Quality</label>
                <div className="space-y-xs">
                  {qualityOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant={settings.bitrate === option.bitrate ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSettings(prev => ({ ...prev, bitrate: option.bitrate }))}
                      className="w-full justify-start"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Filename */}
              <div className="space-y-sm">
                <label className="text-body-small text-white/70">Filename</label>
                <Input
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  className="bg-white/10 border-white/20 text-white"
                  placeholder="Export filename"
                />
              </div>
            </>
          )}

          {/* Export Progress */}
          {isExporting && (
            <div className="space-y-md">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-light-blue mb-sm"></div>
                <p className="text-body text-white/70">Exporting video...</p>
              </div>
              
              {progress && (
                <div className="space-y-sm">
                  <div className="flex justify-between text-caption text-white/70">
                    <span>{progress.message}</span>
                    <span>{progress.current}/{progress.total}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div 
                      className="bg-gradient-cyan-purple h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Export Success */}
          {exportResult && exportResult.success && (
            <div className="text-center space-y-md py-4">
              <CheckCircle className="h-16 w-16 text-green-400 mx-auto" />
              <div>
                <p className="text-h4 text-white mb-md font-semibold">Export completed successfully!</p>
                <div className="bg-white/5 rounded-lg p-md border border-white/10">
                  <p className="text-caption text-white/70 break-all text-left font-mono">
                    {exportResult.path}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Export Error */}
          {error && (
            <div className="text-center space-y-md py-4">
              <X className="h-16 w-16 text-red-400 mx-auto" />
              <div>
                <p className="text-h4 text-white mb-md font-semibold">Export failed</p>
                <div className="bg-red-500/10 rounded-lg p-md border border-red-500/30">
                  <p className="text-caption text-red-400 break-words">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-sm">
            {!isExporting && !exportResult && (
              <>
                <Button
                  variant="outline"
                  onClick={handleClose}
                >
                  Cancel
                </Button>
                <Button
                  variant="gradient"
                  onClick={handleExport}
                  className="flex items-center space-x-sm"
                >
                  <Download className="h-4 w-4" />
                  <span>Export</span>
                </Button>
              </>
            )}
            
            {exportResult && exportResult.success && (
              <>
                <Button
                  variant="outline"
                  onClick={handleClose}
                >
                  Close
                </Button>
                <Button
                  variant="gradient"
                  onClick={async () => {
                    try {
                      // Remove file:// protocol if present
                      const filePath = exportResult.path.replace(/^file:\/\//, '');
                      await revealInFinder(filePath);
                      handleClose();
                    } catch (err) {
                      console.error('Failed to reveal in finder:', err);
                    }
                  }}
                >
                  Open in Finder
                </Button>
              </>
            )}
            
            {error && (
              <Button
                variant="gradient"
                onClick={handleClose}
              >
                Close
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
