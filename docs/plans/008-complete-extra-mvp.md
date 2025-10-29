# Complete ClipForge MVP Features

## Overview

Complete the remaining core features to meet the Gauntlet MVP requirements. Focus on timeline editor completion (split clips) and ensure all existing features work smoothly. Skip recording features for now to prioritize timeline polish.

## Current Status

✅ Video import and library

✅ Timeline with multiple tracks (2 video, 1 audio)

✅ Drag clips to timeline (fixed positioning)

✅ Trim clips with handles

✅ Delete clips (Delete/Backspace key)

✅ Playback with audio sync

✅ Export to MP4 with progress

✅ Zoom and snap controls

✅ Spacebar play/pause (works)

## Remaining Features

### 1. Split Clip UI (All Methods)

**Goal:** Allow users to split clips at the playhead position using multiple interaction methods.

**Implementation:**

- Add split button to `TransportControls.tsx` (near Step Forward/Backward buttons)
- Add keyboard shortcut 'S' to split selected clip at playhead
- Add right-click context menu on clips with "Split at Playhead" option
- All methods call `projectStore.splitClip(clipId, currentTimeMs)`

**Files to modify:**

- `src/components/Transport/TransportControls.tsx` - Add split button with Scissors icon
- `src/App.tsx` - Add 'S' keyboard handler in existing `handleKeyDown` function
- `src/components/Timeline/ClipView.tsx` - Add right-click context menu using Radix DropdownMenu

**Logic:**

```typescript
// When split is triggered:
1. Check if any clip is selected
2. Check if playhead is within the selected clip bounds
3. If yes, call splitClip(clipId, currentTimeMs)
4. If no, show brief error toast/message
```

### 2. Skip Recording Features

**Decision:** Recording infrastructure exists in UtilitiesPane but is not critical for MVP submission. Leave as-is (partially functional) and focus on timeline completion.

**No changes needed** - UtilitiesPane already has screen recording that saves files. Not integrating to timeline automatically is acceptable for MVP.

### 3. Keep Generic Asset Icons

**Decision:** Assets display type-based icons (Video/Audio/Image) which is sufficient for MVP. Skip thumbnail generation to save time.

**No changes needed** - LibraryGrid.tsx already shows appropriate icons and metadata.

### 4. Testing & Polish

**Goal:** Ensure all core features work smoothly together.

**Testing checklist:**

- Import multiple files (3+)
- Drag to different tracks
- Trim clips
- Split clips
- Delete clips
- Play/pause with spacebar
- Export multi-clip timeline
- Test with audio tracks
- Test zoom and snap

**Minor polish (if time permits):**

- Add tooltip to split button
- Improve split error messaging
- Add visual indicator when clip can be split

## Implementation Order

1. **Add split button to TransportControls** (15 mins)

   - Import Scissors icon from lucide-react
   - Add button between step forward and zoom controls
   - Connect to splitClip action

2. **Add 'S' keyboard shortcut** (10 mins)

   - Extend existing keydown handler in App.tsx
   - Check for selectedClipIds and playhead position

3. **Add right-click context menu to clips** (30 mins)

   - Install/use Radix DropdownMenu
   - Add context menu to ClipView
   - Include "Split at Playhead" and "Delete Clip" options

4. **Test all features together** (30 mins)

   - Run through full workflow: import → arrange → trim → split → delete → export
   - Test keyboard shortcuts
   - Test multi-track timeline

5. **Document any known issues** (15 mins)

   - Update README with feature list
   - Note any limitations or bugs for post-submission

## Success Criteria

- ✅ Can split clips using button, keyboard, or right-click
- ✅ All timeline operations work smoothly
- ✅ Export produces valid MP4 with multiple clips
- ✅ No crashes during normal editing workflow

## Out of Scope (Post-MVP)

- Webcam recording
- Audio recording
- Video thumbnails
- Multi-select clips
- Undo/redo
- Transitions/effects
- Text overlays
