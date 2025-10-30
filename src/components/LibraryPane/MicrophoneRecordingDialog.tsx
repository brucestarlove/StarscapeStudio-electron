import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Mic, Circle } from "lucide-react";
import { saveBlobToFile, revealInFinder, deleteFile } from "@/lib/bindings";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";

interface MicrophoneRecordingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MediaDeviceInfo {
  deviceId: string;
  label: string;
}

type RecordingState = 'setup' | 'recording' | 'success';

export function MicrophoneRecordingDialog({ open, onOpenChange }: MicrophoneRecordingDialogProps) {
  // Device list
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  
  // Selected device
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>("");
  
  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>('setup');
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingSuccess, setRecordingSuccess] = useState<{ path: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Recording duration
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const recordingStartTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { setActiveLeftPaneTab } = useUiStore();

  // Enumerate devices on dialog open
  useEffect(() => {
    if (open) {
      enumerateDevices();
      setRecordingState('setup');
      setError(null);
      setRecordingSuccess(null);
      setRecordingDuration(0);
    } else {
      // Cleanup when dialog closes
      cleanupStream();
      stopDurationTimer();
    }
  }, [open]);

  // Request permission and enumerate devices
  const enumerateDevices = async () => {
    try {
      // Request permission first to get device labels
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Get device list
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
        }));
      
      setAudioDevices(audioInputs);
      
      // Auto-select first device
      if (audioInputs.length > 0) {
        setSelectedAudioDevice(audioInputs[0].deviceId);
      }
      
      // Stop the initial permission stream
      stream.getTracks().forEach(track => track.stop());
      
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
      setError('Failed to access microphone. Please grant permission and try again.');
    }
  };

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
      
      // Get audio stream
      const constraints: MediaStreamConstraints = {
        audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true,
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setMediaStream(stream);
      
      // Create MediaRecorder
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        await saveRecording(blob);
        stopDurationTimer();
      };
      
      setMediaRecorder(recorder);
      recorder.start(1000); // Record in 1-second chunks
      setRecordingState('recording');
      startDurationTimer();
      
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording. Please check microphone permissions.');
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
      const filename = `microphone_recording_${timestamp}.webm`;
      
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
  };

  // Handle dialog close
  const handleClose = () => {
    if (recordingState !== 'recording') {
      cleanupStream();
      stopDurationTimer();
      onOpenChange(false);
      // Reset state
      setRecordingState('setup');
      setError(null);
      setRecordingSuccess(null);
      setMediaRecorder(null);
      setRecordingDuration(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg min-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-h3 font-semibold gradient-text">
            {recordingState === 'success' ? 'Recording Saved' : 'Microphone Recording'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-lg">
          {/* Setup / Recording View */}
          {(recordingState === 'setup' || recordingState === 'recording') && (
            <>
              {/* Recording Visualizer */}
              <div className="relative bg-gradient-to-br from-mid-navy to-dark-navy rounded-lg overflow-hidden border border-light-blue/20 p-8">
                <div className="flex flex-col items-center justify-center space-y-6">
                  {/* Microphone Icon with pulse effect */}
                  <div className={`relative ${recordingState === 'recording' ? 'animate-pulse' : ''}`}>
                    <div className={`absolute inset-0 rounded-full ${recordingState === 'recording' ? 'bg-red-500/20 animate-ping' : 'bg-light-blue/10'}`}></div>
                    <div className={`relative rounded-full p-6 ${recordingState === 'recording' ? 'bg-red-600/20' : 'bg-light-blue/10'}`}>
                      <Mic className={`h-12 w-12 ${recordingState === 'recording' ? 'text-red-400' : 'text-light-blue'}`} />
                    </div>
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
                  
                  {/* Setup State */}
                  {recordingState === 'setup' && (
                    <div className="text-center">
                      <p className="text-white/70">Select a microphone and click Start Recording</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Device Selection */}
              <div className="space-y-sm">
                <label className="text-body-small text-white/70 flex items-center space-x-2">
                  <Mic className="h-4 w-4" />
                  <span>Microphone</span>
                </label>
                <select
                  value={selectedAudioDevice}
                  onChange={(e) => setSelectedAudioDevice(e.target.value)}
                  disabled={recordingState === 'recording'}
                  className="w-full bg-white/10 border border-white/20 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-light-blue disabled:opacity-50 disabled:cursor-not-allowed"
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
                      disabled={!selectedAudioDevice || audioDevices.length === 0}
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

