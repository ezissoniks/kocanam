export const touch = { forward: false, backward: false, rotateLeft: false, rotateRight: false, isMobile: false };
let halfWidth = 0, topZoneLimit = 0, bottomZoneStart = 0;
const resetTouchMotion = () => touch.forward = touch.backward = touch.rotateLeft = touch.rotateRight = false;
const updateTouchMetrics = () => {
  const w = window.innerWidth, h = window.innerHeight;
  halfWidth = w / 2;
  topZoneLimit = h / 4;
  bottomZoneStart = h - topZoneLimit;
  touch.isMobile = w / h < 1;
};
const updateTouchZones = touches => {
  resetTouchMotion();
  for (const t of touches) {
    const x = t.clientX, y = t.clientY;
    if (y < topZoneLimit) touch.forward = true;
    if (y > bottomZoneStart) touch.backward = true;
    if (y >= topZoneLimit && y <= bottomZoneStart) {
      if (x < halfWidth) touch.rotateLeft = true;
      if (x > halfWidth) touch.rotateRight = true;
    }
  }
};
document.addEventListener('touchstart', e => updateTouchZones(e.touches), { passive: true });
document.addEventListener('touchmove', e => updateTouchZones(e.touches), { passive: true });
document.addEventListener('touchend', () => resetTouchMotion(), { passive: true });
['load', 'resize', 'orientationchange'].forEach(e => window.addEventListener(e, updateTouchMetrics));
updateTouchMetrics();
