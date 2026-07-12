export const touch = {
  forward: false,
  backward: false,
  rotateLeft: false,
  rotateRight: false,
  isMobile: false
};

const PORTRAIT_FORWARD_BACK_RATIO = 0.2;
const PORTRAIT_SIDE_TURN_RATIO = 0.15;
const LANDSCAPE_FORWARD_BACK_RATIO = 0.15;
const LANDSCAPE_SIDE_TURN_RATIO = 0.2;

let viewportWidth = 0;
let viewportHeight = 0;
let topForwardLimit = 0;
let bottomBackwardStart = 0;
let leftTurnLimit = 0;
let rightTurnStart = 0;

const resetTouchMotion = () => {
  touch.forward = false;
  touch.backward = false;
  touch.rotateLeft = false;
  touch.rotateRight = false;
};

const isTouchDevice = () => {
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  return Boolean(coarsePointer || navigator.maxTouchPoints > 0);
};

const updateTouchMetrics = () => {
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  touch.isMobile = isTouchDevice();

  const isLandscape = viewportWidth > viewportHeight;
  const useLandscapeLayout = touch.isMobile && isLandscape;
  const forwardBackRatio = useLandscapeLayout ? LANDSCAPE_FORWARD_BACK_RATIO : PORTRAIT_FORWARD_BACK_RATIO;
  const sideTurnRatio = useLandscapeLayout ? LANDSCAPE_SIDE_TURN_RATIO : PORTRAIT_SIDE_TURN_RATIO;

  topForwardLimit = viewportHeight * forwardBackRatio;
  bottomBackwardStart = viewportHeight * (1 - forwardBackRatio);
  leftTurnLimit = viewportWidth * sideTurnRatio;
  rightTurnStart = viewportWidth * (1 - sideTurnRatio);
};

const inDeadZone = (x, y) => {
  const inHorizontalDeadZone = x >= leftTurnLimit && x <= rightTurnStart;
  const inVerticalDeadZone = y >= topForwardLimit && y <= bottomBackwardStart;
  return inHorizontalDeadZone && inVerticalDeadZone;
};

const updateTouchZones = touches => {
  resetTouchMotion();

  for (const t of touches) {
    const x = t.clientX;
    const y = t.clientY;

    if (inDeadZone(x, y)) continue;

    if (y < topForwardLimit) {
      touch.forward = true;
      continue;
    }

    if (y > bottomBackwardStart) {
      touch.backward = true;
      continue;
    }

    if (x < leftTurnLimit) touch.rotateLeft = true;
    if (x > rightTurnStart) touch.rotateRight = true;
  }
};

export const isDeadZoneTouch = (x, y) => inDeadZone(x, y);

document.addEventListener('touchstart', e => updateTouchZones(e.touches), { passive: true });
document.addEventListener('touchmove', e => updateTouchZones(e.touches), { passive: true });
document.addEventListener('touchend', e => {
  if (e.touches.length === 0) {
    resetTouchMotion();
    return;
  }
  updateTouchZones(e.touches);
}, { passive: true });
document.addEventListener('touchcancel', () => resetTouchMotion(), { passive: true });

['load', 'resize', 'orientationchange'].forEach(eventName => window.addEventListener(eventName, updateTouchMetrics));
updateTouchMetrics();
