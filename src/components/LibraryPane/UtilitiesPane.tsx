import { useState } from "react";
import { useUiStore } from "@/store/uiStore";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { WebcamRecordingDialog } from "./WebcamRecordingDialog";
import { MicrophoneRecordingDialog } from "./MicrophoneRecordingDialog";
import { ScreenRecordingDialog } from "./ScreenRecordingDialog";
import { ScreenWebcamRecordingDialog } from "./ScreenWebcamRecordingDialog";

export function UtilitiesPane() {
  const { setLeftPaneCollapsed } = useUiStore();
  
  // Screen recording dialog state
  const [screenDialogOpen, setScreenDialogOpen] = useState(false);
  
  // Webcam recording dialog state
  const [webcamDialogOpen, setWebcamDialogOpen] = useState(false);
  
  // Microphone recording dialog state
  const [microphoneDialogOpen, setMicrophoneDialogOpen] = useState(false);
  
  // Screen + Webcam recording dialog state
  const [screenWebcamDialogOpen, setScreenWebcamDialogOpen] = useState(false);

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
            {/* Recording Section */}
            <div className="space-y-sm">
              <h3 className="text-sm font-semibold text-white/80">Record</h3>
              <Button
                onClick={() => setScreenDialogOpen(true)}
                className="w-full py-2 bg-gradient-cyan-purple text-white hover:opacity-90 rounded transition-all"
              >
                ⏥ Record Screen
              </Button>
              <Button
                onClick={() => setWebcamDialogOpen(true)}
                className="w-full py-2 bg-gradient-cyan-purple text-white hover:opacity-90 rounded transition-all"
              >
                📹 Record Webcam
              </Button>
              <Button
                onClick={() => setMicrophoneDialogOpen(true)}
                className="w-full py-2 bg-gradient-cyan-purple text-white hover:opacity-90 rounded transition-all"
              >
                🎤 Record Microphone
              </Button>
            </div>

            {/* Screen + Webcam Recording */}
            <div className="space-y-sm">
              <h3 className="text-sm font-semibold text-white/80">Picture-in-Picture</h3>
              <Button
                onClick={() => setScreenWebcamDialogOpen(true)}
                className="w-full py-2 bg-gradient-cyan-purple text-white hover:opacity-90 rounded transition-all"
              >
                📹⏥ Screen + Webcam Recording
              </Button>
            </div>
        </div>
      </div>

      {/* Webcam Recording Dialog */}
      <WebcamRecordingDialog 
        open={webcamDialogOpen}
        onOpenChange={setWebcamDialogOpen}
      />

      {/* Screen Recording Dialog */}
      <ScreenRecordingDialog 
        open={screenDialogOpen}
        onOpenChange={setScreenDialogOpen}
      />

      {/* Microphone Recording Dialog */}
      <MicrophoneRecordingDialog 
        open={microphoneDialogOpen}
        onOpenChange={setMicrophoneDialogOpen}
      />

      {/* Screen + Webcam Recording Dialog */}
      <ScreenWebcamRecordingDialog 
        open={screenWebcamDialogOpen}
        onOpenChange={setScreenWebcamDialogOpen}
      />
    </>
  );
}
