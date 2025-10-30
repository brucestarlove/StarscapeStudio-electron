import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Video, Mic, Circle } from "lucide-react";
import { saveBlobToFile, revealInFinder } from "@/lib/bindings";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";

interface WebcamRecordingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MediaDeviceInfo {
  deviceId: string;
  label: string;
}

type RecordingState = 'setup' | 'recording' | 'success';

export function WebcamRecordingDialog({ open, onOpenChange }: WebcamRecordingDialogProps) {
  // Device lists
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  
  // Selected devices
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>("");
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>("");
  
  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>('setup');
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordingSuccess, setRecordingSuccess] = useState<{ path: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  
  const { setActiveLeftPaneTab } = useUiStore();

  // Enumerate devices on dialog open
  useEffect(() => {
    if (open) {
      enumerateDevices();
      setRecordingState('setup');
      setError(null);
      setRecordingSuccess(null);
    } else {
      // Cleanup when dialog closes
      cleanupStream();
    }
  }, [open]);

  // Request permission and enumerate devices
  const enumerateDevices = async () => {
    try {
      // Request permission first to get device labels
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      
      // Get device list
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const videoInputs = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
        }));
      
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
        }));
      
      setVideoDevices(videoInputs);
      setAudioDevices(audioInputs);
      
      // Auto-select first devices
      if (videoInputs.length > 0) {
        setSelectedVideoDevice(videoInputs[0].deviceId);
      }
      if (audioInputs.length > 0) {
        setSelectedAudioDevice(audioInputs[0].deviceId);
      }
      
      // Stop the initial permission stream
      stream.getTracks().forEach(track => track.stop());
      
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
      setError('Failed to access camera/microphone. Please grant permission and try again.');
    }
  };

  // Start preview when device is selected
  useEffect(() => {
    if (selectedVideoDevice && recordingState === 'setup') {
      startPreview();
    }
  }, [selectedVideoDevice, recordingState]);

  // Start live preview
  const startPreview = async () => {
    try {
      // Stop existing stream
      cleanupStream();
      
      // Request new stream with selected device
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selectedVideoDevice ? { exact: selectedVideoDevice } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false, // Preview without audio
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setMediaStream(stream);
      
      // Set video preview
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        // Explicitly play the video
        videoPreviewRef.current.play().catch(err => {
          console.error('Failed to play preview:', err);
        });
      }
      
    } catch (err) {
      console.error('Failed to start preview:', err);
      setError('Failed to start camera preview.');
    }
  };

  // Start recording
  const handleStartRecording = async () => {
    try {
      setError(null);
      
      // Get stream with both video and audio
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selectedVideoDevice ? { exact: selectedVideoDevice } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false, // Audio not hooked up yet (per requirements)
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setMediaStream(stream);
      
      // Update preview
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        // Explicitly play the video
        videoPreviewRef.current.play().catch(err => {
          console.error('Failed to play preview during recording:', err);
        });
      }
      
      // Create MediaRecorder
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
      });
      
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        await saveRecording(blob);
      };
      
      setRecordedChunks(chunks);
      setMediaRecorder(recorder);
      recorder.start(1000); // Record in 1-second chunks
      setRecordingState('recording');
      
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording. Please check camera permissions.');
    }
  };

  // Stop recording
  const handleStopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  };

  // Save recording to file
  const saveRecording = async (blob: Blob) => {
    try {
      const timestamp = Date.now();
      const filename = `webcam_recording_${timestamp}.webm`;
      
      // Convert blob to ArrayBuffer
      const arrayBuffer = await blob.arrayBuffer();
      
      // Save to cache directory via Electron
      const result = await saveBlobToFile(arrayBuffer, filename);
      
      console.log('Recording saved:', result.path);
      
      // Clean up stream
      cleanupStream();
      
      // Show success
      setRecordingSuccess({ path: result.path });
      setRecordingState('success');
      
    } catch (err) {
      console.error('Failed to save recording:', err);
      setError('Failed to save recording to disk.');
      setRecordingState('setup');
    }
  };

  // Cleanup media stream
  const cleanupStream = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
  };

  // Handle dialog close
  const handleClose = () => {
    if (recordingState !== 'recording') {
      cleanupStream();
      onOpenChange(false);
      // Reset state
      setRecordingState('setup');
      setError(null);
      setRecordingSuccess(null);
      setRecordedChunks([]);
      setMediaRecorder(null);
    }
  };

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl min-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-h3 font-semibold gradient-text">
              {recordingState === 'success' ? 'Recording Saved' : 'Webcam Recording'}
            </DialogTitle>
          </DialogHeader>

        <div className="space-y-lg">
          {/* Setup / Recording View */}
          {(recordingState === 'setup' || recordingState === 'recording') && (
            <>
              {/* Live Preview */}
              <div className="relative bg-black rounded-lg overflow-hidden w-full" style={{ aspectRatio: '16/9' }}>
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                
                {/* Recording Indicator */}
                {recordingState === 'recording' && (
                  <div className="absolute top-4 right-4 flex items-center space-x-2 bg-red-600/90 text-white px-3 py-2 rounded-full">
                    <Circle className="h-3 w-3 fill-current animate-pulse" />
                    <span className="text-sm font-semibold">Recording</span>
                  </div>
                )}
                
                {/* No preview message */}
                {!mediaStream && recordingState === 'setup' && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/50">
                    <div className="text-center">
                      <Video className="h-16 w-16 mx-auto mb-2 opacity-50" />
                      <p>Select a camera to preview</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Device Selection */}
              <div className="space-y-md">
                {/* Video Device Dropdown */}
                <div className="space-y-sm">
                  <label className="text-body-small text-white/70 flex items-center space-x-2">
                    <Video className="h-4 w-4" />
                    <span>Camera</span>
                  </label>
                  <select
                    value={selectedVideoDevice}
                    onChange={(e) => setSelectedVideoDevice(e.target.value)}
                    disabled={recordingState === 'recording'}
                    className="w-full bg-white/10 border border-white/20 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-light-blue disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {videoDevices.length === 0 && (
                      <option value="">No cameras found</option>
                    )}
                    {videoDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Audio Device Dropdown (UI only, not functional yet) */}
                <div className="space-y-sm">
                  <label className="text-body-small text-white/70 flex items-center space-x-2">
                    <Mic className="h-4 w-4" />
                    <span>Microphone (Coming Soon)</span>
                  </label>
                  <select
                    value={selectedAudioDevice}
                    onChange={(e) => setSelectedAudioDevice(e.target.value)}
                    disabled={true}
                    className="w-full bg-white/10 border border-white/20 text-white/50 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-light-blue disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {audioDevices.length === 0 && (
                      <option value="">No microphones found</option>
                    )}
                    {audioDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

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
                      disabled={!selectedVideoDevice || videoDevices.length === 0}
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
                  <div className="bg-white/5 rounded-lg p-md border border-white/10">
                    <p className="text-caption text-white/70 break-all text-left font-mono">
                      {recordingSuccess.path}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-sm">
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    const { addAssetsFromPaths } = useProjectStore.getState();
                    try {
                      await addAssetsFromPaths([recordingSuccess.path]);
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
                <Button
                  variant="gradient"
                  onClick={async () => {
                    await revealInFinder(recordingSuccess.path);
                  }}
                >
                  Open in Finder
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

