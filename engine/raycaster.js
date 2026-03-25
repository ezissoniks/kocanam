import { getAllSprites } from "./sprites.js";

const FOV = Math.PI/3;
const MAX_DEPTH = 20;
const BASE_SCREEN_WIDTH = 1920;
const imageCache = new Map();
const imageDimensions = new Map();
const ctxCache = new WeakMap();
const bgState = {
  current: [221, 217, 215],
  target: [221, 217, 215],
  from: [221, 217, 215],
  start: 0,
  duration: 450
};

function hexToRgb(hex) {
  const normalized = hex?.replace('#', '');
  if (!normalized || (normalized.length !== 6 && normalized.length !== 3)) return null;
  const value = normalized.length === 3
    ? normalized.split('').map(c => c + c).join('')
    : normalized;
  const intVal = parseInt(value, 16);
  if (Number.isNaN(intVal)) return null;
  return [(intVal >> 16) & 255, (intVal >> 8) & 255, intVal & 255];
}

function updateBgColor(targetHex, now) {
  const target = hexToRgb(targetHex) || [221, 217, 215];
  if (bgState.target[0] !== target[0] || bgState.target[1] !== target[1] || bgState.target[2] !== target[2]) {
    bgState.target = target;
    bgState.from = bgState.current.slice();
    bgState.start = now;
  }
  const t = Math.min(1, (now - bgState.start) / bgState.duration);
  const eased = t * t * (3 - 2 * t);
  bgState.current = [
    Math.round(bgState.from[0] + (bgState.target[0] - bgState.from[0]) * eased),
    Math.round(bgState.from[1] + (bgState.target[1] - bgState.from[1]) * eased),
    Math.round(bgState.from[2] + (bgState.target[2] - bgState.from[2]) * eased)
  ];
  return `rgb(${bgState.current[0]}, ${bgState.current[1]}, ${bgState.current[2]})`;
}

function loadImage(path) {
  if (imageCache.has(path)) {
    return imageCache.get(path);
  }
  
  const img = new Image();
  img.src = path;
  img.onload = () => {
    imageDimensions.set(path, {
      width: img.naturalWidth,
      height: img.naturalHeight,
      aspectRatio: img.naturalWidth / img.naturalHeight
    });
  };
  imageCache.set(path, img);
  return img;
}

function getCanvasContext(canvas) {
  let ctx = ctxCache.get(canvas);
  if (!ctx) {
    ctx = canvas.getContext("2d");
    ctxCache.set(canvas, ctx);
  }
  return ctx;
}

function ensureSpriteFramesLoaded(sprite) {
  if (!Array.isArray(sprite.frames) || sprite.frames.length === 0) return;
  if (sprite._framesPreloaded) return;
  sprite._framesPreloaded = true;
  for (const frame of sprite.frames) {
    if (typeof frame === 'string' && frame.includes('.')) {
      loadImage(frame);
    }
  }
}

function getSpriteAspectRatio(sprite, preferredPath, fallbackPath) {
  const preferredDims = preferredPath ? imageDimensions.get(preferredPath) : null;
  if (preferredDims) return preferredDims.aspectRatio;
  const fallbackDims = fallbackPath ? imageDimensions.get(fallbackPath) : null;
  if (fallbackDims) return fallbackDims.aspectRatio;
  if (Array.isArray(sprite.frames)) {
    for (const frame of sprite.frames) {
      const frameDims = imageDimensions.get(frame);
      if (frameDims) return frameDims.aspectRatio;
    }
  }
  return 1.0;
}

export function renderFrame(canvas, playerX, playerY, playerAngle, proximityRadius = 1, infoProximityActive = false, targetBgColor = "#DDD9D7") {
  const ctx = getCanvasContext(canvas);
  const width = canvas.width;
  const height = canvas.height;

  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;

  const now = performance.now();
  ctx.fillStyle = updateBgColor(targetBgColor, now);
  ctx.fillRect(0, 0, width, height);

  renderSprites(ctx, width, height, playerX, playerY, playerAngle, now, infoProximityActive);
}

function getTimeFadeValue(sprite, now, isActive) {
  const fadeConfig = sprite.proximityFade;
  if (!fadeConfig || fadeConfig.mode !== 'onProximity') return null;
  const target = isActive ? 1 : 0;
  if (fadeConfig._target !== target) {
    fadeConfig._target = target;
    fadeConfig._from = fadeConfig._value ?? target;
    fadeConfig._start = now;
  }
  const duration = fadeConfig.duration ?? 400;
  const elapsed = Math.min(1, (now - (fadeConfig._start ?? now)) / duration);
  const value = (fadeConfig._from ?? target) + (target - (fadeConfig._from ?? target)) * elapsed;
  fadeConfig._value = value;
  return value;
}

