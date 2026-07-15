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
const SWIPE_MOMENTUM_MIN_VELOCITY = 0.45; // px/ms
const PINCH_MOMENTUM_MIN_VELOCITY = 0.35; // px/ms
const MOMENTUM_MIN_MS = 90;
const MOMENTUM_MAX_MS = 280;

let viewportWidth = 0;
let viewportHeight = 0;
let topForwardLimit = 0;
let bottomBackwardStart = 0;
let leftTurnLimit = 0;
let rightTurnStart = 0;
const activeTouches = new Map();
let pinchStartDistance = null;
let pinchLastDistance = null;
let pinchLastTime = 0;
let pinchVelocity = 0;
let pinchLockActive = false;
const rotateMomentum = { dir: 0, until: 0 };
const moveMomentum = { dir: 0, until: 0 };
let gestureTickScheduled = false;

const resetTouchMotion = () => {
  touch.forward = false;
  touch.backward = false;
  touch.rotateLeft = false;
  touch.rotateRight = false;
};

const clearMomentum = () => {
  rotateMomentum.dir = 0;
  rotateMomentum.until = 0;
  moveMomentum.dir = 0;
  moveMomentum.until = 0;
};

const getMomentumDuration = velocity => {
  const scaled = MOMENTUM_MIN_MS + Math.min(1.2, Math.abs(velocity)) * 160;
  return Math.max(MOMENTUM_MIN_MS, Math.min(MOMENTUM_MAX_MS, scaled));
};

const applySwipeMomentum = (vx, vy, now) => {
  const absVx = Math.abs(vx);
  const absVy = Math.abs(vy);
  if (absVx < SWIPE_MOMENTUM_MIN_VELOCITY) return;
  if (absVx < absVy * SWIPE_HORIZONTAL_DOMINANCE) return;

  rotateMomentum.dir = vx > 0 ? 1 : -1;
  rotateMomentum.until = now + getMomentumDuration(absVx);
};

const applyPinchMomentum = (velocity, now) => {
  const absVelocity = Math.abs(velocity);
  if (absVelocity < PINCH_MOMENTUM_MIN_VELOCITY) return;

  moveMomentum.dir = velocity > 0 ? 1 : -1;
  moveMomentum.until = now + getMomentumDuration(absVelocity);
};

const hasActiveMomentum = now => rotateMomentum.until > now || moveMomentum.until > now;

const needsGestureTick = now => activeTouches.size > 0 || hasActiveMomentum(now);

const gestureTick = () => {
  gestureTickScheduled = false;
  updateGestureState();

  const now = performance.now();
  if (needsGestureTick(now)) scheduleGestureTick();
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

const applyMomentumState = now => {
  if (rotateMomentum.until > now) {
    touch.rotateLeft = touch.rotateLeft || rotateMomentum.dir < 0;
    touch.rotateRight = touch.rotateRight || rotateMomentum.dir > 0;
  }

  if (moveMomentum.until > now) {
    touch.forward = touch.forward || moveMomentum.dir > 0;
    touch.backward = touch.backward || moveMomentum.dir < 0;
  }
};

const updateGestureState = () => {
  const now = performance.now();
  resetTouchMotion();
  touch.backward = false;

  const points = [...activeTouches.values()];
  if (points.length === 0) {
    applyMomentumState(now);
    return;
  }

  if (points.length >= 2) {
    pinchLockActive = true;
    rotateMomentum.dir = 0;
    rotateMomentum.until = 0;

    const [a, b] = points;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy);

    if (pinchStartDistance === null) {
      pinchStartDistance = distance;
      pinchLastDistance = distance;
      pinchLastTime = now;
      pinchVelocity = 0;
    }

    if (pinchLastDistance !== null && pinchLastTime > 0) {
      const dt = now - pinchLastTime;
      if (dt > 0) {
        const instantVelocity = (distance - pinchLastDistance) / dt;
        pinchVelocity = pinchVelocity * 0.5 + instantVelocity * 0.5;
      }
    }
    pinchLastDistance = distance;
    pinchLastTime = now;

    const pinchDelta = distance - pinchStartDistance;
    touch.forward = pinchDelta > PINCH_OUT_THRESHOLD_PX;
    touch.backward = pinchDelta < -PINCH_OUT_THRESHOLD_PX;
    applyMomentumState(now);
    return;
  }

  pinchStartDistance = null;
  pinchLastDistance = null;
  pinchLastTime = 0;
  pinchVelocity = 0;

  if (pinchLockActive) {
    applyMomentumState(now);
    return;
  }

  const [single] = points;
  const dx = single.x - single.startX;
  const dy = single.y - single.startY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx < SWIPE_TURN_THRESHOLD_PX) {
    applyMomentumState(now);
    return;
  }
  if (absDx < absDy * SWIPE_HORIZONTAL_DOMINANCE) {
    applyMomentumState(now);
    return;
  }

  touch.rotateLeft = dx < 0;
  touch.rotateRight = dx > 0;
  applyMomentumState(now);
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
    pinchLastDistance = pinchStartDistance;
    pinchLastTime = performance.now();
    pinchVelocity = 0;
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
  const now = performance.now();
  const hadPinch = activeTouches.size >= 2;

  if (hadPinch) applyPinchMomentum(pinchVelocity, now);
  else {
    for (const t of e.changedTouches) {
      const ended = activeTouches.get(t.identifier);
      if (!ended) continue;
      applySwipeMomentum(ended.vx, ended.vy, now);
    }
  }

  removeTouches(e.changedTouches);

  if (activeTouches.size === 0) {
    pinchLockActive = false;
    pinchStartDistance = null;
    pinchLastDistance = null;
    pinchLastTime = 0;
    pinchVelocity = 0;
    updateGestureState();
    return;
  }

  if (hadPinch && activeTouches.size === 1) {
    pinchStartDistance = null;
    pinchLastDistance = null;
    pinchLastTime = 0;
    pinchVelocity = 0;
    rebaseSingleTouchStart();
  }

  updateGestureState();
  if (needsGestureTick(now)) scheduleGestureTick();
}, { passive: true });

document.addEventListener('touchcancel', e => {
  removeTouches(e.changedTouches ?? []);
  if (activeTouches.size === 0) pinchLockActive = false;
  pinchStartDistance = null;
  pinchLastDistance = null;
  pinchLastTime = 0;
  pinchVelocity = 0;
  clearMomentum();
  if (activeTouches.size === 0) {
    resetTouchMotion();
    return;
  }
  rebaseSingleTouchStart();
  updateGestureState();
  const now = performance.now();
  if (needsGestureTick(now)) scheduleGestureTick();
}, { passive: true });

['load', 'resize', 'orientationchange'].forEach(eventName => window.addEventListener(eventName, updateTouchMetrics));
updateTouchMetrics();
