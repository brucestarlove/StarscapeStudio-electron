# HTML5 Canvas Video Rendering System

## Overview

Starscape ClipForge uses an HTML5 Canvas-based rendering system for video playback and composition. This provides frame-accurate control, multi-layer composition, and transform support for Picture-in-Picture overlays.

## Architecture

### Core Components

1. **CanvasCompositor** (`src/lib/CanvasCompositor.ts`)
   - Main rendering engine for composition
   - Multi-layer video/image rendering
   - Transform support (position, scale, rotation, opacity)
   - RequestAnimationFrame-based rendering loop
   - Efficient image and video caching

2. **VideoPoolManager** (`src/lib/VideoPoolManager.ts`)
   - Video element pooling and management
   - Pre-loads and caches video elements
   - Manages playback state synchronization

3. **AudioManager** (`src/lib/AudioManager.ts`)
   - Audio synchronization with video playback
   - Multi-clip audio mixing
   - Volume and mute control

4. **Stage Component** (`src/components/Stage/Stage.tsx`)
   - React component wrapper for the canvas
   - Integration with Zustand stores
   - Playback loop management
   - Canvas lifecycle management

5. **TransformControls** (`src/components/Stage/TransformControls.tsx`)
   - Interactive PiP transform UI
   - Drag, resize, and rotate handles
   - Real-time canvas updates

## Key Features

### 1. Multi-Layer Composition

Layers are rendered from bottom to top based on track position:
- Track 1 (Main): Full-screen content
- Track 2+ (PiP): Overlay content with transforms

### 2. Transform Support

Canvas nodes support for Picture-in-Picture:
- Translation (x, y position)
- Rotation (degrees)
- Scaling (width, height)
- Opacity (0-1)

### 3. Professional File Path Handling

Uses standard absolute file paths with `file://` protocol, following the pattern of professional video editors (Adobe Premiere, DaVinci Resolve, Final Cut Pro)

## Usage

### Basic Setup

```typescript
import { CanvasCompositor } from '@/lib/CanvasCompositor';

// Create compositor
const canvas = document.getElementById('myCanvas');
const compositor = new CanvasCompositor(canvas, { fps: 30 });

// Load assets
await compositor.loadVideo(videoAsset);
await compositor.loadImage(imageAsset);

// Render frame
await compositor.renderFrame({
  timeMs: 1000,
  layers: [...]
});
```

### Playback Loop

```typescript
// Start playback
compositor.play((timeMs) => {
  console.log('Current time:', timeMs);
  updateUITimecode(timeMs);
});

// Pause
compositor.pause();

// Seek
compositor.seek(5000); // 5 seconds
```

### Applying Effects

```typescript
import { applyBlendMode, applyColorAdjustment, drawVignette } from '@/lib/CanvasEffects';

// In your render loop
ctx.save();

// Apply blend mode
applyBlendMode(ctx, 'multiply');

// Apply color adjustments
applyColorAdjustment(ctx, {
  brightness: 20,
  contrast: 10,
  saturation: -15
});

// Draw layer
ctx.drawImage(video, 0, 0);

// Add vignette
drawVignette(ctx, width, height, 0.5);

ctx.restore();
```

### Performance Optimization

```typescript
import { FrameBufferCache, PerformanceMonitor } from '@/lib/CanvasOptimizations';

// Create frame cache
const cache = new FrameBufferCache(30); // 30 frames

// Check cache before rendering
const cacheKey = `frame_${timeMs}`;
if (cache.has(cacheKey)) {
  const cachedFrame = cache.get(cacheKey);
  ctx.drawImage(cachedFrame, 0, 0);
} else {
  // Render and cache
  await renderFrame(frame);
  const bitmap = await createImageBitmap(canvas);
  cache.set(cacheKey, bitmap);
}

// Monitor performance
const monitor = new PerformanceMonitor();
monitor.recordFrame();

if (monitor.isPerformanceDegraded()) {
  console.warn('Performance degraded, FPS:', monitor.getFPS());
}
```

## Media Protocol Integration

The Canvas renderer uses the custom `media://` protocol for loading local video files:

