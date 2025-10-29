## backend agent prompt

We are building a desktop video editor in Electron and React+Vite. You are the Tauri engineer. Refer to docs/plans/000-Gauntlet-ClipForge.md for the project assignment. Focus on lines 1-26 for MVP, lines 108-129 for technicals and build strategy.

Refer to docs/ARCHITECTURE.md

Build the best, most well-engineered backend you can, supporting the MVP.

## frontend agent prompt

We are building a desktop video editor in Electron and React+Vite. Refer to docs/plans/000-Gauntlet-ClipForge.md for the project assignment. Focus on lines 1-26 for MVP.

Refer to docs/ARCHITECTURE.md

Build the best, most well-engineered frontend you can, supporting the MVP.

[x] smooth seeking - implemented with requestAnimationFrame, clickable ruler, draggable playhead
[x] smooth clipping - fixed trim handle sensitivity with incremental delta tracking
[x] export including clipped!
[x] fix export modal style
[x] fix import modal style
[x] allow renaming of file on export
[x] fix mismatch scroll in the timeline between track headers and the tracks
[x] 2nd video track
[x] split
[x] import asset with the original name
[x] better dragging, arrange clips in a sequence
[x] right click menu to rename asset
[x] right pane with edit features (and making the whole layout responsive)
[x] asset metadata: resolution and file size
[x] snap to clip edges
[x] shift + mouse scroll linked to zoom in/out
[x] smooth seek header interactivity

## remaining for MVP
[ ] better trim
[ ] multiple tracks (main + overlay/PiP)
[ ] webm?
[ ] fix export resolution
[ ] Webcam recording (access system camera)
[ ] Simultaneous screen + webcam (picture-in-picture style)
[ ] Audio capture from microphone
[ ] Record, stop, and save recordings directly to timeline
[ ] progress indicator during export

## stretch goals
[ ] Text overlays with custom fonts and animations
[ ] Transitions between clips (fade, slide, etc.)
[ ] Audio controls (volume adjustment, fade in/out)
[ ] Filters and effects (brightness, contrast, saturation)
[ ] Export presets for different platforms (YouTube, Instagram, TikTok)
[ ] Keyboard shortcuts for common actions
[ ] Auto-save project state
[ ] Undo/redo functionality

## Testing Scenarios
We'll test your app with:
[ ] Recording a 30-second screen capture and adding it to timeline
[ ] Importing 3 video clips and arranging them in sequence
[ ] Trimming clips and splitting at various points
[ ] Exporting a 2-minute video with multiple clips
[ ] Using webcam recording and overlay on screen recording
[ ] Testing on both Mac and Windows if possible

## Performance Targets
[ ] Timeline UI remains responsive with 10+ clips
[ ] Preview playback is smooth (30 fps minimum)
[ ] Export completes without crashes
[ ] App launch time under 5 seconds
[ ] No memory leaks during extended editing sessions (test for 15+ minutes)
[ ] File size: Exported videos should maintain reasonable quality (not bloated)

## other
[ ] generated captions
[ ] text custom fonts and animations
[ ] hide scrolllbars unless actively scrolling
[ ] upload export to cloud storage
[ ] transitions between clips
[ ] audio controls
[ ] filters and effects (brightness, contrast, saturation)
[ ] export presets for different platforms (YouTube, Instagram, TikTok)
[ ] AI transcription gen, asset gen, 11Labs narrating transcriptions gen
[ ] Undo/redo functionality??? refer to logs/005-later-refactor-hooks.md

## very extra

[ ] cosmic asset generation specifically
[ ] integrate with other Starscape
