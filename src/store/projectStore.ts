import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Asset, Clip, Track, CanvasNode, ProjectState } from '@/types';
import { generateId } from '@/lib/utils';
import { ingestFiles, type IngestResult } from '@/lib/bindings';
import { audioManager } from '@/lib/AudioManager';
import { usePlaybackStore } from '@/store/playbackStore';

interface ProjectStore extends ProjectState {
  // Asset actions
  addAssets: (files: File[]) => Promise<void>;
  addAssetsFromPaths: (filePaths: string[]) => Promise<void>;
  removeAsset: (assetId: string) => void;
  renameAsset: (assetId: string, newName: string) => void;

  // Track actions
  addTrack: (type: 'video' | 'audio', name?: string) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;

  // Clip actions
  createClip: (assetId: string, trackId: string, startMs: number) => string;
  updateClip: (clipId: string, updates: Partial<Clip>) => void;
  deleteClip: (clipId: string) => void;
  moveClip: (clipId: string, trackId: string, startMs: number) => void;
  shiftClipsRight: (trackId: string, fromClipId: string, newStartMs: number) => void;
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
  getCanvasNodeByClipId: (clipId: string) => CanvasNode | undefined;
  getTimelineDuration: () => number;
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
  selectedTrackId: null,
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
              await new Promise((resolve, _reject) => {
                img.onload = () => {
                  width = img.naturalWidth;
                  height = img.naturalHeight;
                  duration = 5000; // Default 5 seconds for images
                  console.log(`✅ Image metadata loaded: ${file.name}, ${width}x${height}, duration: ${duration}ms`);
                  resolve(void 0);
                };
                img.onerror = (e) => {
                  console.error(`❌ Failed to load image metadata for ${file.name}:`, e);
                  // Set defaults even on error
                  width = 1920;
                  height = 1080;
                  duration = 5000;
                  resolve(void 0); // Don't reject, just use defaults
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
              name: result.original_file_name, // Use original file name
              url: `media://${result.file_path}`, // Use custom media:// protocol for local files
              thumbnailUrl: result.thumbnail_path ? `media://${result.thumbnail_path}` : undefined,
              fileSize: result.file_size,
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

      renameAsset: (assetId: string, newName: string) => {
        set((state) => {
          const asset = state.assets.find((a: Asset) => a.id === assetId);
          if (asset) {
            asset.name = newName;
          }
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
          
          // For images, ensure minimum duration and cap at 60 seconds (60000ms)
          const defaultImageDuration = 5000; // Default 5 seconds
          const minClipDuration = 100; // Minimum 100ms for all clips
          const maxImageDuration = 60000; // Maximum 60 seconds
          let effectiveDuration = asset.duration;
          
          if (asset.type === 'image') {
            // If duration is 0 or invalid, use default 5 seconds
            if (!effectiveDuration || effectiveDuration <= 0) {
              effectiveDuration = defaultImageDuration;
            }
            // Ensure minimum and cap at maximum
            effectiveDuration = Math.max(minClipDuration, Math.min(effectiveDuration, maxImageDuration));
          }
          
          const clip: Clip = {
            id: clipId,
            assetId,
            trackId,
            startMs,
            endMs: startMs + effectiveDuration,
            trimStartMs: 0,
            trimEndMs: effectiveDuration,
            zIndex: 0,
          };

          state.clips[clipId] = clip;
          track.clips.push(clipId);

          // Create canvas node based on track position
          // Find first video track to determine if this is Track 1 (Main Track)
          const firstVideoTrack = state.tracks.find((t: Track) => t.type === 'video');
          const isMainTrack = track.type === 'video' && track.id === firstVideoTrack?.id;
          
          const nodeId = generateId();
          
          if (isMainTrack) {
            // Track 1 (Main Track): Full canvas dimensions
            state.canvasNodes[nodeId] = {
              id: nodeId,
              clipId,
              x: 0,
              y: 0,
              width: 1920,
              height: 1080,
              rotation: 0,
              opacity: 1,
            };
          } else if (track.type === 'video') {
            // Track 2+ (PiP Tracks): Default PiP size and position
            // Calculate dimensions preserving asset aspect ratio
            const defaultMaxWidth = 480;
            const defaultMaxHeight = 270;
            const padding = 40;
            
            let pipWidth = defaultMaxWidth;
            let pipHeight = defaultMaxHeight;
            
            // If asset has dimensions, preserve aspect ratio
            if (asset.metadata.width && asset.metadata.height && asset.metadata.width > 0 && asset.metadata.height > 0) {
              const assetAspect = asset.metadata.width / asset.metadata.height;
              const defaultAspect = defaultMaxWidth / defaultMaxHeight;
              
              if (assetAspect > defaultAspect) {
                // Asset is wider - fit to width
                pipWidth = defaultMaxWidth;
                pipHeight = defaultMaxWidth / assetAspect;
              } else {
                // Asset is taller - fit to height
                pipHeight = defaultMaxHeight;
                pipWidth = defaultMaxHeight * assetAspect;
              }
            }
            
            state.canvasNodes[nodeId] = {
              id: nodeId,
              clipId,
              x: 1920 - pipWidth - padding, // Bottom-right with padding
              y: 1080 - pipHeight - padding,
              width: pipWidth,
              height: pipHeight,
              rotation: 0,
              opacity: 1,
            };
          } else {
            // Audio tracks or other types: Default small size
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
          }
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
          
          // Find and delete canvas node by clipId
          const canvasNode = Object.values(state.canvasNodes).find(
            (node: CanvasNode) => node.clipId === clipId
          );
          if (canvasNode) {
            delete state.canvasNodes[canvasNode.id];
          }

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

      shiftClipsRight: (trackId: string, fromClipId: string, newStartMs: number) => {
        set((state) => {
          const fromClip = state.clips[fromClipId];
          if (!fromClip) return;

          // Get all clips on the track
          const track = state.tracks.find((t: Track) => t.id === trackId);
          if (!track) return;

          // Find all clips that start at or after the fromClip's start position
          const clipsToShift = track.clips
            .map((id: string) => state.clips[id])
            .filter((clip: Clip) => clip.startMs >= fromClip.startMs)
            .sort((a: Clip, b: Clip) => a.startMs - b.startMs);

          // Position clips sequentially starting from newStartMs
          let currentPosition = newStartMs;
          clipsToShift.forEach((clip: Clip) => {
            const duration = clip.endMs - clip.startMs;
            clip.startMs = currentPosition;
            clip.endMs = currentPosition + duration;
            currentPosition = clip.endMs; // Next clip starts where this one ends
          });
        });
      },

      trimClip: (clipId: string, side: 'left' | 'right', deltaMs: number) => {
        set((state) => {
          const clip = state.clips[clipId];
          if (!clip) return;

          const asset = state.assets.find((a: Asset) => a.id === clip.assetId);
          if (!asset) return;

          // Minimum clip duration: 100ms for all media types (prevents too-short clips)
          const minClipDuration = 100;
          const maxImageDuration = 60000; // maximum 60 seconds for images

          if (side === 'left') {
            // When trimming left, we adjust both trimStartMs and startMs by the same delta
            // to maintain the invariant: (endMs - startMs) === (trimEndMs - trimStartMs)

            // Calculate new trim start position in the source asset
            let newTrimStart = clip.trimStartMs + deltaMs;

            // Clamp to valid range [0, asset.duration]
            newTrimStart = Math.max(0, Math.min(asset.duration, newTrimStart));

            // Ensure we don't trim past the end (maintain minimum duration)
            newTrimStart = Math.min(newTrimStart, clip.trimEndMs - minClipDuration);

            // Calculate the actual delta we can apply (may be less than requested due to clamping)
            const actualDelta = newTrimStart - clip.trimStartMs;

            // Calculate new timeline start position
            let newStartMs = clip.startMs + actualDelta;

            // Ensure timeline position doesn't go below 0
            newStartMs = Math.max(0, newStartMs);

            // If timeline position was clamped, adjust trim start accordingly
            if (newStartMs === 0 && clip.startMs + actualDelta < 0) {
              const clampedDelta = -clip.startMs;
              newTrimStart = clip.trimStartMs + clampedDelta;
            }

            // Apply the trim, maintaining the invariant
            clip.trimStartMs = newTrimStart;
            clip.startMs = newStartMs;

          } else {
            // When trimming right, we adjust both trimEndMs and endMs by the same delta
            // to maintain the invariant: (endMs - startMs) === (trimEndMs - trimStartMs)

            // Calculate new trim end position in the source asset
            let newTrimEnd = clip.trimEndMs + deltaMs;

            // For images, allow extending beyond initial duration up to max
            // For videos, clamp to asset duration
            if (asset.type === 'image') {
              // Images can be extended from 0 to max duration
              const maxTrimEnd = clip.trimStartMs + maxImageDuration;
              newTrimEnd = Math.max(0, Math.min(newTrimEnd, maxTrimEnd));
            } else {
              // Videos are clamped to asset duration
              newTrimEnd = Math.max(0, Math.min(asset.duration, newTrimEnd));
            }

            // Ensure we don't trim past the start (maintain minimum duration)
            newTrimEnd = Math.max(newTrimEnd, clip.trimStartMs + minClipDuration);

            // Calculate the actual delta we can apply (may be less than requested due to clamping)
            const actualDelta = newTrimEnd - clip.trimEndMs;

            // Calculate new timeline end position
            const newEndMs = clip.endMs + actualDelta;

            // Ensure minimum clip duration on timeline
            if (newEndMs > clip.startMs + minClipDuration) {
              // Apply the trim, maintaining the invariant
              clip.trimEndMs = newTrimEnd;
              clip.endMs = newEndMs;
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

          // Create canvas node for new clip, inheriting from parent clip
          const parentCanvasNode = Object.values(state.canvasNodes).find(
            (node: CanvasNode) => node.clipId === clipId
          );
          
          const nodeId = generateId();
          if (parentCanvasNode) {
            // Inherit parent's transform properties
            state.canvasNodes[nodeId] = {
              id: nodeId,
              clipId: newClipId,
              x: parentCanvasNode.x,
              y: parentCanvasNode.y,
              width: parentCanvasNode.width,
              height: parentCanvasNode.height,
              rotation: parentCanvasNode.rotation,
              opacity: parentCanvasNode.opacity,
            };
          } else {
            // Fallback to defaults if parent node not found
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
          }
        });
      },

      // Selection actions
      selectClips: (clipIds: string[]) => {
        set((state) => {
          state.selectedClipIds = clipIds;
          // Track the track of the first selected clip
          if (clipIds.length > 0) {
            const firstClip = state.clips[clipIds[0]];
            if (firstClip) {
              state.selectedTrackId = firstClip.trackId;
            }
          }
        });
      },

      selectClip: (clipId: string) => {
        set((state) => {
          state.selectedClipIds = [clipId];
          // Track the track of the selected clip
          const clip = state.clips[clipId];
          if (clip) {
            state.selectedTrackId = clip.trackId;
          }
        });
      },

      deselectAll: () => {
        set((state) => {
          state.selectedClipIds = [];
          state.selectedTrackId = null;
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
        // Stop playback and reset timeline position
        const playbackState = usePlaybackStore.getState();
        playbackState.pause();
        playbackState.seek(0);

        // Clear all audio elements from the AudioManager
        audioManager.clear();

        // Reset project state - generate new track IDs to ensure complete cleanup
        set(() => ({
          ...initialProjectState,
          id: generateId(),
          tracks: initialProjectState.tracks.map(track => ({
            ...track,
            id: generateId(),
          })),
        }));
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

      getCanvasNodeByClipId: (clipId: string) => {
        const state = get();
        return Object.values(state.canvasNodes).find(
          (node: CanvasNode) => node.clipId === clipId
        );
      },

      getTimelineDuration: () => {
        const state = get();
        let maxEndMs = 0;

        // Find the latest end time across all clips in all tracks
        Object.values(state.clips).forEach((clip: Clip) => {
          if (clip.endMs > maxEndMs) {
            maxEndMs = clip.endMs;
          }
        });

        // Return at least 10 seconds (10000ms) for empty timeline
        return Math.max(maxEndMs, 10000);
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
