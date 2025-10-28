# Complete ClipForge MVP Features

## Current State Analysis

The app has:

- ✅ Desktop app that launches (Electron)
- ✅ Basic video import (drag & drop and file picker)
- ✅ Timeline view showing imported clips
- ✅ Trim data model (trimStartMs, trimEndMs in Clip type)
- ✅ Export backend (electron/export.js with FFmpeg)
- ⚠️ Video preview player (only shows placeholders, not actual video)
- ⚠️ Trim UI (handles visible but not interactive)
- ⚠️ Export UI (button exists but not wired up)

## Missing MVP Features

### 1. Real Video Playback in Stage

**Problem**: Stage component (`src/components/Stage/Stage.tsx`) only shows placeholder icons, not actual video playback.

**Solution**: Replace placeholder rendering with HTML5 `<video>` elements that:

- Display the video asset at the current playhead position
- Calculate which clip is visible at currentTimeMs
- Seek to the correct time within the source video (accounting for trim)
- Sync with playback store (playing state)

**Files to modify**:

- `src/components/Stage/Stage.tsx` - Add video element rendering
- `src/store/playbackStore.ts` - May need to calculate visible clip helper

### 2. Interactive Trim Handles

**Problem**: Trim handles are visible in `ClipView.tsx` but clicking/dragging them doesn't work.

**Solution**: Make trim handles draggable with @dnd-kit:

- Add `useDraggable` hooks for left and right trim handles
- Pass trim-handle drag data with clipId and side
- Update `App.tsx` handleDragEnd to properly calculate deltaMs from drag distance
- Visual feedback during trim operation

**Files to modify**:

- `src/components/Timeline/ClipView.tsx` - Make handles draggable
- `src/App.tsx` - Fix trim-handle drag logic (currently simplified/broken)

### 3. Export Dialog & Wiring

**Problem**: Export button in `TopBar.tsx` just logs to console.

**Solution**: Create export dialog component and wire to backend:

- New component: `src/components/ExportDialog.tsx`
- Export settings: format (mp4/mov), resolution (720p/1080p/source), quality
- Progress indicator using IPC progress events
- Call `exportProject()` from bindings with project JSON
- Save file dialog for output path

**Files to create/modify**:

- `src/components/ExportDialog.tsx` (new)
- `src/components/TopBar.tsx` - Open export dialog
- `src/lib/bindings.ts` - Already has exportProject, verify it works

### 4. App Packaging Verification

**Problem**: Need to verify the app packages correctly (MVP requirement).

**Solution**:

- Test `npm run electron:build` 
- Verify .dmg/.app is created in `build/` directory
- Test launching the packaged app (not just dev mode)
- Verify FFmpeg binaries are bundled correctly

**Files to check**:

- `electron-builder.json` - Build configuration
- `package.json` - Build scripts

## Implementation Details

### Video Playback Logic

```typescript
// In Stage.tsx, calculate visible clip at currentTimeMs
function getVisibleClip(clips, tracks, currentTimeMs) {
  for (const track of tracks.filter(t => t.type === 'video')) {
    const clip = track.clips
      .map(id => clips[id])
      .find(c => c.startMs <= currentTimeMs && c.endMs > currentTimeMs);
    if (clip) return clip;
  }
  return null;
}

// Calculate source video time accounting for trim
const sourceTimeMs = (currentTimeMs - clip.startMs) + clip.trimStartMs;
```

### Trim Handle Dragging

```typescript
// In ClipView.tsx, make each handle draggable
const leftHandle = useDraggable({
  id: `${clip.id}-left`,
  data: { type: 'trim-handle', clipId: clip.id, side: 'left' }
});

// In App.tsx handleDragEnd, calculate delta from drag distance
if (dragItem.type === 'trim-handle') {
  const dragDeltaX = event.delta.x; // pixels
  const deltaMs = dragDeltaX / zoom; // convert to milliseconds
  trimClip(dragItem.clipId!, dragItem.side!, deltaMs);
}
```

### Export Dialog

- Use existing Radix Dialog component
- Form with settings dropdowns
- Call `await exportProject(JSON.stringify(projectState), settings)`
- Listen to progress events with `listenExportProgress()`
- Show progress bar during export
- Success message with "Open in Finder" option

## Testing Checklist

After implementation, verify:

- [ ] Import video file displays in library with thumbnail
- [ ] Drag video to timeline creates clip
- [ ] Stage shows actual video playback (not placeholder)
- [ ] Play/pause controls work
- [ ] Scrubbing playhead updates video frame
- [ ] Trim handles can be dragged left/right
- [ ] Trimming updates clip duration on timeline
- [ ] Export dialog opens and accepts settings
- [ ] Export produces valid MP4 file
- [ ] `npm run electron:build` succeeds
- [ ] Packaged app launches and works

## Priority Order

1. **Video Playback** - Core functionality, most visible
2. **Trim Handles** - Key editing feature
3. **Export Dialog** - Complete the workflow
4. **Package Verification** - Final gate