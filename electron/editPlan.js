/**
 * Parse project JSON into EditPlan structure
 */
function buildPlan(projectJsonString) {
  let parsed;
  try {
    parsed = JSON.parse(projectJsonString);
  } catch (e) {
    throw new Error(`Invalid project JSON: ${e.message}`);
  }

  const { id, assets = {}, clips = {}, tracks = {}, canvasNodes = {} } = parsed;

  if (!id) {
    throw new Error('Project JSON missing id field');
  }

  const mainTrack = [];
  const overlayTrack = [];

  // Create a map of clipId -> canvasNode for quick lookup
  const canvasNodeMap = {};
  Object.values(canvasNodes).forEach(node => {
    canvasNodeMap[node.clipId] = node;
  });

  // Process clips by track role
  for (const [trackId, track] of Object.entries(tracks)) {
    if (!track.clipOrder || !Array.isArray(track.clipOrder)) {
      continue;
    }

    for (const clipId of track.clipOrder) {
      const clip = clips[clipId];
      if (!clip) continue;

      const asset = assets[clip.assetId];
      if (!asset) continue;

      // Convert file:// URLs to local paths
      let srcPath = asset.src;
      if (srcPath.startsWith('file://')) {
        srcPath = srcPath.substring(7); // Remove 'file://' prefix
      }

      // Validate clip timing
      if (clip.outMs <= clip.inMs) {
        throw new Error(`Clip ${clipId} has invalid timing: out <= in`);
      }

      const seqClip = {
        srcPath,
        inMs: clip.inMs,
        outMs: clip.outMs,
        startMs: clip.startMs,
        endMs: clip.endMs,
      };

      // Attach asset metadata for aspect ratio preservation (especially for images)
      if (asset.width && asset.height) {
        seqClip.assetWidth = asset.width;
        seqClip.assetHeight = asset.height;
      }

      // Attach canvasNode for overlay tracks (PiP transforms)
      if (track.role === 'overlay' && canvasNodeMap[clipId]) {
        const canvasNode = canvasNodeMap[clipId];
        seqClip.canvasNode = {
          x: canvasNode.x,
          y: canvasNode.y,
          width: canvasNode.width,
          height: canvasNode.height,
          rotation: canvasNode.rotation,
          opacity: canvasNode.opacity,
        };
      }

      // All clips go to mainTrack for now (we'll handle overlays later)
      if (track.role === 'main') {
        mainTrack.push(seqClip);
      } else {
        overlayTrack.push(seqClip);
      }
    }
  }

  // Sort main track by start time
  mainTrack.sort((a, b) => a.startMs - b.startMs);

  // TODO: Implement proper FFmpeg overlay compositing for overlayTrack clips
  // For now, temporarily add overlay tracks to mainTrack to prevent them from disappearing
  // This means they'll be concatenated sequentially rather than composited, but at least they're exported
  // Future: Use FFmpeg overlay filter to composite PiP clips on top of main track
  overlayTrack.sort((a, b) => a.startMs - b.startMs);
  
  // Merge overlay tracks into main track for now (they'll be processed sequentially)
  // In a proper implementation, we'd use FFmpeg overlay filters to composite them
  mainTrack.push(...overlayTrack);
  mainTrack.sort((a, b) => a.startMs - b.startMs);

  // For overlapping clips (clips on different tracks at same time),
  // we'll just include all of them for now and let the export handle compositing
  // In the future, we can add proper multi-track compositing logic here

  return {
    id,
    mainTrack,
    overlayTrack,
  };
}

/**
 * Find the visible clip at a given timestamp
 */
function findVisibleClip(plan, tMs) {
  return plan.mainTrack.find((clip) => clip.startMs <= tMs && tMs < clip.endMs);
}

module.exports = {
  buildPlan,
  findVisibleClip,
};
