import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Asset, Clip, Track, CanvasNode, ProjectState } from '@/types';
import { generateId } from '@/lib/utils';
import { ingestFiles, type IngestResult } from '@/lib/bindings';
import { audioManager } from '@/lib/AudioManager';

interface ProjectStore extends ProjectState {
  // Asset actions
  addAssets: (files: File[]) => Promise<void>;
  addAssetsFromPaths: (filePaths: string[]) => Promise<void>;
  removeAsset: (assetId: string) => void;
  
  // Track actions
  addTrack: (type: 'video' | 'audio', name?: string) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;
  
  // Clip actions
  createClip: (assetId: string, trackId: string, startMs: number) => string;
  updateClip: (clipId: string, updates: Partial<Clip>) => void;
  deleteClip: (clipId: string) => void;
  moveClip: (clipId: string, trackId: string, startMs: number) => void;
  trimClip: (clipId: string, side: 'left' | 'right', deltaMs: number) => void;
  splitClip: (clipId: string, atMs: number) => void;
  
  // Selection actions
  selectClips: (clipIds: string[]) => void;
  selectClip: (clipId: string) => void;
  deselectAll: () => void;
  
  // Canvas actions
  createCanvasNode: (clipId: string) => void;
  updateCanvasNode: (nodeId: string, updates: Partial<CanvasNode>) => void;
  deleteCanvasNode: (nodeId: string) => void;
  
  // Project actions
  updateProjectName: (name: string) => void;
  clearProject: () => void;
  
  // Derived state getters
  getClipsByTrack: (trackId: string) => Clip[];
  getSelectedClips: () => Clip[];
  getAssetById: (assetId: string) => Asset | undefined;
}

const initialProjectState: ProjectState = {
  id: generateId(),
  projectName: 'Untitled Project',
  assets: [],
  tracks: [
    {
      id: 'track-1',
      name: 'Video Track 1',
      type: 'video',
      clips: [],
      locked: false,
      visible: true,
    },
    {
      id: 'track-2',
      name: 'Video Track 2',
      type: 'video',
      clips: [],
      locked: false,
      visible: true,
    },
    {
      id: 'track-3',
      name: 'Audio Track 1',
      type: 'audio',
      clips: [],
      locked: false,
      visible: true,
    },
  ],
  clips: {},
  canvasNodes: {},
  selectedClipIds: [],
};

