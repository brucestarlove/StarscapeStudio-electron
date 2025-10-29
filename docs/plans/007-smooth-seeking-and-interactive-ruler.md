I'll analyze the code to describe how the smooth seeking, interactive header, and synchronized timeline clicking work in this project.

[4 tools called]

Now let me check the utility functions and the DnD integration:

[2 tools called]

Perfect! Now I have a complete picture. Let me create a comprehensive description of how the smooth seeking and interactive timeline system works:

## Description: Smooth Seeking & Interactive Timeline Implementation

Here's how the smooth, synchronized timeline seeking system works in this video editor:

### **Architecture Overview**

The system uses **4 key components** working together:

1. **Playback Store** (Zustand state management)
2. **Ruler Component** (clickable timeline header)
3. **Playhead Component** (draggable scrubber)
4. **Utility Functions** (coordinate conversion & snapping)

---

### **1. State Management (playbackStore.ts)**

```8:52:src/store/playbackStore.ts
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
}

const initialPlaybackState: PlaybackState = {
  currentTimeMs: 0,
  playing: false,
  zoom: 0.1, // 0.1 pixels per millisecond (100ms = 10px)
  snapEnabled: true,
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
```

**Key Point:** The `seek()` function is the single source of truth for time updates. Everything calls this function.

---

### **2. Coordinate Conversion Utilities (utils.ts)**

```8:40:src/lib/utils.ts
// Timeline utility functions
export function msToPixels(ms: number, zoom: number): number {
  return ms * zoom;
}

export function pixelsToMs(pixels: number, zoom: number): number {
  return pixels / zoom;
}

export function formatTimecode(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
}

export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function snapToTimeline(value: number, zoom: number, snapEnabled: boolean = true): number {
  if (!snapEnabled) return value;
  
  // Determine snap interval based on zoom level
  let snapIntervalMs = 1000; // 1 second default
  if (zoom > 0.5) snapIntervalMs = 100; // 100ms for high zoom
  else if (zoom > 0.1) snapIntervalMs = 500; // 500ms for medium zoom
  else if (zoom < 0.05) snapIntervalMs = 5000; // 5 seconds for low zoom
  
  return snapToGrid(value, snapIntervalMs);
}
```

**Key Points:**
- **Bi-directional conversion**: `msToPixels()` and `pixelsToMs()` keep everything synchronized
- **Dynamic snapping**: Snap interval adjusts based on zoom level (more precise when zoomed in)
- **Zoom parameter**: The same `zoom` value is used everywhere for consistency

---

### **3. Interactive Ruler (Clickable Timeline Header)**

```36:42:src/components/Timeline/Ruler.tsx
  const handleRulerClick = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const timeMs = pixelsToMs(clickX, zoom);
    const snappedTime = snapToTimeline(timeMs, zoom, snapEnabled);
    seek(Math.max(0, snappedTime));
  };
```

**The full Ruler component:**

```44:92:src/components/Timeline/Ruler.tsx
  return (
    <div className="h-full flex bg-mid-navy">
      {/* Left spacer to match track header width (w-48 = 192px) */}
      <div className="w-48 bg-mid-navy/30 border-r border-white/10" />
      
      {/* Timeline ruler content */}
      <div 
        className="flex-1 relative cursor-pointer"
        onClick={handleRulerClick}
        title="Click to seek to position"
      >
        {/* Time markers */}
        {markers.map((marker) => (
          <div
            key={marker.time}
            className="absolute top-0 h-full flex flex-col"
            style={{ left: `${marker.x}px` }}
          >
            {/* Tick mark */}
            <div
              className={cn(
                "w-px bg-white/50",
                marker.isMajor ? "h-full" : "h-1/2"
              )}
            />
            
            {/* Time label */}
            {marker.isMajor && marker.label && (
              <div className="absolute top-1 left-1 text-caption text-white/70 font-mono">
                {marker.label}
              </div>
            )}
          </div>
        ))}

        {/* Grid lines (optional, for high zoom) */}
        {zoom > 0.2 && (
          <div className="absolute inset-0 pointer-events-none">
            {markers.map((marker) => (
              <div
                key={`grid-${marker.time}`}
                className="absolute top-0 w-px h-full bg-white/10"
                style={{ left: `${marker.x}px` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
```

**Key Points:**
- **Click handling**: Gets mouse X position relative to ruler, converts to time
- **Left spacer**: 192px (w-48) spacer aligns with track headers below
- **Dynamic markers**: Time markers regenerate based on zoom level
- **Snap-aware**: Respects snap settings when seeking

