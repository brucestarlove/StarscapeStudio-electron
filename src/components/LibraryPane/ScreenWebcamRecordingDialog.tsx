import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Video, Circle, Mic } from "lucide-react";
import { startScreenRecord, stopScreenRecord, listenStartRecording, listenStopRecording, saveBlobToFile, revealInFinder, deleteFile } from "@/lib/bindings";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";

interface ScreenWebcamRecordingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MediaDeviceInfo {
  deviceId: string;
  label: string;
}

type RecordingState = 'setup' | 'recording' | 'success';

export function ScreenWebcamRecordingDialog({ open, onOpenChange }: ScreenWebcamRecordingDialogProps) {
  // Device lists
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  
  // Selected devices
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>("");
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>("");
  
  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>('setup');
  const [recordingId, setRecordingId] = useState<string>("");
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null); // Preview-only webcam stream
  const [recordingSuccess, setRecordingSuccess] = useState<{ path: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Recording duration
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const recordingStartTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Refs
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const webcamPreviewRef = useRef<HTMLVideoElement>(null); // Visible preview element
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null); 
  const isRecordingRef = useRef<boolean>(false);
  const listenersReadyRef = useRef<boolean>(false);
  
  // Stream refs for cleanup
  const screenStreamRef = useRef<MediaStream | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const compositeStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  const { setActiveLeftPaneTab } = useUiStore();

  // Enumerate webcam devices on dialog open
  useEffect(() => {
    if (open) {
      enumerateDevices();
      setRecordingState('setup');
      setError(null);
      setRecordingSuccess(null);
    } else {
      cleanup();
      cleanupPreview();
    }
  }, [open]);

  // Request permission and enumerate webcam and microphone devices
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
      // Stop existing preview stream
      cleanupPreview();
      
      // Request new stream with selected device
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selectedVideoDevice ? { exact: selectedVideoDevice } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setPreviewStream(stream);
      previewStreamRef.current = stream;
      
      // Set video preview
      if (webcamPreviewRef.current) {
        webcamPreviewRef.current.srcObject = stream;
        // Explicitly play the video
        webcamPreviewRef.current.play().catch(err => {
          console.error('Failed to play preview:', err);
        });
      }
      
    } catch (err) {
      console.error('Failed to start preview:', err);
      setError('Failed to start camera preview.');
    }
  };

  // Cleanup preview stream
  const cleanupPreview = () => {
    if (previewStreamRef.current) {
      // Stop all tracks in the preview stream
      previewStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      previewStreamRef.current = null;
      setPreviewStream(null);
    }
    // Clear preview video element srcObject to release the stream
    if (webcamPreviewRef.current && webcamPreviewRef.current.srcObject) {
      webcamPreviewRef.current.srcObject = null;
    }
  };

  // Set up recording event listeners
  useEffect(() => {
    let startUnlisten: (() => void) | undefined;
    let stopUnlisten: (() => void) | undefined;

    const setupListeners = async () => {
      listenersReadyRef.current = false;
      
      try {
        startUnlisten = await listenStartRecording(async (event) => {
        try {
          // Get the screen source
          const screenMediaStream = await navigator.mediaDevices.getUserMedia({
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

          screenStreamRef.current = screenMediaStream;

          // Set up screen video element
          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = screenMediaStream;
            await screenVideoRef.current.play();
          }

          // Get webcam stream
          if (!selectedVideoDevice) {
            throw new Error('No webcam device selected');
          }

          const webcamMediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: selectedVideoDevice ? { exact: selectedVideoDevice } : undefined,
              width: { ideal: 320 },
              height: { ideal: 180 },
              frameRate: { ideal: 30 },
            },
            audio: false, // We'll use screen audio if available, or add webcam audio later
          });

          setWebcamStream(webcamMediaStream);
          webcamStreamRef.current = webcamMediaStream;

          // Set up webcam video element (hidden, for compositing)
          if (webcamVideoRef.current) {
            webcamVideoRef.current.srcObject = webcamMediaStream;
            await webcamVideoRef.current.play();
          }

          // Stop preview-only stream first (before switching to recording stream)
          cleanupPreview();
          
          // Update preview to use the recording stream
          if (webcamPreviewRef.current) {
            webcamPreviewRef.current.srcObject = webcamMediaStream;
            await webcamPreviewRef.current.play();
          }

          // Wait for videos to be ready
          await Promise.all([
            new Promise((resolve) => {
              if (screenVideoRef.current) {
                screenVideoRef.current.onloadedmetadata = resolve;
              } else {
                resolve(null);
              }
            }),
            new Promise((resolve) => {
              if (webcamVideoRef.current) {
                webcamVideoRef.current.onloadedmetadata = resolve;
              } else {
                resolve(null);
              }
            }),
          ]);

          // Create composite canvas (hidden, only for recording)
          const canvas = canvasRef.current;
          
          if (!canvas) {
            throw new Error('Canvas element not found');
          }

          // Get screen dimensions
          const screenWidth = screenVideoRef.current?.videoWidth || 1920;
          const screenHeight = screenVideoRef.current?.videoHeight || 1080;

          // Set canvas dimensions to match screen
          canvas.width = screenWidth;
          canvas.height = screenHeight;

          // Calculate webcam PIP size and position (bottom-right corner)
          const pipWidth = Math.min(320, screenWidth * 0.2); // 20% of screen width, max 320px
          const pipHeight = Math.min(180, screenHeight * 0.2); // Maintain aspect ratio
          const pipPadding = 20;
          const pipX = screenWidth - pipWidth - pipPadding;
          const pipY = screenHeight - pipHeight - pipPadding;

          // Composite function - draws both videos to canvas (hidden, for recording only)
          const compositeVideos = () => {
            if (!canvas || !screenVideoRef.current || !webcamVideoRef.current) {
              return;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Draw screen video as background
            if (screenVideoRef.current.videoWidth > 0 && screenVideoRef.current.videoHeight > 0) {
              ctx.drawImage(screenVideoRef.current, 0, 0, canvas.width, canvas.height);
            }

            // Draw webcam video as PIP overlay (bottom-right)
            if (webcamVideoRef.current.videoWidth > 0 && webcamVideoRef.current.videoHeight > 0) {
              // Draw webcam with rounded corners and border
              const radius = 8;
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(pipX + radius, pipY);
              ctx.lineTo(pipX + pipWidth - radius, pipY);
              ctx.quadraticCurveTo(pipX + pipWidth, pipY, pipX + pipWidth, pipY + radius);
              ctx.lineTo(pipX + pipWidth, pipY + pipHeight - radius);
              ctx.quadraticCurveTo(pipX + pipWidth, pipY + pipHeight, pipX + pipWidth - radius, pipY + pipHeight);
              ctx.lineTo(pipX + radius, pipY + pipHeight);
              ctx.quadraticCurveTo(pipX, pipY + pipHeight, pipX, pipY + pipHeight - radius);
              ctx.lineTo(pipX, pipY + radius);
              ctx.quadraticCurveTo(pipX, pipY, pipX + radius, pipY);
              ctx.closePath();
              ctx.clip();
              
              ctx.drawImage(webcamVideoRef.current, pipX, pipY, pipWidth, pipHeight);
              ctx.restore();
              
              // Add border
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(pipX + radius, pipY);
              ctx.lineTo(pipX + pipWidth - radius, pipY);
              ctx.quadraticCurveTo(pipX + pipWidth, pipY, pipX + pipWidth, pipY + radius);
              ctx.lineTo(pipX + pipWidth, pipY + pipHeight - radius);
              ctx.quadraticCurveTo(pipX + pipWidth, pipY + pipHeight, pipX + pipWidth - radius, pipY + pipHeight);
              ctx.lineTo(pipX + radius, pipY + pipHeight);
              ctx.quadraticCurveTo(pipX, pipY + pipHeight, pipX, pipY + pipHeight - radius);
              ctx.lineTo(pipX, pipY + radius);
              ctx.quadraticCurveTo(pipX, pipY, pipX + radius, pipY);
              ctx.closePath();
              ctx.stroke();
            }

            // Continue animation
            if (isRecordingRef.current) {
              animationFrameRef.current = requestAnimationFrame(compositeVideos);
            }
          };

          // Create canvas stream for recording
          const canvasStream = canvas.captureStream(30); // 30 FPS
          
          // Get microphone audio stream if selected
          let audioStream: MediaStream | null = null;
          if (selectedAudioDevice) {
            try {
              audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                  deviceId: selectedAudioDevice ? { exact: selectedAudioDevice } : undefined,
                },
              });
              audioStreamRef.current = audioStream;
            } catch (err) {
              console.warn('Failed to get microphone stream:', err);
              // Continue without audio if microphone fails
            }
          }
          
          // Combine canvas video stream with microphone audio stream
          const combinedStream = new MediaStream();
          
          // Add all video tracks from canvas stream
          canvasStream.getVideoTracks().forEach(track => {
            combinedStream.addTrack(track);
          });
          
          // Add audio track from microphone if available
          if (audioStream && audioStream.getAudioTracks().length > 0) {
            combinedStream.addTrack(audioStream.getAudioTracks()[0]);
          }
          
          compositeStreamRef.current = combinedStream;

          // Create MediaRecorder with the combined stream (video + audio)
          const recorder = new MediaRecorder(combinedStream, {
            mimeType: 'video/webm;codecs=vp9,opus'
          });

          const chunks: Blob[] = [];
          
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunks.push(e.data);
            }
          };

          recorder.onstop = async () => {
            // Stop animation frame
            isRecordingRef.current = false;
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
              animationFrameRef.current = null;
            }

            // Stop duration timer immediately
            stopDurationTimer();

            const blob = new Blob(chunks, { type: 'video/webm' });
            
            try {
              // Convert blob to ArrayBuffer
              const arrayBuffer = await blob.arrayBuffer();
              
              // Extract just the filename from the full path
              const filename = event.outputPath.split('/').pop() || `screen_webcam_recording_${Date.now()}.webm`;
              
              // Save to the specified path
              const result = await saveBlobToFile(arrayBuffer, filename);
              setRecordingSuccess({ path: result.path });
              setRecordingState('success');
            } catch (error) {
              setError(`Failed to save recording: ${error}`);
              setRecordingState('setup');
            }
            
            // Clean up recording streams
            // Stop screen stream
            if (screenStreamRef.current) {
              screenStreamRef.current.getTracks().forEach(track => track.stop());
              screenStreamRef.current = null;
            }
            
            // Stop composite stream
            if (compositeStreamRef.current) {
              compositeStreamRef.current.getTracks().forEach(track => track.stop());
              compositeStreamRef.current = null;
            }
            
            // Stop recording webcam stream
            if (webcamStreamRef.current) {
              webcamStreamRef.current.getTracks().forEach(track => track.stop());
              webcamStreamRef.current = null;
              setWebcamStream(null);
            }
            
            // Stop microphone audio stream
            if (audioStreamRef.current) {
              audioStreamRef.current.getTracks().forEach(track => track.stop());
              audioStreamRef.current = null;
            }
            
            // Clear all video elements
            if (screenVideoRef.current) {
              screenVideoRef.current.srcObject = null;
            }
            if (webcamVideoRef.current) {
              webcamVideoRef.current.srcObject = null;
            }
            if (webcamPreviewRef.current) {
              webcamPreviewRef.current.srcObject = null;
            }
            
            // Don't restart preview automatically - ensure webcam is fully released
            // User can restart preview manually if needed
          };

          mediaRecorderRef.current = recorder;
          
          // Set recording flag BEFORE starting compositing loop
          isRecordingRef.current = true;
          
          // Start the compositing loop - this will continuously draw frames
          compositeVideos();
          
          recorder.start(1000); // Record in 1-second chunks
          setRecordingState('recording');
          startDurationTimer();
          
        } catch (error) {
          setError(String(error));
          setRecordingState('setup');
          cleanup();
        }
      });

      stopUnlisten = await listenStopRecording(() => {
        try {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
          // Also stop the timer and update state immediately
          stopDurationTimer();
        } catch (error) {
          setError(String(error));
        }
      });
      
      // Mark listeners as ready after they're both set up
      listenersReadyRef.current = true;
    } catch (error) {
      console.error('Failed to set up recording listeners:', error);
      listenersReadyRef.current = false;
      // Don't throw - just log the error
    }
  };

    // Set up listeners when dialog opens - always set them up immediately
    if (open) {
      // Set up listeners immediately when dialog opens
      setupListeners().catch((err) => {
        console.error('Failed to set up recording listeners:', err);
        setError('Failed to set up recording listeners');
      });
    }

    return () => {
      listenersReadyRef.current = false;
      if (startUnlisten) startUnlisten();
      if (stopUnlisten) stopUnlisten();
    };
    // Only depend on open and selectedVideoDevice - NOT recordingState!
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedVideoDevice]);

  // Cleanup on dialog close
  useEffect(() => {
    if (!open) {
      // Stop ALL streams (cleanup() already calls cleanupPreview())
      cleanup();
      
      // Clear all state
      setRecordingState('setup');
      setError(null);
      setRecordingSuccess(null);
      setRecordingDuration(0);
      setRecordingId("");
      setPreviewStream(null);
      setWebcamStream(null);
      
      // Reset listener ready flag
      listenersReadyRef.current = false;
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
      
      if (!selectedVideoDevice) {
        setError('Please select a webcam device');
        return;
      }

      // Wait for listeners to be ready (with timeout)
      let waitCount = 0;
      while (!listenersReadyRef.current && waitCount < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitCount++;
      }
      
      if (!listenersReadyRef.current) {
        setError('Recording listeners not ready. Please try again.');
        return;
      }

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
    // Stop animation frame
    isRecordingRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop all streams
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach(track => track.stop());
      webcamStreamRef.current = null;
      setWebcamStream(null);
    }

    // Stop microphone audio stream
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    if (compositeStreamRef.current) {
      compositeStreamRef.current.getTracks().forEach(track => track.stop());
      compositeStreamRef.current = null;
    }

    // Stop ALL webcam streams (both preview and recording)
    cleanupPreview();

    // Clear video elements (preview is already cleared by cleanupPreview)
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = null;
    }

    // Stop media recorder
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }

    stopDurationTimer();
  };

  // Handle dialog close
  const handleClose = () => {
    if (recordingState !== 'recording') {
      cleanup();
      onOpenChange(false);
    } else {
      // If recording, stop recording first, then cleanup will happen in onstop handler
      handleStopRecording();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl min-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-h3 font-semibold gradient-text">
            {recordingState === 'success' ? 'Recording Saved' : 'Screen + Webcam Recording'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-lg">
          {/* Setup / Recording View */}
          {(recordingState === 'setup' || recordingState === 'recording') && (
            <>
              {/* Webcam Preview */}
              <div className="relative bg-black rounded-lg overflow-hidden w-full" style={{ aspectRatio: '16/9' }}>
                <video
                  ref={webcamPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                
                {/* Hidden video elements for compositing */}
                <video
                  ref={screenVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ display: 'none' }}
                />
                <video
                  ref={webcamVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ display: 'none' }}
                />
                <canvas
                  ref={canvasRef}
                  style={{ display: 'none' }}
                />
                
                {/* Recording Indicator */}
                {recordingState === 'recording' && (
                  <div className="absolute top-4 right-4 flex items-center space-x-2 bg-red-600/90 text-white px-3 py-2 rounded-full">
                    <Circle className="h-3 w-3 fill-current animate-pulse" />
                    <span className="text-sm font-semibold">Recording</span>
                  </div>
                )}
                
                {/* Setup State - No preview */}
                {recordingState === 'setup' && !previewStream && !webcamStream && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/50">
                    <div className="text-center">
                      <Video className="h-16 w-16 mx-auto mb-2 opacity-50" />
                      <p>Select a camera to preview</p>
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

              {/* Device Selection */}
              <div className="space-y-md">
                {/* Video Device Dropdown */}
                <div className="space-y-sm">
                  <label className="text-body-small text-white/70 flex items-center space-x-2">
                    <Video className="h-4 w-4" />
                    <span>Webcam</span>
                  </label>
                  <select
                    value={selectedVideoDevice}
                    onChange={(e) => setSelectedVideoDevice(e.target.value)}
                    disabled={recordingState === 'recording'}
                    className="w-full bg-white/10 border border-white/20 text-white/50 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-light-blue disabled:opacity-50 disabled:cursor-not-allowed"
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
                
                {/* Audio Device Dropdown */}
                <div className="space-y-sm">
                  <label className="text-body-small text-white/70 flex items-center space-x-2">
                    <Mic className="h-4 w-4" />
                    <span>Microphone</span>
                  </label>
                  <select
                    value={selectedAudioDevice}
                    onChange={(e) => setSelectedAudioDevice(e.target.value)}
                    disabled={recordingState === 'recording'}
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

