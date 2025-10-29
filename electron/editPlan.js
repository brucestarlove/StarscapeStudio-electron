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

  const { id, assets = {}, clips = {}, tracks = {} } = parsed;

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
      };

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

