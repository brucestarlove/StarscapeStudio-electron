# Split Clip - Quick Reference

## How to Split a Clip

Split a selected clip at the playhead position using any of these methods:

### Method 1: Button Click
1. Select a clip by clicking on it in the timeline
2. Move the playhead to the desired split point
3. Click the **Scissors icon** in the transport controls bar
4. The clip will split at the playhead position

### Method 2: Keyboard Shortcut
1. Select a clip by clicking on it in the timeline
2. Move the playhead to the desired split point
3. Press the **S key**
4. The clip will split at the playhead position

### Method 3: Right-Click Context Menu
1. Move the playhead to the desired split point
2. Right-click on the clip in the timeline
3. Select **"Split at Playhead"** from the context menu
4. The clip will split at the playhead position

## Requirements for Splitting

✅ A clip must be selected (or will auto-select on right-click)
✅ The playhead must be **inside** the clip bounds (not at edges)
✅ Cannot split if playhead is outside the selected clip

## What Happens After Split

The selected clip becomes two clips:
- **First clip:** Original start to playhead position
- **Second clip:** Playhead position to original end
- Both clips retain their asset references and effects
- Both clips are placed consecutively on the same track

## Keyboard Shortcuts Reference

| Action | Shortcut |
|--------|----------|
| Split Clip | S |
| Delete Clip | Delete or Backspace |
| Play/Pause | Space |

## Tips

💡 **Keyboard method is fastest** for power users who prefer not reaching for the mouse
💡 **Right-click method** automatically selects the target clip - useful if you're unsure which clip to split
💡 **Button method** is always visible in the UI - good reference for learning
