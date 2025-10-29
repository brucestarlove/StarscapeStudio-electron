import { useState, useEffect, useRef } from "react";
import { useProjectStore } from "@/store/projectStore";
import { usePlaybackStore } from "@/store/playbackStore";
import type { Clip, CanvasNode } from "@/types";

interface TransformControlsProps {
  canvasWidth: number;
  canvasHeight: number;
  displayWidth: number;
  displayHeight: number;
}

type HandleType = 'nw' | 'ne' | 'sw' | 'se' | 'rotate' | 'move' | null;

interface PipClipInfo {
  clip: Clip;
  canvasNode: CanvasNode;
  nodeId: string;
}

export function TransformControls({ canvasWidth, canvasHeight, displayWidth, displayHeight }: TransformControlsProps) {
  const { clips, canvasNodes, tracks, updateCanvasNode, selectedClipIds, selectClip } = useProjectStore();
  const { currentTimeMs } = usePlaybackStore();
  
  const [activeHandle, setActiveHandle] = useState<HandleType>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [initialTransform, setInitialTransform] = useState<CanvasNode | null>(null);
  const [shiftPressed, setShiftPressed] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Calculate scale factor from canvas space to display space
  const scaleX = displayWidth / canvasWidth;
  const scaleY = displayHeight / canvasHeight;
  
  // Get all PiP clips at current time (Track 2+)
  const pipClips = getPipClipsAtTime(clips, canvasNodes, tracks, currentTimeMs);
  
  // Get selected PiP clip
  const selectedPipClip = pipClips.find(p => selectedClipIds.includes(p.clip.id));
  
  // Track shift key state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(false);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  // Handle mouse down on clip or handle
  const handleMouseDown = (e: React.MouseEvent, handleType: HandleType, pipClip: PipClipInfo) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Select the clip
    selectClip(pipClip.clip.id);
    
    setActiveHandle(handleType);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialTransform({ ...pipClip.canvasNode });
  };
  
  // Handle global mouse move
  useEffect(() => {
    if (!activeHandle || !dragStart || !initialTransform || !selectedPipClip) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = (e.clientX - dragStart.x) / scaleX;
      const deltaY = (e.clientY - dragStart.y) / scaleY;
      
      const updates: Partial<CanvasNode> = {};
      
      if (activeHandle === 'move') {
        // Move the clip
        updates.x = Math.max(0, Math.min(canvasWidth - initialTransform.width, initialTransform.x + deltaX));
        updates.y = Math.max(0, Math.min(canvasHeight - initialTransform.height, initialTransform.y + deltaY));
      } else if (activeHandle === 'rotate') {
        // Calculate rotation based on mouse position relative to center
        const centerX = initialTransform.x + initialTransform.width / 2;
        const centerY = initialTransform.y + initialTransform.height / 2;
        
        const initialAngle = Math.atan2(dragStart.y / scaleY - centerY, dragStart.x / scaleX - centerX);
        const currentAngle = Math.atan2(e.clientY / scaleY - centerY, e.clientX / scaleX - centerX);
        
        const rotation = initialTransform.rotation + ((currentAngle - initialAngle) * 180 / Math.PI);
        updates.rotation = rotation % 360;
      } else if (activeHandle) {
        // Resize handle
        handleResize(activeHandle, deltaX, deltaY, initialTransform, updates, shiftPressed);
      }
      
      if (Object.keys(updates).length > 0) {
        updateCanvasNode(selectedPipClip.nodeId, updates);
      }
    };
    
    const handleMouseUp = () => {
      setActiveHandle(null);
      setDragStart(null);
      setInitialTransform(null);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeHandle, dragStart, initialTransform, selectedPipClip, scaleX, scaleY, shiftPressed]);
  
  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: displayWidth, height: displayHeight }}
    >
      {/* Render bounding boxes for all PiP clips */}
      {pipClips.map((pipClip) => {
        const { canvasNode } = pipClip;
        const isSelected = selectedClipIds.includes(pipClip.clip.id);
        
        // Convert canvas coordinates to display coordinates
        const displayX = canvasNode.x * scaleX;
        const displayY = canvasNode.y * scaleY;
        const displayW = canvasNode.width * scaleX;
        const displayH = canvasNode.height * scaleY;
        
        return (
          <div key={pipClip.clip.id}>
            {/* Bounding box */}
            <div
              className={`absolute pointer-events-auto cursor-move ${
                isSelected ? 'border-2 border-light-blue' : 'border border-white/30 hover:border-white/50'
              }`}
              style={{
                left: displayX,
                top: displayY,
                width: displayW,
                height: displayH,
                transform: `rotate(${canvasNode.rotation}deg)`,
                transformOrigin: 'center',
              }}
              onMouseDown={(e) => handleMouseDown(e, 'move', pipClip)}
            />
            
            {/* Transform handles (only for selected clip) */}
            {isSelected && (
              <>
                {/* Corner resize handles */}
                {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => {
                  const isTop = handle.startsWith('n');
                  const isLeft = handle.endsWith('w');
                  
                  return (
                    <div
                      key={handle}
                      className="absolute w-3 h-3 bg-light-blue border-2 border-white rounded-full pointer-events-auto cursor-nwse-resize hover:scale-125 transition-transform"
                      style={{
                        left: displayX + (isLeft ? -6 : displayW - 6),
                        top: displayY + (isTop ? -6 : displayH - 6),
                        cursor: handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize',
                      }}
                      onMouseDown={(e) => handleMouseDown(e, handle, pipClip)}
                    />
                  );
                })}
                
                {/* Rotation handle */}
                <div
                  className="absolute w-3 h-3 bg-purple border-2 border-white rounded-full pointer-events-auto cursor-grab hover:scale-125 transition-transform"
                  style={{
                    left: displayX + displayW / 2 - 6,
                    top: displayY - 30,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, 'rotate', pipClip)}
                />
                
                {/* Rotation indicator line */}
                <div
                  className="absolute w-0.5 bg-purple/50 pointer-events-none"
                  style={{
                    left: displayX + displayW / 2,
                    top: displayY - 24,
                    height: 24,
                  }}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Helper to handle resize logic
function handleResize(
  handle: 'nw' | 'ne' | 'sw' | 'se',
  deltaX: number,
  deltaY: number,
  initial: CanvasNode,
  updates: Partial<CanvasNode>,
  maintainAspect: boolean
) {
  const isLeft = handle.endsWith('w');
  const isTop = handle.startsWith('n');
  
  let newWidth = initial.width;
  let newHeight = initial.height;
  let newX = initial.x;
  let newY = initial.y;
  
  if (maintainAspect) {
    // Maintain aspect ratio
    const aspectRatio = initial.width / initial.height;
    
    if (isLeft) {
      newWidth = initial.width - deltaX;
      newHeight = newWidth / aspectRatio;
      newX = initial.x + deltaX;
      if (isTop) {
        newY = initial.y + (initial.height - newHeight);
      }
    } else {
      newWidth = initial.width + deltaX;
      newHeight = newWidth / aspectRatio;
      if (isTop) {
        newY = initial.y + (initial.height - newHeight);
      }
    }
  } else {
    // Free resize
    if (isLeft) {
      newWidth = initial.width - deltaX;
      newX = initial.x + deltaX;
    } else {
      newWidth = initial.width + deltaX;
    }
    
    if (isTop) {
      newHeight = initial.height - deltaY;
      newY = initial.y + deltaY;
    } else {
      newHeight = initial.height + deltaY;
    }
  }
  
  // Apply minimum size constraints
  const minSize = 50;
  if (newWidth < minSize || newHeight < minSize) {
    return;
  }
  
  updates.width = newWidth;
  updates.height = newHeight;
  updates.x = newX;
  updates.y = newY;
}

// Helper to get PiP clips at current time
function getPipClipsAtTime(
  clips: Record<string, Clip>,
  canvasNodes: Record<string, CanvasNode>,
  tracks: any[],
  currentTimeMs: number
): PipClipInfo[] {
  const pipClips: PipClipInfo[] = [];
  
  // Iterate through tracks 2+ (skip track-1 which is the main track)
  tracks.forEach((track, index) => {
    if (index === 0 || !track.visible || track.type === 'audio') return;
    
    track.clips.forEach((clipId: string) => {
      const clip = clips[clipId];
      if (!clip) return;
      
      // Check if current time is within clip bounds
      if (currentTimeMs >= clip.startMs && currentTimeMs < clip.endMs) {
        // Find corresponding canvas node
        const nodeEntry = Object.entries(canvasNodes).find(([_, node]) => node.clipId === clipId);
        if (nodeEntry) {
          const [nodeId, canvasNode] = nodeEntry;
          pipClips.push({ clip, canvasNode, nodeId });
        }
      }
    });
  });
  
  return pipClips;
}

