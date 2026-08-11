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
let pinchLockActive = false;
let gestureTickScheduled = false;

const resetTouchMotion = () => {
  touch.forward = false;
  touch.backward = false;
  touch.rotateLeft = false;
  touch.rotateRight = false;
};

const clearMomentum = () => {
  // Swipe momentum disabled: stopping touch input should stop turning immediately.
};

const needsGestureTick = () => activeTouches.size > 0;

const gestureTick = () => {
  gestureTickScheduled = false;
  updateGestureState();

  if (needsGestureTick()) scheduleGestureTick();
};

const scheduleGestureTick = () => {
  if (gestureTickScheduled) return;
  gestureTickScheduled = true;
  requestAnimationFrame(gestureTick);
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
    pinchLockActive = true;

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

  if (pinchLockActive) return;

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
  const now = performance.now();

  for (const t of changedTouches) {
    const existing = activeTouches.get(t.identifier);
    if (existing) {
      const dt = now - existing.time;
      if (dt > 0) {
        const instantVx = (t.clientX - existing.x) / dt;
        const instantVy = (t.clientY - existing.y) / dt;
        existing.vx = existing.vx * 0.5 + instantVx * 0.5;
        existing.vy = existing.vy * 0.5 + instantVy * 0.5;
      }
      existing.x = t.clientX;
      existing.y = t.clientY;
      existing.time = now;
      continue;
    }

    activeTouches.set(t.identifier, {
      startX: t.clientX,
      startY: t.clientY,
      x: t.clientX,
      y: t.clientY,
      time: now,
      vx: 0,
      vy: 0
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
  entry.vx = 0;
  entry.vy = 0;
};

export const isDeadZoneTouch = (x, y) => inDeadZone(x, y);

document.addEventListener('touchstart', e => {
  clearMomentum();
  addOrUpdateTouches(e.changedTouches);
  if (activeTouches.size >= 2 && pinchStartDistance === null) {
    pinchLockActive = true;
    const [a, b] = [...activeTouches.values()];
    pinchStartDistance = Math.hypot(b.x - a.x, b.y - a.y);
  }
  updateGestureState();
  scheduleGestureTick();
}, { passive: true });

document.addEventListener('touchmove', e => {
  addOrUpdateTouches(e.changedTouches);
  updateGestureState();
  scheduleGestureTick();
}, { passive: true });

document.addEventListener('touchend', e => {
  const hadPinch = activeTouches.size >= 2;

  removeTouches(e.changedTouches);

  if (activeTouches.size === 0) {
    pinchLockActive = false;
    pinchStartDistance = null;
    updateGestureState();
    return;
  }

  if (hadPinch && activeTouches.size === 1) {
    pinchStartDistance = null;
    rebaseSingleTouchStart();
  }

  updateGestureState();
  if (needsGestureTick()) scheduleGestureTick();
}, { passive: true });

document.addEventListener('touchcancel', e => {
  removeTouches(e.changedTouches ?? []);
  if (activeTouches.size === 0) pinchLockActive = false;
  pinchStartDistance = null;
  clearMomentum();
  if (activeTouches.size === 0) {
    resetTouchMotion();
    return;
  }
  rebaseSingleTouchStart();
  updateGestureState();
  if (needsGestureTick()) scheduleGestureTick();
}, { passive: true });

['load', 'resize', 'orientationchange'].forEach(eventName => window.addEventListener(eventName, updateTouchMetrics));
updateTouchMetrics();
