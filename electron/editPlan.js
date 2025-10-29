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
        clipId: clipId,
      };

      // For overlay tracks, attach transform data from canvasNodes
      if (track.role === 'overlay' && track.type === 'video') {
        // Find the canvas node for this clip
        const canvasNode = Object.values(canvasNodes).find(node => node.clipId === clipId);
        if (canvasNode) {
          seqClip.transform = {
            x: canvasNode.x,
            y: canvasNode.y,
            width: canvasNode.width,
            height: canvasNode.height,
            rotation: canvasNode.rotation,
            opacity: canvasNode.opacity,
          };
        }
      }

      // Separate main track from overlay track
      if (track.role === 'main') {
        mainTrack.push(seqClip);
      } else if (track.type === 'video') {
        // Only video overlays (not audio)
        overlayTrack.push(seqClip);
      }
    }
  }

  // Sort main track by start time
  mainTrack.sort((a, b) => a.startMs - b.startMs);
  
  // Sort overlay track by start time
  overlayTrack.sort((a, b) => a.startMs - b.startMs);

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

