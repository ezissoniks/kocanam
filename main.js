import { player } from "./engine/player.js";
import { keys } from "./engine/input.js";
import { isWall } from "./engine/collision.js";
import { renderFrame } from "./engine/raycaster.js";
import { clearChildSprites, getAllSprites, spawnChildSprites } from "./engine/sprites.js";
import { touch } from "./engine/touch.js";
const [canvas, hud, gameLogo] = ['gameCanvas', 'hud', 'game-logo']
  .map(id => document.getElementById(id));
const FOV = Math.PI / 3;
const COS_HALF_FOV = Math.cos(FOV / 2);
const MAX_RENDER_PIXELS = 1_800_000;
const MIN_RENDER_SCALE = 0.5;
const INTRO_SPRITE_ID = 'A';
const ARTWORK_HOLD_RADIUS_EXTRA = 0.3;
const ARTWORK_SWITCH_DEBOUNCE_MS = 160;
const ARTWORK_LOST_GRACE_MS = 240;
const DETAILS_WINDOW_FADE_MS = 220;
let [currentArtwork, previousArtwork] = [null, null];
let [typewriterIndex, typewriterText, typewriterTimeout] = [0, '', null];
let proximityTimeout = null;
let inactivityHintTimeout = null;
let hudResetTimeout = null;
let hudRevealTimeout = null;
let detailsWindowFadeTimeout = null;
let pendingArtwork = null;
let pendingArtworkSince = 0;
let artworkLostSince = 0;
let language = 'lv';

const languageButton = document.createElement('button');
languageButton.id = 'lang-toggle';
languageButton.type = 'button';
document.body.appendChild(languageButton);

const getLocalizedText = (sprite, key) => {
  if (!sprite) return '';
  const primary = language === 'en' ? `${key}_en` : key;
  const fallback = language === 'en' ? key : `${key}_en`;
  return sprite[primary] ?? sprite[fallback] ?? '';
};

const getMoveHintText = () => language === 'en'
  ? 'Move 🡰 🡱 🡲 🡳 '
  : 'Kusties 🡰 🡱 🡲 🡳 ';

const updateLanguageToggleUi = () => {
  languageButton.textContent = language === 'lv' ? 'EN' : 'LV';
};

const updateLanguageToggleVisibility = () => {
  languageButton.classList.toggle('visible', currentArtwork?.id === INTRO_SPRITE_ID);
};

const showInactivityHint = () => {
  hud.dataset.mode = '';
  hud.innerHTML = getMoveHintText();
  hud.dataset.hint = '1';
  hud.classList.remove('hidden');
  inactivityHintTimeout = null;
};

const scheduleInactivityHint = () => {
  clearTimer(inactivityHintTimeout);
  inactivityHintTimeout = setTimeout(showInactivityHint, 5000);
};

const clearInactivityHint = () => {
  clearTimer(inactivityHintTimeout);
  inactivityHintTimeout = null;
  if (hud.dataset.hint) {
    hud.dataset.hint = '';
    hud.dataset.mode = '';
    hud.classList.add('hidden');
  }
};
const setCanvasSize = () => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pixelCount = vw * vh;
  const autoScale = pixelCount > MAX_RENDER_PIXELS ? Math.sqrt(MAX_RENDER_PIXELS / pixelCount) : 1;
  const renderScale = Math.max(MIN_RENDER_SCALE, Math.min(1, autoScale));
  canvas.width = Math.max(1, Math.floor(vw * renderScale));
  canvas.height = Math.max(1, Math.floor(vh * renderScale));
};
['load', 'resize'].forEach(e => window.addEventListener(e, setCanvasSize));
window.addEventListener('load', () => document.body.classList.add('loaded'));
setCanvasSize();
updateLanguageToggleUi();
const sprites = getAllSprites();
if (window.innerWidth / window.innerHeight < 1) {
  for (const s of sprites) {
    s.size = Math.max(0.05, s.size - 0.3);
    if (s.childSprites) for (const c of s.childSprites) c.size = Math.max(0.05, c.size - 0.1);
  }
}
const clearTimer = timer => timer && clearTimeout(timer);
const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const showArtworkHud = (artwork, useTypewriter = true) => {
  const artworkNameValue = getLocalizedText(artwork, 'name');
  const artworkDescriptionValue = getLocalizedText(artwork, 'description');
  if (!artworkNameValue || !artworkDescriptionValue) return;
  clearTimer(typewriterTimeout);
  typewriterTimeout = null;
  const artworkName = artworkNameValue.toLocaleLowerCase();
  typewriterText = `<strong class="hud-name">${escapeHtml(artworkName)}</strong><span class="hud-description">${escapeHtml(artworkDescriptionValue)}</span>`;
  typewriterIndex = 0;
  hud.innerHTML = '';
  hud.dataset.hint = '';
  hud.dataset.mode = 'artwork';
  hud.classList.remove('hidden');
  if (useTypewriter) {
    typeWriter();
  } else {
    typewriterIndex = typewriterText.length;
    hud.innerHTML = typewriterText;
  }
};

