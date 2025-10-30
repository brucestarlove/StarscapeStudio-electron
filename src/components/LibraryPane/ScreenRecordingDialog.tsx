import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Monitor, Circle } from "lucide-react";
import { startScreenRecord, stopScreenRecord, listenStartRecording, listenStopRecording, saveBlobToFile, revealInFinder, deleteFile } from "@/lib/bindings";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";

interface ScreenRecordingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type RecordingState = 'setup' | 'recording' | 'success';

export function ScreenRecordingDialog({ open, onOpenChange }: ScreenRecordingDialogProps) {
  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>('setup');
  const [recordingId, setRecordingId] = useState<string>("");
  const [, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const [recordingSuccess, setRecordingSuccess] = useState<{ path: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Recording duration
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const recordingStartTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  
  const { setActiveLeftPaneTab } = useUiStore();

  // Set up recording event listeners
  useEffect(() => {
    let startUnlisten: (() => void) | undefined;
    let stopUnlisten: (() => void) | undefined;

    const setupListeners = async () => {
      startUnlisten = await listenStartRecording(async (event) => {
        try {
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
          recordingStreamRef.current = stream;

          // Set up video preview
          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = stream;
            await videoPreviewRef.current.play();
          }

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
              
              // Extract just the filename from the full path (saveBlobToFile expects just filename)
              // event.outputPath is a full path like "/path/to/cache/captures/screen_recording_123.webm"
              // We need just "screen_recording_123.webm"
              const filename = event.outputPath.split('/').pop() || `screen_recording_${Date.now()}.webm`;
              
              // Save to the specified path
              const result = await saveBlobToFile(arrayBuffer, filename);
              setRecordingSuccess({ path: result.path });
              setRecordingState('success');
              stopDurationTimer();
            } catch (error) {
              setError(`Failed to save recording: ${error}`);
              setRecordingState('setup');
            }
            
            // Clean up
            if (recordingStreamRef.current) {
              recordingStreamRef.current.getTracks().forEach(track => track.stop());
              recordingStreamRef.current = null;
              setRecordingStream(null);
            }
            if (videoPreviewRef.current) {
              videoPreviewRef.current.srcObject = null;
            }
            mediaRecorderRef.current = null;
            setMediaRecorder(null);
          };

          mediaRecorderRef.current = recorder;
          setMediaRecorder(recorder);
          recorder.start(1000); // Record in 1-second chunks
          setRecordingState('recording');
          startDurationTimer();
          
        } catch (error) {
          setError(String(error));
          setRecordingState('setup');
        }
      });

      stopUnlisten = await listenStopRecording(() => {
        try {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        } catch (error) {
          setError(String(error));
        }
      });
    };

    if (open) {
      setupListeners();
    }

    return () => {
      if (startUnlisten) startUnlisten();
      if (stopUnlisten) stopUnlisten();
    };
  }, [open]);

  // Cleanup on dialog close
  useEffect(() => {
    if (!open) {
      cleanup();
      setRecordingState('setup');
      setError(null);
      setRecordingSuccess(null);
      setRecordingDuration(0);
      setRecordingId("");
    }
  }, [open]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start duration timer
  const startDurationTimer = () => {
    recordingStartTimeRef.current = Date.now();
    durationIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
      setRecordingDuration(elapsed);
    }, 1000);
  };

  // Stop duration timer
  const stopDurationTimer = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  };

  // Start recording
  const handleStartRecording = async () => {
    try {
      setError(null);
      const { recordingId: id } = await startScreenRecord({ 
        fps: 30, 
        display_index: 0,
        audio_index: 0
      });
      setRecordingId(id);
    } catch (err) {
      setError(String(err));
    }
  };

  // Stop recording
  const handleStopRecording = async () => {
    try {
      if (recordingId) {
        await stopScreenRecord(recordingId);
        setRecordingId("");
      }
    } catch (err) {
      setError(String(err));
    }
  };

  // Cleanup
  const cleanup = () => {
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach(track => track.stop());
      recordingStreamRef.current = null;
      setRecordingStream(null);
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
      setMediaRecorder(null);
    }
    stopDurationTimer();
  };

  // Handle dialog close
  const handleClose = () => {
    if (recordingState !== 'recording') {
      cleanup();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl min-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-h3 font-semibold gradient-text">
            {recordingState === 'success' ? 'Recording Saved' : 'Screen Recording'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-lg">
          {/* Setup / Recording View */}
          {(recordingState === 'setup' || recordingState === 'recording') && (
            <>
              {/* Screen Preview */}
              <div className="relative bg-black rounded-lg overflow-hidden w-full" style={{ aspectRatio: '16/9' }}>
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
                
                {/* Recording Indicator */}
                {recordingState === 'recording' && (
                  <div className="absolute top-4 right-4 flex items-center space-x-2 bg-red-600/90 text-white px-3 py-2 rounded-full">
                    <Circle className="h-3 w-3 fill-current animate-pulse" />
                    <span className="text-sm font-semibold">Recording</span>
                  </div>
                )}
                
                {/* Setup State - No preview */}
                {recordingState === 'setup' && !recordingStream && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/50">
                    <div className="text-center">
                      <Monitor className="h-16 w-16 mx-auto mb-2 opacity-50" />
                      <p>Click Start Recording to begin capturing your screen</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Recording Duration */}
              {recordingState === 'recording' && (
                <div className="flex flex-col items-center space-y-2">
                  <div className="text-4xl font-mono font-bold text-white">
                    {formatDuration(recordingDuration)}
                  </div>
                  <div className="flex items-center space-x-2 text-red-400">
                    <Circle className="h-2 w-2 fill-current animate-pulse" />
                    <span className="text-sm font-semibold">Recording</span>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-caption text-red-400">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-sm">
                {recordingState === 'setup' && (
                  <>
                    <Button variant="outline" onClick={handleClose}>
                      Cancel
                    </Button>
                    <Button
                      variant="gradient"
                      onClick={handleStartRecording}
                      className="flex items-center space-x-sm"
                    >
                      <Circle className="h-4 w-4" />
                      <span>Start Recording</span>
                    </Button>
                  </>
                )}
                
                {recordingState === 'recording' && (
                  <Button
                    onClick={handleStopRecording}
                    className="bg-red-600 hover:bg-red-700 text-white flex items-center space-x-sm"
                  >
                    <Circle className="h-4 w-4 fill-current" />
                    <span>Stop Recording</span>
                  </Button>
                )}
              </div>
            </>
          )}

          {/* Success View */}
          {recordingState === 'success' && recordingSuccess && (
            <>
              <div className="text-center space-y-md py-4">
                <CheckCircle className="h-16 w-16 text-green-400 mx-auto" />
                <div>
                  <p className="text-h4 text-white mb-md font-semibold">Recording saved successfully!</p>
                  <div className="bg-white/5 rounded-lg p-md border border-white/10 mb-md">
                    <p className="text-caption text-white/70 break-all text-left font-mono">
                      {recordingSuccess.path}
                    </p>
                  </div>
                  <p className="text-body-small text-white/50">
                    Duration: {formatDuration(recordingDuration)}
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-sm">
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await revealInFinder(recordingSuccess.path);
                  }}
                >
                  Open in Finder
                </Button>
                <Button
                  variant="gradient"
                  onClick={async () => {
                    const { addAssetsFromPaths } = useProjectStore.getState();
                    try {
                      // Import the recording to library
                      await addAssetsFromPaths([recordingSuccess.path]);
                      // Delete the temporary file after successful import
                      try {
                        await deleteFile(recordingSuccess.path);
                      } catch (deleteError) {
                        console.warn('Failed to delete temporary file:', deleteError);
                        // Don't block the import if deletion fails
                      }
                      handleClose();
                      setActiveLeftPaneTab('library');
                    } catch (error) {
                      console.error('Error importing recording:', error);
                      setError('Failed to import recording to library.');
                    }
                  }}
                >
                  Import to Library
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

