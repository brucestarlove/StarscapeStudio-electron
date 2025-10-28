# HTML5 Canvas Video Rendering System

## Overview

Starscape ClipForge now uses a sophisticated HTML5 Canvas-based rendering system for video playback and composition. This provides frame-accurate control, multi-layer composition, and advanced effects processing.

## Architecture

### Core Components

1. **CanvasVideoRenderer** (`src/lib/CanvasVideoRenderer.ts`)
   - Main rendering engine
   - Frame-accurate video playback
   - Multi-layer composition
   - RequestAnimationFrame-based rendering loop
   - Asset preloading and caching

2. **CanvasEffects** (`src/lib/CanvasEffects.ts`)
   - Blend modes (multiply, screen, overlay, etc.)
   - Color adjustments (brightness, contrast, saturation, hue)
   - Filter effects (blur, sharpen, grayscale, sepia)
   - Transitions (fade, wipe, dissolve, slide)
   - Overlays (gradients, vignettes, text)

3. **CanvasOptimizations** (`src/lib/CanvasOptimizations.ts`)
   - Offscreen canvas support
   - WebGL-accelerated rendering
   - Frame buffer caching
   - Texture pooling
   - Performance monitoring

4. **Stage Component** (`src/components/Stage/Stage.tsx`)
   - React component wrapper
   - Integration with Zustand stores
   - Playback loop management
   - Canvas lifecycle management

## Key Features

### 1. Frame-Accurate Rendering

```typescript
// Render a specific frame at exact time
await renderer.renderFrame({
  timeMs: 1500,
  layers: [
    {
      asset: videoAsset,
      clip: videoClip,
      sourceTimeMs: 500, // Accounting for trim
      canvasNode: transformData
    }
  ]
});
```

### 2. Multi-Layer Composition

Layers are rendered from bottom to top based on `zIndex`:

```typescript
const layers = [
  { asset: backgroundVideo, clip: bgClip, zIndex: 0 },
  { asset: overlayImage, clip: imgClip, zIndex: 1 },
  { asset: titleVideo, clip: titleClip, zIndex: 2 }
];
```

### 3. Transform Support

Canvas nodes support:
- Translation (x, y)
- Rotation (degrees)
- Scaling (width, height)
- Opacity (0-1)

```typescript
canvasNode = {
  x: 100,        // Offset from center
  y: -50,
  width: 1920,
  height: 1080,
  rotation: 15,  // Degrees
  opacity: 0.8
};
```

### 4. Trim and Seek

Accurate source time calculation:
```typescript
const sourceTimeMs = (currentTimeMs - clip.startMs) + clip.trimStartMs;
```

## Usage

### Basic Setup

```typescript
import { CanvasVideoRenderer } from '@/lib/CanvasVideoRenderer';

// Create renderer
const canvas = document.getElementById('myCanvas');
const renderer = new CanvasVideoRenderer(canvas, { fps: 30 });

// Load assets
await renderer.loadVideo(videoAsset);
await renderer.loadImage(imageAsset);

// Render frame
await renderer.renderFrame({
  timeMs: 1000,
  layers: [...]
});
```

### Playback Loop

```typescript
// Start playback
renderer.play((timeMs) => {
  console.log('Current time:', timeMs);
  updateUITimecode(timeMs);
});

// Pause
renderer.pause();

// Seek
renderer.seek(5000); // 5 seconds
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

const renderer = new CanvasVideoRenderer(canvas);

// Load video
const asset = await getAssetById('video_123');
await renderer.loadVideo(asset);

// Render at 5 seconds
await renderer.renderFrame({
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
await renderer.renderLayer({
  asset: backgroundVideo,
  clip: bgClip,
  sourceTimeMs: currentTime,
  canvasNode: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0, opacity: 1 }
});

// Overlay image (picture-in-picture)
await renderer.renderLayer({
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

