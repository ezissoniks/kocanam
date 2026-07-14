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
const SWIPE_TURN_THRESHOLD_PX = 18;
const SWIPE_HORIZONTAL_DOMINANCE = 0.6;
const PINCH_OUT_THRESHOLD_PX = 18;

let viewportWidth = 0;
let viewportHeight = 0;
let topForwardLimit = 0;
let bottomBackwardStart = 0;
let leftTurnLimit = 0;
let rightTurnStart = 0;
const activeTouches = new Map();
let pinchStartDistance = null;

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

const updateGestureState = () => {
  resetTouchMotion();
  touch.backward = false;

  const points = [...activeTouches.values()];
  if (points.length === 0) return;

  if (points.length >= 2) {
    const [a, b] = points;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy);

    if (pinchStartDistance === null) pinchStartDistance = distance;
    const pinchDelta = distance - pinchStartDistance;
    touch.forward = pinchDelta > PINCH_OUT_THRESHOLD_PX;
    touch.backward = pinchDelta < -PINCH_OUT_THRESHOLD_PX;
    return;
  }

  pinchStartDistance = null;
  const [single] = points;
  const dx = single.x - single.startX;
  const dy = single.y - single.startY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx < SWIPE_TURN_THRESHOLD_PX) return;
  if (absDx < absDy * SWIPE_HORIZONTAL_DOMINANCE) return;

  touch.rotateLeft = dx < 0;
  touch.rotateRight = dx > 0;
};

const addOrUpdateTouches = changedTouches => {
  for (const t of changedTouches) {
    const existing = activeTouches.get(t.identifier);
    if (existing) {
      existing.x = t.clientX;
      existing.y = t.clientY;
      continue;
    }

    activeTouches.set(t.identifier, {
      startX: t.clientX,
      startY: t.clientY,
      x: t.clientX,
      y: t.clientY
    });
  }
};

const removeTouches = changedTouches => {
  for (const t of changedTouches) activeTouches.delete(t.identifier);
};

const rebaseSingleTouchStart = () => {
  if (activeTouches.size !== 1) return;
  const [entry] = activeTouches.values();
  entry.startX = entry.x;
  entry.startY = entry.y;
};

export const isDeadZoneTouch = (x, y) => inDeadZone(x, y);

document.addEventListener('touchstart', e => {
  addOrUpdateTouches(e.changedTouches);
  if (activeTouches.size >= 2 && pinchStartDistance === null) {
    const [a, b] = [...activeTouches.values()];
    pinchStartDistance = Math.hypot(b.x - a.x, b.y - a.y);
  }
  updateGestureState();
}, { passive: true });

document.addEventListener('touchmove', e => {
  addOrUpdateTouches(e.changedTouches);
  updateGestureState();
}, { passive: true });

document.addEventListener('touchend', e => {
  const hadPinch = activeTouches.size >= 2;
  removeTouches(e.changedTouches);

  if (activeTouches.size === 0) {
    pinchStartDistance = null;
    resetTouchMotion();
    return;
  }

  if (hadPinch && activeTouches.size === 1) {
    pinchStartDistance = null;
    rebaseSingleTouchStart();
  }

  updateGestureState();
}, { passive: true });

document.addEventListener('touchcancel', e => {
  removeTouches(e.changedTouches ?? []);
  pinchStartDistance = null;
  if (activeTouches.size === 0) {
    resetTouchMotion();
    return;
  }
  rebaseSingleTouchStart();
  updateGestureState();
}, { passive: true });

['load', 'resize', 'orientationchange'].forEach(eventName => window.addEventListener(eventName, updateTouchMetrics));
updateTouchMetrics();