---

### **4. Draggable Playhead (Scrubber)**

```6:41:src/components/Timeline/Playhead.tsx
export function Playhead() {
  const { currentTimeMs, zoom } = usePlaybackStore();

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'playhead',
    data: {
      type: 'playhead' as const,
    },
  });

  const playheadX = msToPixels(currentTimeMs, zoom);
  const TRACK_HEADER_WIDTH = 192; // w-48 = 192px, matches track header and ruler left section

  return (
    <div
      className="absolute top-0 bottom-0 w-px z-50 pointer-events-none"
      style={{
        left: `${playheadX + TRACK_HEADER_WIDTH}px`,
      }}
    >
      {/* Diamond handle - always visible and draggable */}
      <div
        ref={setNodeRef}
        className={cn(
          "absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gradient-cyan-vibrant rotate-45 border border-white/20 cursor-col-resize pointer-events-auto shadow-lg",
          isDragging && "scale-125"
        )}
        {...listeners}
        {...attributes}
        title="Drag to seek through timeline"
      />

      {/* Line */}
      <div className="w-full h-full bg-gradient-cyan-vibrant shadow-glow-cyan pointer-events-none" />
    </div>
  );
}
```

**Drag handling in App.tsx:**

```116:120:src/App.tsx
    if (dragItem.type === 'playhead' && dropResult) {
      // Handle playhead seeking with snap
      const { seek, zoom, snapEnabled } = usePlaybackStore.getState();
      const snappedTime = snapToTimeline(dropResult.positionMs, zoom, snapEnabled);
      seek(Math.max(0, snappedTime));
```

**Key Points:**
- **Uses dnd-kit**: Declarative drag and drop library
- **Visual feedback**: Scales up when dragging
- **Position calculation**: `msToPixels(currentTimeMs, zoom) + TRACK_HEADER_WIDTH`
- **Snap on drop**: When drag ends, position snaps to grid if enabled

---

### **5. Synchronization Magic**

**The secret sauce is:**

1. **Single source of truth**: `currentTimeMs` in playback store
2. **Reactive updates**: Zustand automatically re-renders components when state changes
3. **Consistent offset**: `TRACK_HEADER_WIDTH = 192px` used in both Ruler and Playhead
4. **Same zoom everywhere**: All conversions use the same `zoom` value from store

**Layout structure:**

```18:26:src/components/Timeline/TimelineDock.tsx
            {/* Ruler */}
            <div className="h-8 border-b border-white/10">
              <Ruler />
            </div>

            {/* Tracks area */}
            <div className="flex-1 relative overflow-auto scrollbar-starscape">
              {/* Playhead */}
              <Playhead />
```

---

### **Key Implementation Details to Tell Your Agent:**

1. **Use a centralized state management library** (Zustand/Redux) with:
   - `currentTimeMs` (number)
   - `zoom` (pixels per millisecond)
   - `snapEnabled` (boolean)
   - `seek(timeMs)` function

2. **Create bidirectional conversion functions:**
   ```typescript
   msToPixels(ms, zoom) = ms * zoom
   pixelsToMs(pixels, zoom) = pixels / zoom
   ```

3. **Make the ruler clickable:**
   - Get click position: `event.clientX - rect.left`
   - Convert to time: `pixelsToMs(clickX, zoom)`
   - Apply snapping: `snapToTimeline(timeMs, zoom, snapEnabled)`
   - Update state: `seek(snappedTime)`

4. **Make the playhead draggable:**
   - Use a drag & drop library (dnd-kit, react-dnd)
   - Position with: `msToPixels(currentTimeMs, zoom) + headerWidth`
   - On drag end, convert position back to time and call `seek()`

5. **Keep alignment consistent:**
   - Use same header width constant (192px) in Ruler and Playhead
   - Both components offset their content by this amount

6. **Make snapping zoom-aware:**
   - Higher zoom = finer snap intervals (100ms)
   - Lower zoom = coarser intervals (5000ms)

7. **Generate time markers dynamically:**
   - Interval changes based on zoom
   - Major/minor tick marks for hierarchy
   - Only show labels on major ticks

---

This architecture provides **smooth, frame-accurate seeking** with **synchronized visual feedback** across multiple UI components. The key is treating pixel positions and time values as equivalent through consistent conversion functions.