const removeDetailsWindow = (animate = true) => {
  const detailsWindow = hud.querySelector('.hud-window');
  hud.dataset.details = '';
  if (!detailsWindow) return;

  clearTimer(detailsWindowFadeTimeout);
  detailsWindowFadeTimeout = null;

  if (!animate) {
    detailsWindow.remove();
    return;
  }

  detailsWindow.classList.add('is-closing');
  detailsWindowFadeTimeout = setTimeout(() => {
    detailsWindow.remove();
    detailsWindowFadeTimeout = null;
  }, DETAILS_WINDOW_FADE_MS);
};

const showDetailsHud = artwork => {
  const longDescription = getLocalizedText(artwork, 'long_description') || getLocalizedText(artwork, 'description');
  if (!longDescription) return;
  removeDetailsWindow(false);
  hud.insertAdjacentHTML('beforeend', `<div class="hud-window"><p class="hud-window-text">${escapeHtml(longDescription)}</p></div>`);
  hud.dataset.details = '1';
  hud.classList.remove('hidden');
};

const checkProximity = (px, py, r, cosAngle, sinAngle) => {
  let closest = null, closestDistSq = Infinity;
  const rSq = r * r;
  const holdRadius = r + ARTWORK_HOLD_RADIUS_EXTRA;
  const holdRadiusSq = holdRadius * holdRadius;

  // Hysteresis: keep the previously selected artwork while still nearby.
  if (previousArtwork && previousArtwork.interactive !== false) {
    const prevDx = previousArtwork.x - px;
    const prevDy = previousArtwork.y - py;
    const prevDistSq = prevDx * prevDx + prevDy * prevDy;
    const prevInFov = (prevDx * cosAngle + prevDy * sinAngle) / Math.sqrt(prevDistSq || 1) >= COS_HALF_FOV;
    if (prevDistSq > 0 && prevDistSq < holdRadiusSq && (previousArtwork.id === INTRO_SPRITE_ID || prevInFov)) {
      closest = previousArtwork;
      closestDistSq = prevDistSq;
    }
  }

  for (const s of sprites) {
    if (s.interactive === false) continue;
    const dx = s.x - px, dy = s.y - py, distSq = dx * dx + dy * dy;
    if (distSq >= rSq || distSq >= closestDistSq || distSq === 0) continue;
    if (s.id !== INTRO_SPRITE_ID && (dx * cosAngle + dy * sinAngle) / Math.sqrt(distSq) < COS_HALF_FOV) continue;
    closest = s; closestDistSq = distSq;
  }
  const now = performance.now();
  if (closest === previousArtwork) {
    pendingArtwork = null;
    pendingArtworkSince = 0;
    artworkLostSince = 0;
    currentArtwork = closest;
    return;
  }

  if (!closest && previousArtwork) {
    if (!artworkLostSince) artworkLostSince = now;
    if (now - artworkLostSince < ARTWORK_LOST_GRACE_MS) {
      currentArtwork = previousArtwork;
      return;
    }
    artworkLostSince = 0;
  } else {
    artworkLostSince = 0;
  }

  if (pendingArtwork !== closest) {
    pendingArtwork = closest;
    pendingArtworkSince = now;
    currentArtwork = previousArtwork;
    return;
  }

  if (now - pendingArtworkSince < ARTWORK_SWITCH_DEBOUNCE_MS) {
    currentArtwork = previousArtwork;
    return;
  }

  currentArtwork = closest;
  pendingArtwork = null;
  pendingArtworkSince = 0;
};
const typeWriter = () => {
  if (typewriterIndex >= typewriterText.length) {
    typewriterTimeout = null;
    return;
  }
  if (typewriterText[typewriterIndex] === '<') {
    const end = typewriterText.indexOf('>', typewriterIndex);
    if (end !== -1) {
      typewriterIndex = end + 1;
      hud.innerHTML = typewriterText.substring(0, typewriterIndex);
      typewriterTimeout = setTimeout(typeWriter, 0);
      return;
    }
  }
  hud.innerHTML = typewriterText.substring(0, ++typewriterIndex);
  typewriterTimeout = setTimeout(typeWriter, 25);
};

const rerenderHudForLanguage = () => {
  if (!currentArtwork) return;
  if (hud.dataset.hint) {
    showInactivityHint();
    return;
  }
  if (hud.dataset.mode === 'artwork') showArtworkHud(currentArtwork, false);
  if (hud.dataset.details === '1') showDetailsHud(currentArtwork);
};

languageButton.addEventListener('click', () => {
  language = language === 'lv' ? 'en' : 'lv';
  updateLanguageToggleUi();
  rerenderHudForLanguage();
});

