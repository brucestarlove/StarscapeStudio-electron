const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose protected methods to renderer process via context bridge
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Media operations
  getMediaMetadata: (path) => ipcRenderer.invoke('get-media-metadata', path),
  
  generatePreview: (projectJson, atMs) =>
    ipcRenderer.invoke('generate-preview', projectJson, atMs),
  
  exportProject: (projectJson, settings) =>
    ipcRenderer.invoke('export-project', projectJson, settings),
  
  // File ingestion
  ingestFiles: (request) => ipcRenderer.invoke('ingest-files', request),
  
  // Save blob to file
  saveBlobToFile: (blobData, filePath) => ipcRenderer.invoke('save-blob-to-file', blobData, filePath),
  
  // Screen recording
  listCaptureDevices: () => ipcRenderer.invoke('list-capture-devices'),
  startScreenRecord: (settings) => ipcRenderer.invoke('start-screen-record', settings),
  stopScreenRecord: (recordingId) => ipcRenderer.invoke('stop-screen-record', recordingId),
  
  // Progress events
  onExportProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('export-progress', listener);
    
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('export-progress', listener);
    };
  },
  
  // Screen recording events
  onStartRecording: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('start-recording', listener);
    
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('start-recording', listener);
    };
  },
  
  onStopRecording: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('stop-recording', listener);
    
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('stop-recording', listener);
    };
  },
});