export const useProjectStore = create<ProjectStore>()(
  persist(
    immer((set, get) => ({
      ...initialProjectState,
      
      // Asset actions
      addAssets: async (files: File[]) => {
        const newAssets: Asset[] = [];
        
        for (const file of files) {
          try {
            const url = URL.createObjectURL(file);
            const assetType = getAssetType(file.name);
            
            // For MVP, we'll extract metadata from the file
            let duration = 0;
            let width = 0;
            let height = 0;
            
            if (assetType === 'video') {
              const video = document.createElement('video');
              video.src = url;
              await new Promise((resolve) => {
                video.onloadedmetadata = () => {
                  duration = video.duration * 1000; // Convert to ms
                  width = video.videoWidth;
                  height = video.videoHeight;
                  resolve(void 0);
                };
              });
            } else if (assetType === 'audio') {
              const audio = document.createElement('audio');
              audio.src = url;
              await new Promise((resolve) => {
                audio.onloadedmetadata = () => {
                  duration = audio.duration * 1000; // Convert to ms
                  resolve(void 0);
                };
              });
            } else if (assetType === 'image') {
              const img = document.createElement('img');
              img.src = url;
              await new Promise((resolve) => {
                img.onload = () => {
                  width = img.naturalWidth;
                  height = img.naturalHeight;
                  duration = 5000; // Default 5 seconds for images
                  resolve(void 0);
                };
              });
            }
            
            const asset: Asset = {
              id: generateId(),
              type: assetType,
              name: file.name,
              url,
              duration,
              metadata: {
                width,
                height,
              },
            };
            
            newAssets.push(asset);
          } catch (error) {
            console.error('Error processing file:', file.name, error);
          }
        }
        
        set((state) => {
          state.assets.push(...newAssets);
        });
      },
      
      addAssetsFromPaths: async (filePaths: string[]) => {
        try {
          // Use the backend to ingest files and get metadata
          const ingestResults = await ingestFiles({ file_paths: filePaths });
          
          const newAssets: Asset[] = ingestResults.map((result: IngestResult) => {
            const assetType = getAssetTypeFromPath(result.file_path);
            
            return {
              id: result.asset_id,
              type: assetType,
              name: result.file_path.split('/').pop() || 'Unknown',
              url: `media://${result.file_path}`, // Use custom media:// protocol for local files
              duration: result.metadata.duration_ms,
              metadata: {
                width: result.metadata.width || 0,
                height: result.metadata.height || 0,
              },
            };
          });
          
          set((state) => {
            state.assets.push(...newAssets);
          });
        } catch (error) {
          console.error('Error ingesting files:', error);
          throw error;
        }
      },
      
      removeAsset: (assetId: string) => {
        set((state) => {
          // Remove asset
          state.assets = state.assets.filter((asset: Asset) => asset.id !== assetId);
          
          // Remove associated clips
          const clipIds = Object.keys(state.clips).filter((clipId: string) => 
            state.clips[clipId].assetId === assetId
          );
          
          clipIds.forEach((clipId: string) => {
            delete state.clips[clipId];
            delete state.canvasNodes[clipId];
          });
          
          // Remove clips from tracks
          state.tracks.forEach((track: Track) => {
            track.clips = track.clips.filter((clipId: string) => !clipIds.includes(clipId));
          });
          
          // Clean up selection
          state.selectedClipIds = state.selectedClipIds.filter((id: string) => !clipIds.includes(id));
        });
      },
      
      // Track actions
      addTrack: (type: 'video' | 'audio', name?: string) => {
        set((state) => {
          const track: Track = {
            id: generateId(),
            name: name || `${type === 'video' ? 'Video' : 'Audio'} Track ${state.tracks.length + 1}`,
            type,
            clips: [],
            locked: false,
            visible: true,
          };
          state.tracks.push(track);
        });
      },
      
      removeTrack: (trackId: string) => {
        set((state) => {
          const track = state.tracks.find((t: Track) => t.id === trackId);
          if (!track) return;
          
          // Remove all clips from this track
          track.clips.forEach((clipId: string) => {
            delete state.clips[clipId];
            delete state.canvasNodes[clipId];
          });
          
          // Remove track
          state.tracks = state.tracks.filter((t: Track) => t.id !== trackId);
          
          // Clean up selection
          state.selectedClipIds = state.selectedClipIds.filter((id: string) => 
            !track.clips.includes(id)
          );
        });
      },
      
      updateTrack: (trackId: string, updates: Partial<Track>) => {
        set((state) => {
          const track = state.tracks.find((t: Track) => t.id === trackId);
          if (track) {
            Object.assign(track, updates);
          }
        });
      },
      
      // Clip actions
      createClip: (assetId: string, trackId: string, startMs: number) => {
        let clipId = '';
        set((state) => {
          const asset = state.assets.find((a: Asset) => a.id === assetId);
          const track = state.tracks.find((t: Track) => t.id === trackId);
          
          if (!asset || !track) return;
          
          clipId = generateId();
          const clip: Clip = {
            id: clipId,
            assetId,
            trackId,
            startMs,
            endMs: startMs + asset.duration,
            trimStartMs: 0,
            trimEndMs: asset.duration,
            zIndex: 0,
          };
          
          state.clips[clipId] = clip;
          track.clips.push(clipId);
          
          // Create canvas node
          const nodeId = generateId();
          state.canvasNodes[nodeId] = {
            id: nodeId,
            clipId,
            x: 0,
            y: 0,
            width: 200,
            height: 150,
            rotation: 0,
            opacity: 1,
          };
        });
        return clipId;
      },
      
      updateClip: (clipId: string, updates: Partial<Clip>) => {
        set((state) => {
          const clip = state.clips[clipId];
          if (clip) {
            Object.assign(clip, updates);
          }
        });
      },
      
      deleteClip: (clipId: string) => {
        set((state) => {
          const clip = state.clips[clipId];
          if (!clip) return;
          
          // Remove from track
          const track = state.tracks.find((t: Track) => t.id === clip.trackId);
          if (track) {
            track.clips = track.clips.filter((id: string) => id !== clipId);
          }
          
          // Remove clip and canvas node
          delete state.clips[clipId];
          delete state.canvasNodes[clipId];
          
          // Remove from selection
          state.selectedClipIds = state.selectedClipIds.filter((id: string) => id !== clipId);
          
          // Clean up audio element from AudioManager
          audioManager.removeAudioElement(clip.trackId, clipId);
        });
      },
      
      moveClip: (clipId: string, trackId: string, startMs: number) => {
        set((state) => {
          const clip = state.clips[clipId];
          if (!clip) return;
          
          // Remove from old track
          const oldTrack = state.tracks.find((t: Track) => t.id === clip.trackId);
          if (oldTrack) {
            oldTrack.clips = oldTrack.clips.filter((id: string) => id !== clipId);
          }
          
          // Add to new track
          const newTrack = state.tracks.find((t: Track) => t.id === trackId);
          if (newTrack) {
            newTrack.clips.push(clipId);
          }
          
          // Update clip
          clip.trackId = trackId;
          clip.startMs = startMs;
          clip.endMs = startMs + (clip.trimEndMs - clip.trimStartMs);
        });
      },
      
      trimClip: (clipId: string, side: 'left' | 'right', deltaMs: number) => {
        set((state) => {
          const clip = state.clips[clipId];
          if (!clip) return;
          
          const asset = state.assets.find((a: Asset) => a.id === clip.assetId);
          if (!asset) return;
          
          if (side === 'left') {
            const newTrimStart = Math.max(0, clip.trimStartMs + deltaMs);
            const newTrimEnd = Math.min(asset.duration, clip.trimEndMs);
            
            if (newTrimStart < newTrimEnd) {
              clip.trimStartMs = newTrimStart;
              clip.startMs += deltaMs;
            }
          } else {
            const newTrimEnd = Math.min(asset.duration, clip.trimEndMs + deltaMs);
            const newTrimStart = Math.max(0, clip.trimStartMs);
            
            if (newTrimStart < newTrimEnd) {
              clip.trimEndMs = newTrimEnd;
              clip.endMs += deltaMs;
            }
          }
        });
      },
      
      splitClip: (clipId: string, atMs: number) => {
        set((state) => {
          const clip = state.clips[clipId];
          if (!clip) return;
          
          const track = state.tracks.find((t: Track) => t.id === clip.trackId);
          if (!track) return;
          
          // Create new clip for the second part
          const newClipId = generateId();
          const newClip: Clip = {
            id: newClipId,
            assetId: clip.assetId,
            trackId: clip.trackId,
            startMs: atMs,
            endMs: clip.endMs,
            trimStartMs: clip.trimStartMs + (atMs - clip.startMs),
            trimEndMs: clip.trimEndMs,
            zIndex: clip.zIndex,
          };
          
          // Update original clip
          clip.endMs = atMs;
          clip.trimEndMs = clip.trimStartMs + (atMs - clip.startMs);
          
          // Add new clip to track
          const clipIndex = track.clips.indexOf(clipId);
          track.clips.splice(clipIndex + 1, 0, newClipId);
          
          state.clips[newClipId] = newClip;
          
          // Create canvas node for new clip
          const nodeId = generateId();
          state.canvasNodes[nodeId] = {
            id: nodeId,
            clipId: newClipId,
            x: 0,
            y: 0,
            width: 200,
            height: 150,
            rotation: 0,
            opacity: 1,
          };
        });
      },
      
      // Selection actions
      selectClips: (clipIds: string[]) => {
        set((state) => {
          state.selectedClipIds = clipIds;
        });
      },
      
      selectClip: (clipId: string) => {
        set((state) => {
          state.selectedClipIds = [clipId];
        });
      },
      
      deselectAll: () => {
        set((state) => {
          state.selectedClipIds = [];
        });
      },
      
      // Canvas actions
      createCanvasNode: (clipId: string) => {
        set((state) => {
          const nodeId = generateId();
          state.canvasNodes[nodeId] = {
            id: nodeId,
            clipId,
            x: 0,
            y: 0,
            width: 200,
            height: 150,
            rotation: 0,
            opacity: 1,
          };
        });
      },
      
      updateCanvasNode: (nodeId: string, updates: Partial<CanvasNode>) => {
        set((state) => {
          const node = state.canvasNodes[nodeId];
          if (node) {
            Object.assign(node, updates);
          }
        });
      },
      
      deleteCanvasNode: (nodeId: string) => {
        set((state) => {
          delete state.canvasNodes[nodeId];
        });
      },
      
      // Project actions
      updateProjectName: (name: string) => {
        set((state) => {
          state.projectName = name;
        });
      },
      
      clearProject: () => {
        set(() => ({ ...initialProjectState }));
      },
      
      // Derived state getters
      getClipsByTrack: (trackId: string) => {
        const state = get();
        const track = state.tracks.find((t: Track) => t.id === trackId);
        if (!track) return [];
        
        return track.clips
          .map((clipId: string) => state.clips[clipId])
          .filter(Boolean)
          .sort((a, b) => a.startMs - b.startMs);
      },
      
      getSelectedClips: () => {
        const state = get();
        return state.selectedClipIds
          .map((clipId: string) => state.clips[clipId])
          .filter(Boolean);
      },
      
      getAssetById: (assetId: string) => {
        const state = get();
        return state.assets.find((asset: Asset) => asset.id === assetId);
      },
    })),
    {
      name: 'starscape-project-storage',
      partialize: (state) => ({
        id: state.id,
        projectName: state.projectName,
        assets: state.assets,
        tracks: state.tracks,
        clips: state.clips,
        canvasNodes: state.canvasNodes,
        selectedClipIds: state.selectedClipIds,
      }),
      // Merge function to handle backward compatibility (projects without id)
      merge: (persistedState: any, currentState: any) => {
        return {
          ...currentState,
          ...persistedState,
          // Ensure we always have an ID
          id: persistedState?.id || generateId(),
        };
      },
    }
  )
);

// Helper function to get asset type from filename
function getAssetType(filename: string): 'video' | 'audio' | 'image' {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'];
  const audioExts = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'];
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
  
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  if (imageExts.includes(ext)) return 'image';
  
  throw new Error(`Unsupported file type: ${filename}`);
}

// Helper function to get asset type from file path
function getAssetTypeFromPath(filePath: string): 'video' | 'audio' | 'image' {
  const filename = filePath.split('/').pop() || filePath;
  return getAssetType(filename);
}
