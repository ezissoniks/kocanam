export const touch = { forward: false, backward: false, rotateLeft: false, rotateRight: false, isMobile: false, disabled: false, extraVisible: false };
const checkMobileOrientation = () => touch.isMobile = window.innerWidth / window.innerHeight < 1;
const updateTouchZones = (touches) => {
  if (touch.disabled) {
    touch.forward = touch.backward = touch.rotateLeft = touch.rotateRight = false;
    return;
  }
  touch.forward = touch.backward = touch.rotateLeft = touch.rotateRight = false;
  for (let t of touches) {
    const x = t.clientX, y = t.clientY, w = window.innerWidth, h = window.innerHeight;
    const isBottomRight = x > w / 2 && y > h - h / 4;
    if (y < h / 4) touch.forward = true;
    if (y > h - h / 4 && !(isBottomRight && touch.extraVisible)) touch.backward = true;
    if (x < w / 2 && y >= h / 4 && y <= h - h / 4) touch.rotateLeft = true;
    if (x > w / 2 && y >= h / 4 && y <= h - h / 4) touch.rotateRight = true;
  }
};
document.addEventListener('touchstart', e => updateTouchZones(e.touches));
document.addEventListener('touchend', () => {
  if (touch.disabled) return;
  touch.forward = touch.backward = touch.rotateLeft = touch.rotateRight = false;
});
document.addEventListener('touchmove', e => updateTouchZones(e.touches));
['load', 'resize'].forEach(e => window.addEventListener(e, checkMobileOrientation));