function renderSprites(ctx, width, height, playerX, playerY, playerAngle, now, infoProximityActive) {
  const sprites = getAllSprites();
  const frameTick = Math.floor(now / 125); // 8 fps
  const spriteDistances = sprites
    .map(sprite => {
      const dx = sprite.x - playerX;
      const dy = sprite.y - playerY;
      const distance = Math.hypot(dx, dy);
      if (distance > MAX_DEPTH) return null;
      const angle = Math.atan2(dy, dx);
      return { sprite, distance, angle };
    })
    .filter(s => s !== null)
    .sort((a, b) => b.distance - a.distance);
  for (const { sprite, distance, angle } of spriteDistances) {
    ensureSpriteFramesLoaded(sprite);
    const texturePath = Array.isArray(sprite.frames) && sprite.frames.length > 0
      ? sprite.frames[frameTick % sprite.frames.length]
      : sprite.texture;
    const baseTexture = sprite.texture || (Array.isArray(sprite.frames) ? sprite.frames[0] : null);
    // Calculate angle relative to player view
    let relativeAngle = angle - playerAngle;
    while (relativeAngle > Math.PI) relativeAngle -= 2 * Math.PI;
    while (relativeAngle < -Math.PI) relativeAngle += 2 * Math.PI;
    
    // Only draw if sprite is in field of view
    if (Math.abs(relativeAngle) > FOV / 2) continue;
    
    // Calculate screen position
    const screenX = (relativeAngle + FOV / 2) / FOV * width;
    
    const correctedDistance = distance * Math.cos(relativeAngle);
    const size = sprite.screenSize ? sprite.size * (width / BASE_SCREEN_WIDTH) : sprite.size;
    const spriteHeight = (size / correctedDistance) * (1 / Math.tan(FOV / 2) / 2) * height;
    
    // Get image dimensions to maintain aspect ratio
    const aspectRatio = getSpriteAspectRatio(sprite, texturePath, baseTexture);
    const spriteWidth = spriteHeight * aspectRatio;
    
    const spriteY = (height - spriteHeight) / 2;
    const spriteLeft = screenX - spriteWidth / 2;
    
    // Draw sprite - check if texture is an image path or fallback color
    if (texturePath && texturePath.includes('.')) {
      const animImg = loadImage(texturePath);
      const baseImg = baseTexture && baseTexture.includes('.') ? loadImage(baseTexture) : null;

      const imgToDraw = (animImg?.complete && animImg.naturalHeight !== 0)
        ? animImg
        : (baseImg?.complete && baseImg.naturalHeight !== 0 ? baseImg : null);

      if (!imgToDraw) continue;

      const timeFade = getTimeFadeValue(sprite, now, infoProximityActive);
      const fadeTargetPath = timeFade !== null ? sprite.proximityFade?.to : null;
      const fadeTargetImg = fadeTargetPath ? loadImage(fadeTargetPath) : null;
      const canTimeFade = timeFade !== null && fadeTargetImg && fadeTargetImg.complete && fadeTargetImg.naturalHeight !== 0;

      if (canTimeFade) {
        if (timeFade <= 0.02) {
          ctx.globalAlpha = 0.9;
          ctx.drawImage(imgToDraw, spriteLeft, spriteY, spriteWidth, spriteHeight);
        } else if (timeFade >= 0.98) {
          ctx.globalAlpha = 0.9;
          ctx.drawImage(fadeTargetImg, spriteLeft, spriteY, spriteWidth, spriteHeight);
        } else {
          ctx.globalAlpha = 0.9 * (1 - timeFade);
          ctx.drawImage(imgToDraw, spriteLeft, spriteY, spriteWidth, spriteHeight);
          ctx.globalAlpha = 0.9 * timeFade;
          ctx.drawImage(fadeTargetImg, spriteLeft, spriteY, spriteWidth, spriteHeight);
        }
      } else {
        ctx.globalAlpha = 0.9;
        ctx.drawImage(imgToDraw, spriteLeft, spriteY, spriteWidth, spriteHeight);
      }
    } else {
      // Fallback: draw as colored rectangle
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = sprite.texture;
      ctx.fillRect(spriteLeft, spriteY, spriteWidth, spriteHeight);
    }
    ctx.globalAlpha = 1;
    
  }
}