const update = () => {
  const p = player;
  const rotLeft = keys['a'] || keys['arrowleft'] || touch.rotateLeft;
  const rotRight = keys['d'] || keys['arrowright'] || touch.rotateRight;
  const moveForward = keys['w'] || keys['arrowup'] || touch.forward;
  const moveBackward = keys['s'] || keys['arrowdown'] || touch.backward;
  
  if (rotLeft) p.rotVelocity = Math.max(p.rotVelocity - p.rotAccel, -p.maxRotVelocity);
  else if (rotRight) p.rotVelocity = Math.min(p.rotVelocity + p.rotAccel, p.maxRotVelocity);
  else p.rotVelocity *= p.rotFriction;
  p.angle += p.rotVelocity;
  if (moveForward) p.moveVelocity = Math.min(p.moveVelocity + p.moveAccel, p.maxMoveVelocity);
  else if (moveBackward) p.moveVelocity = Math.max(p.moveVelocity - p.moveAccel, -p.maxMoveVelocity);
  else p.moveVelocity *= p.moveFriction;

  const anyInput = rotLeft || rotRight || moveForward || moveBackward;
  if (anyInput && inactivityHintTimeout) {
    clearTimer(inactivityHintTimeout);
    inactivityHintTimeout = null;
  }

  const cosAngle = Math.cos(p.angle);
  const sinAngle = Math.sin(p.angle);
  const nextX = p.x + cosAngle * p.moveVelocity;
  const nextY = p.y + sinAngle * p.moveVelocity;
  
  if (!isWall(nextX, p.y)) p.x = nextX;
  if (!isWall(p.x, nextY)) p.y = nextY;
  
  const proximityRadius = 1;
  checkProximity(p.x, p.y, proximityRadius, cosAngle, sinAngle);
  renderFrame(canvas, p.x, p.y, p.angle);
  if (currentArtwork !== previousArtwork) {
    clearTimer(hudRevealTimeout);
    hudRevealTimeout = null;
    clearTimer(hudResetTimeout);
    hudResetTimeout = null;
    if (previousArtwork?.id) clearChildSprites(previousArtwork.id);
    clearTimer(typewriterTimeout);
    typewriterTimeout = null;
    clearTimer(proximityTimeout);
    proximityTimeout = null;
    removeDetailsWindow();
    clearInactivityHint();
    hud.classList.add('hidden');
    gameLogo.classList.toggle('visible', currentArtwork?.id === 'A');
    updateLanguageToggleVisibility();
    if (currentArtwork?.id === INTRO_SPRITE_ID) setTimeout(scheduleInactivityHint, 500);
    
    hudResetTimeout = setTimeout(() => {
      hud.innerHTML = '';
      typewriterText = '';
      typewriterIndex = 0;
      if (!hud.dataset.hint) hud.dataset.mode = '';
      hudResetTimeout = null;
    }, 500);

    if (getLocalizedText(currentArtwork, 'name') && getLocalizedText(currentArtwork, 'description')) {
      const artworkAtSchedule = currentArtwork;
      hudRevealTimeout = setTimeout(() => {
        if (currentArtwork === artworkAtSchedule) showArtworkHud(artworkAtSchedule, true);
        hudRevealTimeout = null;
      }, 500);
    }
    previousArtwork = currentArtwork;
  }

  requestAnimationFrame(update);
};
canvas.addEventListener('pointerdown', () => {
  if (!currentArtwork?.id) return;

  if (hud.dataset.details === '1') {
    clearChildSprites(currentArtwork.id);
    removeDetailsWindow();
    return;
  }

  const spawned = spawnChildSprites(currentArtwork.id, player.x, player.y);
  if (spawned > 0) return;

  const childCount = Array.isArray(currentArtwork.childSprites) ? currentArtwork.childSprites.length : 0;
  const viewedAllChildren = childCount === 0 || (currentArtwork._nextChildIndex ?? 0) >= childCount;
  if (viewedAllChildren && currentArtwork.long_description) {
    showDetailsHud(currentArtwork);
  }
});

// Collect every image path from sprites and child templates
const _allAssetPaths = new Set();
for (const s of sprites) {
  if (s.texture?.includes('.')) _allAssetPaths.add(s.texture);
  if (Array.isArray(s.frames)) for (const f of s.frames) if (f?.includes('.')) _allAssetPaths.add(f);
  if (Array.isArray(s.childSprites)) for (const c of s.childSprites) {
    if (c.texture?.includes('.')) _allAssetPaths.add(c.texture);
    if (Array.isArray(c.frames)) for (const f of c.frames) if (f?.includes('.')) _allAssetPaths.add(f);
  }
}
Promise.allSettled(
  [..._allAssetPaths].map(src => { const img = new Image(); img.src = src; return img.decode(); })
).then(() => update());