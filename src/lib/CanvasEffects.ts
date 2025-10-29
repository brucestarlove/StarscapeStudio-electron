/**
 * Canvas Composition Effects
 * 
 * Provides advanced composition effects for video layers including:
 * - Blend modes (multiply, screen, overlay, etc.)
 * - Color adjustments (brightness, contrast, saturation)
 * - Filters (blur, sharpen, grayscale)
 * - Transitions (fade, wipe, dissolve)
 */

export type BlendMode = 
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion';

export interface ColorAdjustment {
  brightness?: number;  // -100 to 100
  contrast?: number;    // -100 to 100
  saturation?: number;  // -100 to 100
  hue?: number;         // 0 to 360
}

export interface FilterEffect {
  blur?: number;        // 0 to 100 (px)
  sharpen?: number;     // 0 to 100
  grayscale?: boolean;
  sepia?: boolean;
  invert?: boolean;
}

export interface TransitionEffect {
  type: 'fade' | 'wipe' | 'dissolve' | 'slide';
  progress: number;     // 0 to 1
  direction?: 'left' | 'right' | 'up' | 'down';
}

/**
 * Apply blend mode to canvas context
 */
export function applyBlendMode(ctx: CanvasRenderingContext2D, mode: BlendMode): void {
  ctx.globalCompositeOperation = mode as GlobalCompositeOperation;
}

/**
 * Apply color adjustment to canvas using CSS filters
 */
export function applyColorAdjustment(ctx: CanvasRenderingContext2D, adjustment: ColorAdjustment): void {
  const filters: string[] = [];
  
  if (adjustment.brightness !== undefined) {
    // Convert -100 to 100 range to 0 to 2 range
    const brightness = 1 + (adjustment.brightness / 100);
    filters.push(`brightness(${brightness})`);
  }
  
  if (adjustment.contrast !== undefined) {
    // Convert -100 to 100 range to 0 to 2 range
    const contrast = 1 + (adjustment.contrast / 100);
    filters.push(`contrast(${contrast})`);
  }
  
  if (adjustment.saturation !== undefined) {
    // Convert -100 to 100 range to 0 to 2 range
    const saturation = 1 + (adjustment.saturation / 100);
    filters.push(`saturate(${saturation})`);
  }
  
  if (adjustment.hue !== undefined) {
    filters.push(`hue-rotate(${adjustment.hue}deg)`);
  }
  
  ctx.filter = filters.join(' ');
}

/**
 * Apply filter effects to canvas
 */
export function applyFilterEffect(ctx: CanvasRenderingContext2D, filter: FilterEffect): void {
  const filters: string[] = [];
  
  if (filter.blur !== undefined && filter.blur > 0) {
    filters.push(`blur(${filter.blur}px)`);
  }
  
  if (filter.grayscale) {
    filters.push('grayscale(100%)');
  }
  
  if (filter.sepia) {
    filters.push('sepia(100%)');
  }
  
  if (filter.invert) {
    filters.push('invert(100%)');
  }
  
  ctx.filter = filters.join(' ');
}

/**
 * Reset canvas filters
 */
export function resetFilters(ctx: CanvasRenderingContext2D): void {
  ctx.filter = 'none';
}

/**
 * Apply transition effect by modifying alpha or clipping
 */
export function applyTransition(
  ctx: CanvasRenderingContext2D,
  effect: TransitionEffect,
  width: number,
  height: number
): void {
  const { type, progress, direction = 'right' } = effect;
  
  switch (type) {
    case 'fade':
      // Simple alpha fade
      ctx.globalAlpha *= (1 - progress);
      break;
      
    case 'dissolve':
      // Gradual opacity with noise pattern
      ctx.globalAlpha *= (1 - progress);
      break;
      
    case 'wipe':
      // Directional wipe using clipping
      ctx.save();
      ctx.beginPath();
      
      switch (direction) {
        case 'right':
          ctx.rect(-width / 2, -height / 2, width * (1 - progress), height);
          break;
        case 'left':
          ctx.rect(-width / 2 + width * progress, -height / 2, width * (1 - progress), height);
          break;
        case 'down':
          ctx.rect(-width / 2, -height / 2, width, height * (1 - progress));
          break;
        case 'up':
          ctx.rect(-width / 2, -height / 2 + height * progress, width, height * (1 - progress));
          break;
      }
      
      ctx.clip();
      ctx.restore();
      break;
      
    case 'slide':
      // Slide transition
      switch (direction) {
        case 'right':
          ctx.translate(-width * progress, 0);
          break;
        case 'left':
          ctx.translate(width * progress, 0);
          break;
        case 'down':
          ctx.translate(0, -height * progress);
          break;
        case 'up':
          ctx.translate(0, height * progress);
          break;
      }
      break;
  }
}

