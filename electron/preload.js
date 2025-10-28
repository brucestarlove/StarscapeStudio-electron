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
  
  // Progress events
  onExportProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('export-progress', listener);
    
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('export-progress', listener);
    };
  },
});