```typescript
// Assets are loaded with media:// URLs
const asset = {
  id: 'asset_123',
  type: 'video',
  url: 'media:///absolute/path/to/video.mp4',
  duration: 30000
};

// Renderer handles protocol automatically
await renderer.loadVideo(asset);
```

## Performance Considerations

### Optimization Strategies

1. **Preload Assets**
   ```typescript
   await renderer.preloadFrame(frame);
   ```

2. **Use Frame Caching**
   - Cache pre-rendered frames for scrubbing
   - LRU eviction for memory management

3. **Offscreen Canvas**
   - Render complex layers offscreen
   - Composite to main canvas

4. **WebGL Acceleration**
   - Automatic fallback for complex effects
   - GPU-accelerated filters

5. **RAF Throttling**
   - Frame rate limiting to target FPS
   - Prevents unnecessary renders

### Memory Management

```typescript
// Clean up when done
renderer.destroy();

// Clear caches
frameCache.clear();
texturePool.clear();
```

## Browser Compatibility

- **Canvas 2D**: All modern browsers
- **OffscreenCanvas**: Chrome 69+, Firefox 105+
- **WebGL**: Chrome, Firefox, Safari, Edge
- **ImageBitmap**: Chrome 50+, Firefox 42+

## Future Enhancements

- [ ] GPU-accelerated color grading
- [ ] Real-time audio waveform visualization
- [ ] Advanced masking and rotoscoping
- [ ] Motion tracking integration
- [ ] 3D transforms (perspective)
- [ ] Hardware-accelerated video decode
- [ ] Multi-threaded rendering with Workers

## Debugging

### Enable Debug Mode

```typescript
// Log render timing
const startTime = performance.now();
await renderer.renderFrame(frame);
console.log('Render time:', performance.now() - startTime, 'ms');

// Check cache stats
console.log('Frame cache:', cache.getStats());
console.log('Texture pool:', texturePool.getStats());

// Monitor FPS
console.log('Current FPS:', monitor.getFPS());
console.log('Avg frame time:', monitor.getAverageFrameTime(), 'ms');
```

### Common Issues

**Video not loading**
- Check `media://` protocol registration in main.js
- Verify file path is absolute
- Check video codec compatibility

**Poor performance**
- Reduce canvas resolution
- Enable frame caching
- Use WebGL acceleration
- Limit simultaneous layers

**Seeking issues**
- Increase seek threshold (33ms for 30fps)
- Preload frames around playhead
- Use ImageBitmap for faster extraction

## Examples

### Basic Video Player

```typescript
const canvas = document.createElement('canvas');
canvas.width = 1920;
canvas.height = 1080;

const compositor = new CanvasCompositor(canvas);

// Load video
const asset = await getAssetById('video_123');
await compositor.loadVideo(asset);

// Render at 5 seconds
await compositor.renderFrame({
  timeMs: 5000,
  layers: [{
    asset,
    clip: { startMs: 0, endMs: 30000, trimStartMs: 0, trimEndMs: 30000, zIndex: 0 },
    sourceTimeMs: 5000
  }]
});
```

### Multi-Layer Composition

```typescript
// Background video
await compositor.renderLayer({
  asset: backgroundVideo,
  clip: bgClip,
  sourceTimeMs: currentTime,
  canvasNode: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0, opacity: 1 }
});

// Overlay image (picture-in-picture)
await compositor.renderLayer({
  asset: overlayImage,
  clip: overlayClip,
  sourceTimeMs: 0,
  canvasNode: { x: 600, y: 400, width: 640, height: 360, rotation: 0, opacity: 0.9 }
});

// Text overlay
drawTextOverlay(ctx, 'Starscape ClipForge', 0, -400, {
  font: 'bold 72px sans-serif',
  color: '#00C9FF',
  shadowBlur: 10
});
```

### Transition Effect

```typescript
// Fade transition
const progress = (currentTime - transitionStart) / transitionDuration;
applyTransition(ctx, { type: 'fade', progress }, width, height);

// Wipe transition
applyTransition(ctx, { 
  type: 'wipe', 
  progress, 
  direction: 'right' 
}, width, height);
```

## Testing

Run tests:
```bash
npm test -- CanvasVideoRenderer
npm test -- CanvasEffects
npm test -- CanvasOptimizations
```

## License

Part of Starscape ClipForge - Proprietary Software

