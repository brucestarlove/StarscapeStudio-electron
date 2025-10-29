import { create } from 'zustand';
import type { PlaybackState } from '@/types';

interface PlaybackStore extends PlaybackState {
  // Playback actions
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (timeMs: number) => void;
  
  // Timeline actions
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleSnap: () => void;
  
  // Frame navigation
  stepForward: () => void;
  stepBackward: () => void;
  
  // Playback control
  stop: () => void;
  goToStart: () => void;
  goToEnd: () => void;
  
  // Audio control
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

const initialPlaybackState: PlaybackState = {
  currentTimeMs: 0,
  playing: false,
  zoom: 0.1, // 0.1 pixels per millisecond (100ms = 10px)
  snapEnabled: true,
  volume: 1.0, // Default full volume
  isMuted: false, // Default unmuted
};

export const usePlaybackStore = create<PlaybackStore>()((set) => ({
  ...initialPlaybackState,
  
  // Playback actions
  play: () => {
    set({ playing: true });
  },
  
  pause: () => {
    set({ playing: false });
  },
  
  togglePlay: () => {
    set((state) => ({ playing: !state.playing }));
  },
  
  seek: (timeMs: number) => {
    set({ currentTimeMs: Math.max(0, timeMs) });
  },
  
  // Timeline actions
  setZoom: (zoom: number) => {
    set({ zoom: Math.max(0.01, Math.min(10, zoom)) }); // Clamp between 0.01 and 10
  },
  
  zoomIn: () => {
    set((state) => ({ 
      zoom: Math.min(10, state.zoom * 1.5) 
    }));
  },
  
  zoomOut: () => {
    set((state) => ({ 
      zoom: Math.max(0.01, state.zoom / 1.5) 
    }));
  },
  
  toggleSnap: () => {
    set((state) => ({ snapEnabled: !state.snapEnabled }));
  },
  
  // Frame navigation
  stepForward: () => {
    set((state) => ({ 
      currentTimeMs: state.currentTimeMs + (1000 / 30) // ~33ms for 30fps
    }));
  },
  
  stepBackward: () => {
    set((state) => ({ 
      currentTimeMs: Math.max(0, state.currentTimeMs - (1000 / 30))
    }));
  },
  
  // Playback control
  stop: () => {
    set({ playing: false, currentTimeMs: 0 });
  },
  
  goToStart: () => {
    set({ currentTimeMs: 0 });
  },
  
  goToEnd: () => {
    // This would need to be calculated from the project store
    // For now, we'll use a placeholder
    set({ currentTimeMs: 60000 }); // 1 minute placeholder
  },
  
  // Audio control - update volume with validation
  setVolume: (volume: number) => {
    set({ volume: Math.max(0, Math.min(1, volume)) });
  },
  
  // Toggle mute state
  toggleMute: () => {
    set((state) => ({ isMuted: !state.isMuted }));
  },
}));
