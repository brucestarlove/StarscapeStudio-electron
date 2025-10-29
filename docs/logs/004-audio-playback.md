# Audio Playback Implementation - October 29, 2025

## Overview
Implemented comprehensive audio playback system for ClipForge video editor, enabling synchronized audio playback across:
- Embedded audio in video clips
- Audio-only tracks
- Master volume control and muting

## Changes Made

### 1. AudioManager Class (`src/lib/AudioManager.ts`)
**Purpose**: Centralized management of all audio sources with synchronization

**Key Features**:
- **Audio Element Management**: Creates and manages `<audio>` elements for audio tracks
- **Video Integration**: Handles embedded audio in `<video>` elements
- **Synchronization**: Keeps all audio sources in sync with timeline position (±50ms threshold)
- **Volume & Mute Control**: Master controls affecting all audio sources
- **Drift Correction**: Automatic correction for audio drift during playback (checks every 100ms)

**Public API**:
```typescript
// Initialization
setVideoElement(video: HTMLVideoElement | null)
createAudioElement(asset: Asset, clip: Clip, track: Track): HTMLAudioElement

// Playback Control
play(): void          // Start all audio sources
pause(): void         // Pause all audio sources
syncToTime(timelineMs, audioClips): void  // Sync to specific timeline position

// Volume & Mute
setVolume(volume: 0-1): void
setMuted(muted: boolean): void
getVolume(): number
isMutedNow(): boolean

// Cleanup
clear(): void
removeAudioElement(trackId, clipId): void
```

### 2. Stage Component Updates (`src/components/Stage/Stage.tsx`)
**Changes**:
- Removed `muted` attribute from `<video>` element to enable embedded audio playback
- Added integration with AudioManager singleton
- Implemented audio clip detection: `getAudioClips()` helper function
- Added synchronization effect: keeps audio sources synced during playback
- Added play/pause control effect: coordinates audio manager with playback state

**Audio Synchronization Logic**:
- Tracks visible video clips (for embedded audio)
- Finds all active audio clips at current timeline position
- Syncs each audio source accounting for clip trimming
- Handles pausing audio when outside clip boundaries

### 3. Playback Store Updates (`src/store/playbackStore.ts`)
**New State Properties**:
```typescript
volume: number;       // Master volume (0-1), default 1.0
isMuted: boolean;     // Mute state, default false
```

**New Actions**:
- `setVolume(volume: number)`: Update master volume with validation
- `toggleMute()`: Toggle mute state

### 4. Type Definitions (`src/types/index.ts`)
**Updated PlaybackState**:
```typescript
export interface PlaybackState {
  currentTimeMs: number;
  playing: boolean;
  zoom: number;
  snapEnabled: boolean;
  volume: number;       // NEW: Master volume (0-1)
  isMuted: boolean;     // NEW: Mute state
}
```

### 5. Transport Controls Updates (`src/components/Transport/TransportControls.tsx`)
**New UI Elements**:
- Mute button (Volume2/VolumeX icon) that shows red tint when muted
- Volume slider (0-100%) with granular control (0.05 step)
- Effects syncing volume and mute state with AudioManager

**User Experience**:
- Real-time volume adjustment during playback
- Visual feedback for muted state
- Tooltip showing current volume percentage

## Technical Details

### Audio Synchronization Algorithm
1. **Timeline Sync**: When seeking or during playback, all audio elements are synced to the same timeline position
2. **Trim Accounting**: For clipped audio, source time is calculated as:
   ```
   sourceTimeMs = timelineMs - clip.startMs + clip.trimStartMs
   ```
3. **Drift Correction**: 
   - Primary sync threshold: ±50ms (large discontinuities)
   - Continuous drift monitor: Corrects any drift >100ms every 100ms
4. **Boundary Management**: Audio plays only when timeline is within clip bounds

### Audio Element Lifecycle
- Elements are created on-demand when clip appears in timeline
- Cached and reused for performance
- Automatically paused when outside clip boundaries
- Cleared on component unmount for memory management

### Performance Considerations
- Audio elements are cached by `trackId-clipId` key
- Drift correction runs at 10Hz (100ms interval) to minimize CPU usage
- Preload strategy: `preload="auto"` for quick playback initiation
- Threshold-based syncing prevents constant seeking

## Files Modified
1. `/src/lib/AudioManager.ts` - NEW
2. `/src/components/Stage/Stage.tsx`
3. `/src/store/playbackStore.ts`
4. `/src/types/index.ts`
5. `/src/components/Transport/TransportControls.tsx`

## Testing Recommendations
1. **Audio-Only Playback**: Add audio track and verify playback
2. **Video with Audio**: Add video clip and verify audio playback
3. **Multiple Audio Tracks**: Verify synchronized playback across tracks
4. **Volume Control**: Test slider and verify all sources respond
5. **Mute**: Verify mute affects all audio sources
6. **Seeking**: Verify audio syncs correctly when scrubbing timeline
7. **Trimming**: Test trimmed audio clips play from correct position
8. **Clip Boundaries**: Verify audio stops at clip end boundaries

## Future Enhancements
1. Audio visualization (waveform display)
2. Per-track volume control
3. Audio effects (EQ, compression, etc.)
4. Pan controls (left/right channel)
5. Audio metering (level indicators)
6. Keyboard shortcuts for volume control
7. Sound visualization in canvas

## Notes
- Audio playback is muted if using Canvas-based rendering (CanvasVideoRenderer.ts)
  - The Canvas renderer sets `muted=true` and renders audio as placeholder
  - For full audio support, use the Stage component's native video/audio elements
- Autoplay may be blocked by browser policy; gracefully handles rejection
- All audio sources are cleaned up on component unmount to prevent memory leaks
