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
[ ] better dragging, arrange clips in a sequence
[ ] right click menu to rename asset
[ ] right pane with edit features
[ ] asset metadata: resolution and file size 
[ ] snap to grid / snap to clip edges etc
[ ] mouse scroll linked to zoom in/out
[ ] smooth seek header interactivity
[ ] progress indicator during export
[ ] hide scrolllbars unless actively scrolling


## extra
[ ] upload export to cloud storage
[ ] text overlays with custom fonts and animations
[ ] transitions between clips
[ ] audio controls
[ ] filters and effects (brightness, contrast, saturation)
[ ] export presets for different platforms (YouTube, Instagram, TikTok)
[ ] AI transcription gen, asset gen, 11Labs narrating transcriptions gen
[ ] Undo/redo functionality??? refer to logs/005-later-refactor-hooks.md

## very extra
[ ] cosmic asset generation specifically
[ ] integrate with other Starscape
[ ] 