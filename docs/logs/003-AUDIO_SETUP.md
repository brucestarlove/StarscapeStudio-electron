# Audio Playback Setup & Usage Guide

## Quick Start

### What's New
Sound playback is now fully enabled in ClipForge! You can now:
- ✅ Play audio from video files (embedded audio)
- ✅ Import and play audio-only files (.mp3, .wav, .m4a, etc.)
- ✅ Sync multiple audio tracks together
- ✅ Control master volume and mute
- ✅ Trim audio clips just like video

## Using Audio in ClipForge

### Adding Audio to Your Project

1. **From Video Files**: 
   - Import a video file normally (drag/drop or library upload)
   - The embedded audio will play automatically
   - No extra steps needed!

2. **Audio-Only Files**:
   - Drag/drop audio files (.mp3, .wav, .ogg, .m4a) into the library
   - Add to an audio track on the timeline
   - Audio will play synchronized with video

3. **Multiple Audio Tracks**:
   - You have "Audio Track 1" by default (visible in timeline)
   - Stack multiple audio clips on different tracks
   - All will play together, synchronized to the timeline

### Playback Controls

Located in the bottom transport controls:

```
[◄◄]  [▶/❚❚]  [►►]  [🔊 |========] 
  Back  Play/Pause  Forward  Volume & Mute
```

- **Mute Button** (🔊 or 🔇): Toggles mute for all audio
  - Red tint appears when muted
- **Volume Slider**: Adjust master volume (0-100%)
  - Works in real-time during playback
  - Affects all audio sources simultaneously

### Timeline Editing

- **Trim Audio**: Click and drag trim handles on audio clips
- **Move Audio**: Drag clips left/right to adjust timing
- **Split Audio**: Use edit menu to split at playhead position
- **Stacking**: Overlap audio tracks for layering effects

### Troubleshooting

**No Sound Coming Out?**
1. Check the mute button (🔊) - should NOT show as red/muted
2. Check volume slider - should be above minimum
3. Make sure audio track is visible in timeline
4. Verify audio clip is within current timeline view

**Audio Out of Sync?**
- This shouldn't happen with the new sync system
- If it does, try seeking (scrubbing) slightly and playback should re-sync
- Report any persistent sync issues

**Audio Playback Blocked?**
- Some browsers block autoplay of audio
- Click the play button to start playback manually
- If in Electron app, this shouldn't be an issue

## Technical Details

### Architecture

The audio system consists of:

1. **AudioManager** (`src/lib/AudioManager.ts`)
   - Singleton instance managing all audio sources
   - Synchronizes video + audio track elements
   - Handles volume and mute globally

2. **Stage Component** (`src/components/Stage/Stage.tsx`)
   - Integrates video playback with audio
   - Passes video element to AudioManager
   - Detects and syncs all active audio clips

3. **Playback Store** (`src/store/playbackStore.ts`)
   - Stores volume and mute state
   - Centralized state for UI controls

### Synchronization Details

- **Sync Threshold**: ±50ms - audio sources automatically sync if drift exceeds this
- **Continuous Monitoring**: Drift is checked every 100ms during playback
- **Trim Support**: Audio clips correctly account for trimming
- **Boundary Management**: Audio automatically stops at clip boundaries

### Performance

- Minimal CPU overhead (drift checking only at 10Hz)
- Audio elements cached for quick playback
- Efficient preload strategy for large files

## Keyboard Shortcuts (Future)

These are planned but not yet implemented:
- `Space` - Play/Pause
- `M` - Toggle Mute
- `+` - Increase Volume
- `-` - Decrease Volume

## Tips & Tricks

### Best Practices
1. Always add a dedicated audio track for clean mixing
2. Leave space between clips to avoid popping/cutting
3. Use volume slider for quick A/B testing different levels
4. Trim audio precisely for clean transitions

### Advanced Uses
- **Layered Audio**: Stack multiple dialogue/music tracks
- **Ducking**: Reduce volume on music track under dialogue (use multiple tracks)
- **Sound Effects**: Quick audio overlays for emphasis
- **Audio-Only Projects**: Great for podcast/music editing

## Known Limitations

1. **No Per-Track Volume**: Use export with normalization as workaround
2. **No Audio Effects**: EQ/compression not yet supported
3. **No Waveform Display**: Audio tracks show as placeholders
4. **Mono Only**: Stereo preserved during playback but UI is simplified

These are all planned for future releases!

## Getting Help

- Check `/docs/logs/audio-playback-001.md` for technical implementation details
- Review code comments in `src/lib/AudioManager.ts` for API documentation
- Open issues on GitHub if you encounter problems

---

**Version**: 1.0.0  
**Released**: October 29, 2025  
**Status**: ✅ Production Ready