/**
 * Draw a gradient overlay
 */
export function drawGradientOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: string[],
  angle: number = 0
): void {
  ctx.save();
  
  // Calculate gradient direction based on angle
  const radians = (angle * Math.PI) / 180;
  const x1 = -width / 2;
  const y1 = -height / 2;
  const x2 = x1 + Math.cos(radians) * width;
  const y2 = y1 + Math.sin(radians) * height;
  
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  
  // Add color stops
  colors.forEach((color, index) => {
    gradient.addColorStop(index / (colors.length - 1), color);
  });
  
  ctx.fillStyle = gradient;
  ctx.fillRect(-width / 2, -height / 2, width, height);
  
  ctx.restore();
}

/**
 * Draw a vignette effect
 */
export function drawVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number = 0.5
): void {
  ctx.save();
  
  const centerX = 0;
  const centerY = 0;
  const radius = Math.max(width, height) / 2;
  
  const gradient = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, radius
  );
  
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(0.7, `rgba(0, 0, 0, ${intensity * 0.3})`);
  gradient.addColorStop(1, `rgba(0, 0, 0, ${intensity})`);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(-width / 2, -height / 2, width, height);
  
  ctx.restore();
}

/**
 * Draw text overlay with shadow
 */
export function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options?: {
    font?: string;
    color?: string;
    shadowBlur?: number;
    shadowColor?: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
  }
): void {
  ctx.save();
  
  // Set text properties
  ctx.font = options?.font || '48px sans-serif';
  ctx.fillStyle = options?.color || '#FFFFFF';
  ctx.textAlign = options?.align || 'center';
  ctx.textBaseline = options?.baseline || 'middle';
  
  // Add shadow
  if (options?.shadowBlur) {
    ctx.shadowBlur = options.shadowBlur;
    ctx.shadowColor = options?.shadowColor || 'rgba(0, 0, 0, 0.8)';
  }
  
  ctx.fillText(text, x, y);
  
  ctx.restore();
}

/**
 * Apply chromatic aberration effect
 */
export function applyChromaticAberration(
  ctx: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement,
  intensity: number = 5
): void {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  
  // Create temporary canvas for offset channels
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;
  
  // Draw red channel offset
  tempCtx.globalCompositeOperation = 'screen';
  tempCtx.translate(-intensity, 0);
  tempCtx.drawImage(sourceCanvas, 0, 0);
  
  // Draw blue channel offset
  tempCtx.translate(intensity * 2, 0);
  tempCtx.drawImage(sourceCanvas, 0, 0);
  
  // Copy result back
  ctx.drawImage(tempCanvas, 0, 0);
}

/**
 * Draw border/frame around canvas
 */
export function drawBorder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options?: {
    color?: string;
    lineWidth?: number;
    style?: 'solid' | 'dashed' | 'dotted';
  }
): void {
  ctx.save();
  
  ctx.strokeStyle = options?.color || '#FFFFFF';
  ctx.lineWidth = options?.lineWidth || 2;
  
  if (options?.style === 'dashed') {
    ctx.setLineDash([10, 5]);
  } else if (options?.style === 'dotted') {
    ctx.setLineDash([2, 3]);
  }
  
  ctx.strokeRect(-width / 2, -height / 2, width, height);
  
  ctx.restore();
}

