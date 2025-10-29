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
  
  // Playback control
  stop: () => void;
  goToStart: () => void;
  
  // Audio control
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
  
  // Playback control
  stop: () => {
    set({ playing: false, currentTimeMs: 0 });
  },
  
  goToStart: () => {
    set({ currentTimeMs: 0 });
  },
  
  // Toggle mute state
  toggleMute: () => {
    set((state) => ({ isMuted: !state.isMuted }));
  },
}));
