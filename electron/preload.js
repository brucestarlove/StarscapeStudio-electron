const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose protected methods to renderer process via context bridge
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Media operations
  getMediaMetadata: (path) => ipcRenderer.invoke('get-media-metadata', path),
  
  applyEdits: (projectJson) => ipcRenderer.invoke('apply-edits', projectJson),
  
  generatePreview: (projectJson, atMs) =>
    ipcRenderer.invoke('generate-preview', projectJson, atMs),
  
  exportProject: (projectJson, settings) =>
    ipcRenderer.invoke('export-project', projectJson, settings),
  
  // File ingestion
  ingestFiles: (request) => ipcRenderer.invoke('ingest-files', request),
  
  // File dialog
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  
  // Save blob to file
  saveBlobToFile: (blobData, filePath) => ipcRenderer.invoke('save-blob-to-file', blobData, filePath),
  
  // Reveal file in Finder/Explorer
  revealInFinder: (filePath) => ipcRenderer.invoke('reveal-in-finder', filePath),
  
  // Delete file
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  
  // AI Image Generation
  generateImage: (prompt) => ipcRenderer.invoke('generate-image', prompt),
  
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

