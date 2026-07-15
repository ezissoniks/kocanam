import { getAllSprites } from "./sprites.js";

const FOV = Math.PI/3, MAX_DEPTH = 20, BASE_SCREEN_WIDTH = 1920;
const HALF_FOV = FOV / 2, INV_FOV = 1 / FOV, PROJECTION_SCALE = (1 / Math.tan(HALF_FOV)) / 2;
const DEFAULT_THEME = { bg: '#FFF5EB', primary: '#3C2828' };
const imageCache = new Map(), imageDimensions = new Map(), ctxCache = new WeakMap();
const animatedCanvases = new Map(); // path -> {img, canvas, ctx}
const sprites = getAllSprites(), spriteDistances = [], _entryPool = [];
const fallbackBgRgb = [221, 217, 215];
let lastBgHex = null, lastBgRgb = fallbackBgRgb;
const bgState = { current: new Float32Array([255,245,235]), target: new Float32Array([255,245,235]), from: new Float32Array([255,245,235]), start: 0, duration: 450 };

function hexToRgb(hex) {
  let n = hex?.replace('#', '');
  if (!n || (n.length !== 6 && n.length !== 3)) return null;
  if (n.length === 3) n = n.split('').map(c => c + c).join('');
  const v = parseInt(n, 16);
  return Number.isNaN(v) ? null : [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

let _bgCachedStr = null, _bgCachedR = -1, _bgCachedG = -1, _bgCachedB = -1;
function updateBgColor(targetHex, now) {
  if (targetHex !== lastBgHex) { lastBgHex = targetHex; lastBgRgb = hexToRgb(targetHex) || fallbackBgRgb; }
  const tgt = lastBgRgb;
  if (tgt[0] !== bgState.target[0] || tgt[1] !== bgState.target[1] || tgt[2] !== bgState.target[2]) {
    bgState.target[0] = tgt[0]; bgState.target[1] = tgt[1]; bgState.target[2] = tgt[2];
    bgState.from[0] = bgState.current[0]; bgState.from[1] = bgState.current[1]; bgState.from[2] = bgState.current[2];
    bgState.start = now;
  }
  const t = Math.min(1, (now - bgState.start) / bgState.duration), e = t * t * (3 - 2 * t);
  const r = Math.round(bgState.from[0] + (bgState.target[0] - bgState.from[0]) * e);
  const g = Math.round(bgState.from[1] + (bgState.target[1] - bgState.from[1]) * e);
  const b = Math.round(bgState.from[2] + (bgState.target[2] - bgState.from[2]) * e);
  bgState.current[0] = r; bgState.current[1] = g; bgState.current[2] = b;
  if (r === _bgCachedR && g === _bgCachedG && b === _bgCachedB) return _bgCachedStr;
  _bgCachedR = r; _bgCachedG = g; _bgCachedB = b;
  return _bgCachedStr = `rgb(${r},${g},${b})`;
}

function loadImage(path) {
  if (imageCache.has(path)) return imageCache.get(path);
  const img = new Image();
  img.src = path;
  img.onload = () => {
    imageDimensions.set(path, {
      width: img.naturalWidth,
      height: img.naturalHeight,
      aspectRatio: img.naturalWidth / img.naturalHeight
    });
    // For animated WebP/GIF: set up an offscreen canvas sized to the image.
    // Every renderFrame we'll copy the live img into it, then draw that canvas
    // as the sprite texture — this reliably captures each animation frame.
    if (path.endsWith('.webp') || path.endsWith('.gif')) {
      img.style.cssText = 'position:fixed;top:0;left:0;opacity:0.001;pointer-events:none;z-index:-1';
      document.body.appendChild(img);
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const cx = c.getContext('2d');
      animatedCanvases.set(path, { img, canvas: c, ctx: cx });
    }
  };
  imageCache.set(path, img);
  return img;
}

function refreshAnimatedCanvases() {
  for (const { img, canvas, ctx } of animatedCanvases.values()) {
    if (!img.complete || img.naturalWidth === 0) continue;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  }
}

function getAnimatedSource(path) {
  const entry = animatedCanvases.get(path);
  return entry ? entry.canvas : null;
}

function getCanvasContext(canvas) {
  let ctx = ctxCache.get(canvas);
  if (!ctx) {
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctxCache.set(canvas, ctx);
  }
  return ctx;
}

for (const sprite of sprites) {
  if (Array.isArray(sprite.frames) && !sprite._framesPreloaded) {
    sprite._framesPreloaded = true;
    for (const f of sprite.frames) if (typeof f === 'string' && f.includes('.')) loadImage(f);
  }
  if (sprite.texture?.includes('.')) loadImage(sprite.texture);
  if (Array.isArray(sprite.childSprites)) {
    for (const t of sprite.childSprites) {
      if (Array.isArray(t.frames)) for (const f of t.frames) if (typeof f === 'string' && f.includes('.')) loadImage(f);
      if (t.texture?.includes('.')) loadImage(t.texture);
    }
  }
}

function getSpriteAspectRatio(sprite, pref, fall) {
  const ar = p => p && imageDimensions.get(p)?.aspectRatio;
  return ar(pref) || ar(fall) || sprite.frames?.reduce((r, f) => r || ar(f), 0) || 1;
}

export function renderFrame(canvas, playerX, playerY, playerAngle) {
  const ctx = getCanvasContext(canvas), width = canvas.width, height = canvas.height, now = performance.now();
  refreshAnimatedCanvases();
  ctx.globalAlpha = 1;
  ctx.fillStyle = updateBgColor(DEFAULT_THEME.bg, now);
  ctx.fillRect(0, 0, width, height);
  renderSprites(ctx, width, height, playerX, playerY, playerAngle, now);
}

function getSpriteOpacity(sprite, playerX, playerY, now) {
  const fc = sprite.proximityOpacity;
  if (!fc) return 1;

  let target = 0;
  if (!sprite._removeAfterFade) {
    const dx = sprite.x - playerX;
    const dy = sprite.y - playerY;
    const radius = fc.radius ?? 2.2;
    const distSq = dx * dx + dy * dy;
    if (distSq < radius * radius) {
      const fadeRange = Math.min(fc.fadeRange ?? 0.8, radius);
      const solidRadius = Math.max(0, radius - fadeRange);
      const dist = Math.sqrt(distSq);
      target = dist <= solidRadius ? 1 : (radius - dist) / (fadeRange || 1);
    }
  }

  if (fc._target !== target) {
    fc._target = target;
    fc._from = fc._value ?? target;
    fc._start = now;
  }

  const elapsed = Math.min(1, (now - (fc._start ?? now)) / (fc.duration ?? 220));
  fc._value = (fc._from ?? target) + (target - (fc._from ?? target)) * elapsed;
  return fc._value;
}

function renderSprites(ctx, width, height, playerX, playerY, playerAngle, now) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const frameTick = Math.floor(now / 125), maxDepthSq = MAX_DEPTH * MAX_DEPTH;
  const cosA = Math.cos(playerAngle), sinA = Math.sin(playerAngle);
  let poolIdx = 0;
  spriteDistances.length = 0;
  for (let i = 0; i < sprites.length; i++) {
    const sprite = sprites[i], dx = sprite.x - playerX, dy = sprite.y - playerY;
    if (sprite._removeAfterFade && (sprite.proximityOpacity?._value ?? 0) <= 0.02) {
      sprites.splice(i--, 1);
      continue;
    }
    if (dx * cosA + dy * sinA <= 0) continue; // behind player
    const distSq = dx * dx + dy * dy;
    if (distSq > maxDepthSq) continue;
    let e = _entryPool[poolIdx];
    if (!e) _entryPool[poolIdx] = e = {};
    e.sprite = sprite; e.distance = Math.sqrt(distSq); e.angle = Math.atan2(dy, dx);
    spriteDistances[poolIdx++] = e;
  }
  spriteDistances.length = poolIdx;
  // Insertion sort — allocation-free and faster than Array.sort for small lists
  for (let i = 1; i < poolIdx; i++) {
    const key = spriteDistances[i];
    let j = i - 1;
    while (j >= 0 && spriteDistances[j].distance < key.distance) {
      spriteDistances[j + 1] = spriteDistances[j];
      j--;
    }
    spriteDistances[j + 1] = key;
  }
  for (let si = 0; si < poolIdx; si++) {
    const entry = spriteDistances[si];
    const sprite = entry.sprite, distance = entry.distance, angle = entry.angle;
    const spriteOpacity = getSpriteOpacity(sprite, playerX, playerY, now);
    if (spriteOpacity <= 0.02) continue;
    const texturePath = Array.isArray(sprite.frames) && sprite.frames.length > 0 ? sprite.frames[frameTick % sprite.frames.length] : sprite.texture;
    const baseTexture = sprite.texture || (Array.isArray(sprite.frames) ? sprite.frames[0] : null);
    let relativeAngle = angle - playerAngle;
    if (relativeAngle > Math.PI) relativeAngle -= 2 * Math.PI;
    else if (relativeAngle < -Math.PI) relativeAngle += 2 * Math.PI;
    if (relativeAngle > HALF_FOV || relativeAngle < -HALF_FOV) continue;

    const screenX = (relativeAngle + HALF_FOV) * INV_FOV * width;
    const correctedDistance = distance * Math.cos(relativeAngle);
    const size = sprite.screenSize ? sprite.size * (width / BASE_SCREEN_WIDTH) : sprite.size;
    const spriteHeight = (size / correctedDistance) * PROJECTION_SCALE * height;
    const spriteWidth = spriteHeight * getSpriteAspectRatio(sprite, texturePath, baseTexture);
    const zOffset = sprite.heightScale ?? 0;
    const projectedYOffset = (zOffset / correctedDistance) * PROJECTION_SCALE * height;
    const spriteY = (height - spriteHeight) / 2 - projectedYOffset, spriteLeft = screenX - spriteWidth / 2;
    if (spriteWidth < 1) continue;

    if (texturePath?.includes('.')) {
      const animSrc = getAnimatedSource(texturePath);
      const animImg = animSrc || loadImage(texturePath);
      const baseImg = !animSrc && baseTexture?.includes('.') ? loadImage(baseTexture) : null;
      const imgToDraw = animSrc
        ? (animSrc.width > 0 ? animSrc : null)
        : (animImg?.complete && animImg.naturalHeight !== 0 ? animImg : (baseImg?.complete && baseImg.naturalHeight !== 0 ? baseImg : null));
      if (!imgToDraw) continue;
      ctx.globalAlpha = spriteOpacity;
      ctx.drawImage(imgToDraw, spriteLeft, spriteY, spriteWidth, spriteHeight);
    } else {
      ctx.globalAlpha = spriteOpacity;
      ctx.fillStyle = sprite.texture;
      ctx.fillRect(spriteLeft, spriteY, spriteWidth, spriteHeight);
    }
    ctx.globalAlpha = 1;
  }
}
