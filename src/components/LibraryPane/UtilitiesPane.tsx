import { useState, useEffect } from "react";
import { startScreenRecord, stopScreenRecord, listenStartRecording, listenStopRecording, saveBlobToFile, revealInFinder } from "@/lib/bindings";
import { useUiStore } from "@/store/uiStore";
import { useProjectStore } from "@/store/projectStore";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, ChevronLeft } from "lucide-react";

export function UtilitiesPane() {
  const { setLeftPaneCollapsed, setActiveLeftPaneTab } = useUiStore();
  
  // Screen recording state
  const [recordingId, setRecordingId] = useState<string>("");
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const [logs, setLogs] = useState<string>("");
  
  // Success modal state
  const [recordingSuccess, setRecordingSuccess] = useState<{ path: string } | null>(null);

  // Append log message for debugging
  const append = (msg: unknown) => setLogs((l) => l + "\n" + JSON.stringify(msg));

  // Set up recording event listeners
  useEffect(() => {
    let startUnlisten: (() => void) | undefined;
    let stopUnlisten: (() => void) | undefined;

    const setupListeners = async () => {
      startUnlisten = await listenStartRecording(async (event) => {
        try {
          append({ recordingEvent: 'start', ...event });
          
          // Get the screen source
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: event.sourceId,
                minWidth: 1280,
                maxWidth: 1920,
                minHeight: 720,
                maxHeight: 1080,
                minFrameRate: event.settings.fps || 30,
                maxFrameRate: event.settings.fps || 30
              }
            } as any
          });

          setRecordingStream(stream);

          // Create MediaRecorder
          const recorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9'
          });

          const chunks: Blob[] = [];
          
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunks.push(e.data);
            }
          };

          recorder.onstop = async () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            
            try {
              // Convert blob to ArrayBuffer
              const arrayBuffer = await blob.arrayBuffer();
              
              // Save to the specified path
              const result = await saveBlobToFile(arrayBuffer, event.outputPath);
              append({ recordingStopped: { recordingId: event.recordingId, blobSize: blob.size, savedPath: result.path } });
              setRecordingSuccess({ path: result.path });
            } catch (error) {
              append({ recordingError: `Failed to save recording: ${error}` });
            }
            
            // Clean up
            if (recordingStream) {
              recordingStream.getTracks().forEach(track => track.stop());
              setRecordingStream(null);
            }
            setMediaRecorder(null);
          };

          setMediaRecorder(recorder);
          recorder.start(1000); // Record in 1-second chunks
          
        } catch (error) {
          append({ recordingError: String(error) });
        }
      });

      stopUnlisten = await listenStopRecording((event) => {
        try {
          append({ recordingEvent: 'stop', ...event });
          
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
          
        } catch (error) {
          append({ recordingError: String(error) });
        }
      });
    };

    setupListeners();

    return () => {
      if (startUnlisten) startUnlisten();
      if (stopUnlisten) stopUnlisten();
    };
  }, [mediaRecorder, recordingStream]);

  // Handle screen recording toggle
  const handleRecordToggle = async () => {
    try {
      if (!recordingId) {
        const { recordingId: id, outPath } = await startScreenRecord({ 
          fps: 30, 
          display_index: 0,
          audio_index: 0
        });
        setRecordingId(id);
        append({ recordingStarted: { id, outPath } });
      } else {
        const outPath = await stopScreenRecord(recordingId);
        append({ recordingStopped: { recordingId, outPath } });
        setRecordingId("");
      }
    } catch (e) {
      append({ error: String(e) });
    }
  };

  return (
    <>
      <div className="h-full flex flex-col bg-mid-navy border-r border-light-blue/20 w-[300px]">
        {/* Header */}
        <div className="flex items-center justify-between p-md border-b border-white/10">
          <h2 className="text-h3 font-semibold text-light-blue">Utilities</h2>
          <button
            onClick={() => setLeftPaneCollapsed(true)}
            className="text-white/50 hover:text-white transition-colors"
            title="Collapse utilities pane"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-md space-y-md">
            {/* Screen Recording Section */}
            <div className="space-y-sm">
              <h3 className="text-sm font-semibold text-white/80">Screen Recording</h3>
              <Button
                onClick={handleRecordToggle}
                className={`w-full py-2 rounded transition-all ${
                  recordingId 
                    ? 'bg-red-600/80 hover:bg-red-600 text-white' 
                    : 'bg-gradient-cyan-purple text-white hover:opacity-90'
                }`}
              >
                {recordingId ? '⏹ Stop Recording' : '⏥ Start Recording'}
              </Button>
            </div>

            {/* Other Utilities (Disabled for now) */}
            <div className="space-y-sm">
              <h3 className="text-sm font-semibold text-white/80">Coming Soon™️</h3>
              <Button
                disabled
                className="w-full py-2 bg-white/10 text-white/50 rounded cursor-not-allowed"
              >
                Webcam Recording
              </Button>
              <Button
                disabled
                className="w-full py-2 bg-white/10 text-white/50 rounded cursor-not-allowed"
              >
                Screen + Webcam Recording
              </Button>
              <Button
                disabled
                className="w-full py-2 bg-white/10 text-white/50 rounded cursor-not-allowed"
              >
                Microphone Recording
              </Button>
            </div>

            {/* Debug Logs */}
            {logs && (
              <div className="space-y-sm pt-md border-t border-white/10">
                <h3 className="text-xs font-semibold text-white/60">Debug Logs</h3>
                <pre className="bg-black/40 p-xs rounded text-xs text-white/70 max-h-32 overflow-auto whitespace-pre-wrap break-words">
                  {logs}
                </pre>
              </div>
            )}
        </div>
      </div>

      {/* Success Modal */}
      {recordingSuccess && (
        <Dialog open={!!recordingSuccess} onOpenChange={() => setRecordingSuccess(null)}>
          <DialogContent className="max-w-xxl min-w-[600px]">
            <DialogHeader>
              <DialogTitle className="text-h3 font-semibold gradient-text">
                Recording Saved
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-lg">
              <div className="text-center space-y-md py-4">
                <CheckCircle className="h-16 w-16 text-green-400 mx-auto" />
                <div>
                  <p className="text-h4 text-white mb-md font-semibold">Recording saved successfully!</p>
                  <div className="bg-white/5 rounded-lg p-md border border-white/10">
                    <p className="text-caption text-white/70 break-all text-left font-mono">
                      {recordingSuccess.path}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-sm">
                <Button
                  variant="outline"
                  onClick={() => setRecordingSuccess(null)}
                >
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    // Import the recording to the project library
                    const { addAssetsFromPaths } = useProjectStore.getState();
                    try {
                      await addAssetsFromPaths([recordingSuccess.path]);
                      setRecordingSuccess(null);
                      setActiveLeftPaneTab('library');
                    } catch (error) {
                      console.error('Error importing recording:', error);
                    }
                  }}
                >
                  Import to Library
                </Button>
                <Button
                  variant="gradient"
                  onClick={async () => {
                    await revealInFinder(recordingSuccess.path);
                  }}
                >
                  Open in Finder
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
