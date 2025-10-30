import { useEffect, useState } from "react";
import type { CanvasNode } from "@/types";
import { cn } from "@/lib/utils";

interface TransformControlsProps {
  selectedClipId: string | null;
  canvasNode: CanvasNode | null;
  onUpdate: (updates: Partial<CanvasNode>) => void;
  canvasDisplayWidth: number;
  canvasDisplayHeight: number;
  canvasLogicalWidth: number;
  canvasLogicalHeight: number;
  trackIndex: number; // Only show controls for Track 2+ (not Track 1)
}

type DragMode = 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | 'rotate' | null;

export function TransformControls({
  selectedClipId,
  canvasNode,
  onUpdate,
  canvasDisplayWidth,
  canvasDisplayHeight,
  canvasLogicalWidth,
  canvasLogicalHeight,
  trackIndex,
}: TransformControlsProps) {
  // Only render for Track 2+ clips (not main track)
  // This check must be BEFORE hooks to avoid React hooks error
  if (!selectedClipId || !canvasNode || trackIndex === 0) {
    return null;
  }

  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [initialNode, setInitialNode] = useState<CanvasNode | null>(null);

  // Calculate scale factors between logical and display space
  const scaleX = canvasDisplayWidth / canvasLogicalWidth;
  const scaleY = canvasDisplayHeight / canvasLogicalHeight;

  // Convert logical coordinates to display coordinates
  const toDisplayX = (logicalX: number) => logicalX * scaleX;
  const toDisplayY = (logicalY: number) => logicalY * scaleY;
  const toDisplayWidth = (logicalWidth: number) => logicalWidth * scaleX;
  const toDisplayHeight = (logicalHeight: number) => logicalHeight * scaleY;

  // Convert display coordinates to logical coordinates
  const toLogicalX = (displayX: number) => displayX / scaleX;
  const toLogicalY = (displayY: number) => displayY / scaleY;

  // Calculate bounding box in display space
  const displayX = toDisplayX(canvasNode.x);
  const displayY = toDisplayY(canvasNode.y);
  const displayWidth = toDisplayWidth(canvasNode.width);
  const displayHeight = toDisplayHeight(canvasNode.height);

  // Rotation handle extends from top center
  const rotationHandleLength = 40;
  const centerX = displayX + displayWidth / 2;
  const centerY = displayY + displayHeight / 2;
  
  // Calculate rotation handle position accounting for rotation
  const rotationRad = (canvasNode.rotation * Math.PI) / 180;
  const rotationHandleX = centerX + Math.sin(rotationRad) * rotationHandleLength;
  const rotationHandleY = centerY - Math.cos(rotationRad) * rotationHandleLength;

  const handleMouseDown = (e: React.MouseEvent, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    setDragMode(mode);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialNode({ ...canvasNode });
  };

  useEffect(() => {
    if (!dragMode || !dragStart || !initialNode) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      const deltaLogicalX = toLogicalX(deltaX);
      const deltaLogicalY = toLogicalY(deltaY);

      if (dragMode === 'move') {
        // Move the entire clip
        onUpdate({
          x: Math.max(0, Math.min(canvasLogicalWidth - initialNode.width, initialNode.x + deltaLogicalX)),
          y: Math.max(0, Math.min(canvasLogicalHeight - initialNode.height, initialNode.y + deltaLogicalY)),
        });
      } else if (dragMode.startsWith('resize-')) {
        // Resize from a corner
        const isNW = dragMode === 'resize-nw';
        const isNE = dragMode === 'resize-ne';
        const isSW = dragMode === 'resize-sw';
        const isSE = dragMode === 'resize-se';

        let newX = initialNode.x;
        let newY = initialNode.y;
        let newWidth = initialNode.width;
        let newHeight = initialNode.height;

        if (isNW || isNE) {
          // Resize from top
          newHeight = Math.max(20, initialNode.height - deltaLogicalY);
          newY = initialNode.y + (initialNode.height - newHeight);
        }
        if (isSW || isSE) {
          // Resize from bottom
          newHeight = Math.max(20, initialNode.height + deltaLogicalY);
        }
        if (isNW || isSW) {
          // Resize from left
          newWidth = Math.max(20, initialNode.width - deltaLogicalX);
          newX = initialNode.x + (initialNode.width - newWidth);
        }
        if (isNE || isSE) {
          // Resize from right
          newWidth = Math.max(20, initialNode.width + deltaLogicalX);
        }

        // Clamp to canvas bounds
        newX = Math.max(0, Math.min(canvasLogicalWidth - newWidth, newX));
        newY = Math.max(0, Math.min(canvasLogicalHeight - newHeight, newY));

        onUpdate({ x: newX, y: newY, width: newWidth, height: newHeight });
      } else if (dragMode === 'rotate') {
        // Calculate rotation angle from center
        const centerX = initialNode.x + initialNode.width / 2;
        const centerY = initialNode.y + initialNode.height / 2;
        const startAngle = Math.atan2(
          toLogicalY(dragStart.y - toDisplayY(centerY)),
          toLogicalX(dragStart.x - toDisplayX(centerX))
        );
        const currentAngle = Math.atan2(
          toLogicalY(e.clientY - toDisplayY(centerY)),
          toLogicalX(e.clientX - toDisplayX(centerX))
        );
        const angleDelta = (currentAngle - startAngle) * (180 / Math.PI);
        onUpdate({ rotation: initialNode.rotation + angleDelta });
      }
    };

    const handleMouseUp = () => {
      setDragMode(null);
      setDragStart(null);
      setInitialNode(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragMode, dragStart, initialNode, canvasNode, onUpdate, canvasLogicalWidth, canvasLogicalHeight, scaleX, scaleY]);

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: 0,
        top: 0,
        width: canvasDisplayWidth,
        height: canvasDisplayHeight,
      }}
    >
      {/* Bounding box */}
      <div
        className="absolute border-2 border-light-blue pointer-events-none"
        style={{
          left: displayX,
          top: displayY,
          width: displayWidth,
          height: displayHeight,
          transform: `rotate(${canvasNode.rotation}deg)`,
          transformOrigin: 'center center',
        }}
      />

      {/* Corner resize handles */}
      {[
        { mode: 'resize-nw' as DragMode, x: displayX, y: displayY },
        { mode: 'resize-ne' as DragMode, x: displayX + displayWidth, y: displayY },
        { mode: 'resize-sw' as DragMode, x: displayX, y: displayY + displayHeight },
        { mode: 'resize-se' as DragMode, x: displayX + displayWidth, y: displayY + displayHeight },
      ].map((handle, idx) => (
        <div
          key={idx}
          className={cn(
            "absolute w-3 h-3 bg-light-blue border-2 border-white rounded-sm cursor-pointer pointer-events-auto",
            dragMode === handle.mode && "bg-purple"
          )}
          style={{
            left: handle.x - 6,
            top: handle.y - 6,
            transform: `rotate(${canvasNode.rotation}deg)`,
            transformOrigin: `${handle.x}px ${handle.y}px`,
          }}
          onMouseDown={(e) => handleMouseDown(e, handle.mode)}
        />
      ))}

      {/* Rotation handle */}
      <div
        className={cn(
          "absolute w-3 h-3 bg-purple border-2 border-white rounded-sm cursor-pointer pointer-events-auto",
          dragMode === 'rotate' && "bg-light-blue"
        )}
        style={{
          left: rotationHandleX - 6,
          top: rotationHandleY - 6,
        }}
        onMouseDown={(e) => handleMouseDown(e, 'rotate')}
      />

      {/* Rotation handle line */}
      <div
        className="absolute border-l-2 border-purple/50 pointer-events-none"
        style={{
          left: centerX,
          top: centerY,
          width: 2,
          height: rotationHandleLength,
          transform: `rotate(${canvasNode.rotation}deg)`,
          transformOrigin: 'center top',
        }}
      />

      {/* Drag area for moving */}
      <div
        className="absolute cursor-move pointer-events-auto"
        style={{
          left: displayX,
          top: displayY,
          width: displayWidth,
          height: displayHeight,
          transform: `rotate(${canvasNode.rotation}deg)`,
          transformOrigin: 'center center',
        }}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      />
    </div>
  );
}

