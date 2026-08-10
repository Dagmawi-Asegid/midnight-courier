const CULL_MARGIN = 160;

/** True if a world-space point is within (a margin around) the camera's view. Shared by every world/entity renderer so culling stays consistent and cheap. */
export function isVisible(camera, x, y, pad = 0) {
  return (
    x > camera.x - CULL_MARGIN - pad &&
    x < camera.x + camera.viewWidth + CULL_MARGIN + pad &&
    y > camera.y - CULL_MARGIN - pad &&
    y < camera.y + camera.viewHeight + CULL_MARGIN + pad
  );
}

export { CULL_MARGIN };
