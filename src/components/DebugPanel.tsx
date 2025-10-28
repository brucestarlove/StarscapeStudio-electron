import { useState, useEffect } from "react";
import { getMediaMetadata, generatePreview, exportProject, listenExportProgress, listCaptureDevices, startScreenRecord, stopScreenRecord, listenStartRecording, listenStopRecording, saveBlobToFile } from "@/lib/bindings";
import projectJsonRaw from "../../example/starproj-sample.json?raw";

export function DebugPanel() {
  const [logs, setLogs] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [exportPath, setExportPath] = useState<string>("");
  const [recordingId, setRecordingId] = useState<string>("");
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);

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
            audio: false, // We'll add audio support later
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

  const handleMetadata = async () => {
    try {
      const meta = await getMediaMetadata("/Users/bdr/Git/GAUNTLET/clipforge-sample-02.mp4");
      append({ meta });
    } catch (e) {
      append({ error: String(e) });
    }
  };

  const handlePreview = async () => {
    try {
      const projectJson = projectJsonRaw as unknown as string;
      const res = await generatePreview(projectJson, 500);
      setPreviewUrl(res.url);
      append({ preview: res });
    } catch (e) {
      append({ error: String(e) });
    }
  };

  const handleExport = async () => {
    let unlisten: (() => void) | undefined;
    try {
      unlisten = await listenExportProgress((evt) => append({ progress: evt }));
      const projectJson = projectJsonRaw as unknown as string;
      const res = await exportProject(projectJson, { format: "mp4" });
      setExportPath(res.path);
      append({ export: res });
    } catch (e) {
      append({ error: String(e) });
    } finally {
      if (unlisten) unlisten();
    }
  };

  const handleRecordToggle = async () => {
    try {
      if (!recordingId) {
        const devices = await listCaptureDevices();
        append({ devices });
        const { recordingId: id, outPath } = await startScreenRecord({ 
          fps: 30, 
          display_index: 0,  // Use first display
          audio_index: 0  // 0 = no audio, 1+ = mic index
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
    <div className="fixed right-2 bottom-2 z-50 bg-black/60 text-xs text-white rounded-md p-2 space-y-2 w-[420px] backdrop-blur border border-white/10">
      <div className="flex gap-2">
        <button className="px-2 py-1 bg-white/10 rounded" onClick={handleMetadata}>Metadata</button>
        <button className="px-2 py-1 bg-white/10 rounded" onClick={handlePreview}>Preview @500ms</button>
        <button className="px-2 py-1 bg-white/10 rounded" onClick={handleExport}>Export MP4</button>
        <button className={`px-2 py-1 rounded ${recordingId ? 'bg-red-600/80' : 'bg-white/10'}`} onClick={handleRecordToggle}>
          {recordingId ? 'Stop Rec' : 'Start Rec'}
        </button>
      </div>
      {previewUrl && (
        <div className="space-y-1">
          <div className="opacity-70">Preview</div>
          <img src={previewUrl} alt="preview" className="w-full max-h-40 object-contain rounded" />
        </div>
      )}
      {exportPath && (
        <div className="space-y-1">
          <div className="opacity-70">Export</div>
          <div className="flex items-center gap-2">
            <code className="truncate" title={exportPath}>{exportPath}</code>
            <button className="px-2 py-1 bg-white/10 rounded" onClick={async () => { await navigator.clipboard.writeText(exportPath); append({copied: exportPath}); }}>Copy</button>
          </div>
        </div>
      )}
      <pre className="max-h-60 overflow-auto whitespace-pre-wrap">{logs}</pre>
    </div>
  );
}
