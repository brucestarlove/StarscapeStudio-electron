## backend agent prompt

We are building a desktop video editor in Electron and React+Vite. You are the Tauri engineer. Refer to docs/plans/000-Gauntlet-ClipForge.md for the project assignment. Focus on lines 1-26 for MVP, lines 108-129 for technicals and build strategy.

Refer to docs/ARCHITECTURE.md

Build the best, most well-engineered backend you can, supporting the MVP.

## frontend agent prompt

We are building a desktop video editor in Electron and React+Vite. Refer to docs/plans/000-Gauntlet-ClipForge.md for the project assignment. Focus on lines 1-26 for MVP.

Refer to docs/ARCHITECTURE.md

Build the best, most well-engineered frontend you can, supporting the MVP.

- [x] smooth seeking - implemented with requestAnimationFrame, clickable ruler, draggable playhead
- [x] smooth clipping - fixed trim handle sensitivity with incremental delta tracking
- [x] export including clipped!
- [x] fix export modal style
- [x] fix import modal style
- [x] allow renaming of file on export
- [x] fix mismatch scroll in the timeline between track headers and the tracks
- [x] 2nd video track
- [x] split
- [x] import asset with the original name
- [x] better dragging, arrange clips in a sequence
- [x] right click menu to rename asset
- [x] right pane with edit features (and making the whole layout responsive)
- [x] asset metadata: resolution and file size
- [x] snap to clip edges
- [x] shift + mouse scroll linked to zoom in/out
- [x] smooth seek header interactivity

## remaining for final
- [x] better trim
- [x] multiple tracks (main + overlay/PiP)
- [x] webm?
- [x] fix export resolution
- [x] Webcam recording (access system camera)
- [x] Simultaneous screen + webcam (picture-in-picture style)
- [x] Audio capture from microphone
- [x] Record, stop, and save recordings directly to timeline
- [x] progress indicator during export

## stretch goals
- [ ] Text overlays with custom fonts and animations
- [ ] Transitions between clips (fade, slide, etc.)
- [ ] Audio controls (volume adjustment, fade in/out)
- [ ] Filters and effects (brightness, contrast, saturation)
- [ ] Export presets for different platforms (YouTube, Instagram, TikTok)
- [x] Keyboard shortcuts for common actions
- [ ] Auto-save project state
- [ ] Undo/redo functionality

## Testing Scenarios
We'll test your app with:
- [ ] Recording a 30-second screen capture and adding it to timeline
- [ ] Importing 3 video clips and arranging them in sequence
- [ ] Trimming clips and splitting at various points
- [ ] Exporting a 2-minute video with multiple clips
- [ ] Using webcam recording and overlay on screen recording
- [ ] Testing on both Mac and Windows if possible

## Performance Targets
- [ ] Timeline UI remains responsive with 10+ clips
- [ ] Preview playback is smooth (30 fps minimum)
- [ ] Export completes without crashes
- [ ] App launch time under 5 seconds
- [ ] No memory leaks during extended editing sessions (test for 15+ minutes)
- [ ] File size: Exported videos should maintain reasonable quality (not bloated)

## other
- [ ] generated captions
- [ ] text custom fonts and animations
- [x] hide scrolllbars unless actively scrolling
- [ ] upload export to cloud storage
- [ ] transitions between clips
- [ ] audio controls
- [ ] filters and effects (brightness, contrast, saturation)
- [ ] export presets for different platforms (YouTube, Instagram, TikTok)
- [ ] AI transcription gen, asset gen, 11Labs narrating transcriptions gen
- [ ] Undo/redo functionality??? refer to logs/005-later-refactor-hooks.md

## very extra

- [x] cosmic asset generation specifically
- [ ] integrate with other Starscape

--- 

# currently relying on ffmpeg installed on users' machines via homebrew
Here’s how bundling FFmpeg/FFprobe binaries would work:

## Current Setup (Homebrew)

- **Wrapper scripts** → Call `/opt/homebrew/bin/ffmpeg` (system installation)
- **Requires**: User must have FFmpeg installed via Homebrew
- **Portability**: Only works if Homebrew FFmpeg is installed

## Bundled Binaries Approach

### Option 1: Download pre-built binaries
1. Download official FFmpeg static builds for macOS:
   - From https://evermeet.cx/ffmpeg/ or https://github.com/BtbN/FFmpeg-Builds
   - Get standalone `ffmpeg` and `ffprobe` executables
2. Replace the wrapper scripts:
   - Put actual binaries in `electron/bin/macos/ffmpeg` and `ffprobe`
   - Make them executable (`chmod +x`)
   - Remove the wrapper scripts
3. Package with app:
   - Binaries are included in the Electron app bundle
   - No external dependencies needed

### Option 2: Build from source
1. Compile FFmpeg for macOS
2. Include only the codecs/formats you need
3. More control, but more complex

### Option 3: Use Electron builder plugins
1. Use a plugin like `electron-builder-plugin-ffmpeg`
2. Automatically downloads and bundles FFmpeg during build
3. Simplifies the build process

## Considerations

### Pros of bundling:
- No external dependencies
- Consistent versions across all users
- Works even if Homebrew isn’t installed
- Easier distribution

### Cons of bundling:
- Larger app size (~50–100MB+)
- Need to update binaries manually
- Platform-specific builds (macOS/Windows/Linux)
- License compliance (FFmpeg is LGPL/GPL)

## Recommended approach

For your Electron app, I’d suggest:

1. Keep wrapper scripts for development (use Homebrew)
2. Add bundled binaries for production builds:
   - Download static builds
   - Include them in `electron/bin/macos/`
   - Add a fallback: try bundled first, then system
3. Update build process:
   - Copy binaries during packaging
   - Ensure they’re executable and signed (for macOS)

## Implementation details

- Detection: Check if bundled binaries exist, fallback to system
- Size: Static builds are ~50–100MB each
- Updates: Replace binaries when updating FFmpeg
- Platforms: Need separate binaries for macOS (Intel/Apple Silicon), Windows, Linux

Should I proceed with implementing bundled binaries, or keep the current Homebrew setup and just improve the wrapper scripts?
