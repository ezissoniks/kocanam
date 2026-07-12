import { player } from "./engine/player.js";
import { keys } from "./engine/input.js";
import { isWall } from "./engine/collision.js";
import { renderFrame } from "./engine/raycaster.js";
import { clearChildSprites, getAllSprites, spawnChildSprites } from "./engine/sprites.js";
import { isDeadZoneTouch, touch } from "./engine/touch.js";
const [canvas, hud, gameLogo] = ['gameCanvas', 'hud', 'game-logo']
  .map(id => document.getElementById(id));
const FOV = Math.PI / 3;
const COS_HALF_FOV = Math.cos(FOV / 2);
const MAX_RENDER_PIXELS = 1_800_000;
const MIN_RENDER_SCALE = 0.5;
const INTRO_SPRITE_ID = 'A';
const PORTFOLIO_TITLES = {
  lv: 'Kočāns - dizaina portfolio',
  en: 'Kočāns - design portfolio'
};
const MAIN_PAGE_TOOLTIPS = {
  lv: 'uz galveno lapu',
  en: 'to main page'
};
const ARTWORK_HOLD_RADIUS_EXTRA = 0.3;
const ARTWORK_SWITCH_DEBOUNCE_MS = 160;
const ARTWORK_LOST_GRACE_MS = 240;
const DETAILS_WINDOW_FADE_MS = 220;
const IDLE_ARROWS_DELAY_MS = 15_000;
const CLICK_PROMPT_DELAY_MS = 30_000;
const INTRO_TEXT_WINDOW_STEP_MS = 5_000;
const INTRO_TEXT_WINDOW_GAP_MS = 30_000;
const INTRO_TEXT_WINDOW_BG_FADE_MS = 450;
const NAVIGATION_FADE_MS = 450;
const INTRO_PROXIMITY_SCALE = 0.7;
let [currentArtwork, previousArtwork] = [null, null];
let [typewriterIndex, typewriterText, typewriterTimeout] = [0, '', null];
let proximityTimeout = null;
let hudResetTimeout = null;
let hudRevealTimeout = null;
let detailsWindowFadeTimeout = null;
let pendingArtwork = null;
let pendingArtworkSince = 0;
let artworkLostSince = 0;
let language = 'lv';
let lastMovementAt = performance.now();
let introWindowStepTimeout = null;
let introWindowLoopTimeout = null;
let introWindowHideTimeout = null;
let introWindowToken = 0;
let introWindowRunning = false;
let introWindowRestartPending = false;
let introIdleArrowsWithMessage = false;
let clickPromptDisabled = false;
let clickPromptTargetId = null;
let clickPromptStartedAt = 0;

const languageButton = document.createElement('button');
languageButton.id = 'lang-toggle';
languageButton.type = 'button';
document.body.appendChild(languageButton);

const idleArrows = document.createElement('div');
idleArrows.id = 'idle-arrows';
idleArrows.setAttribute('aria-hidden', 'true');
idleArrows.innerHTML = '<span class="idle-arrow top">↑</span><span class="idle-arrow right">↑</span><span class="idle-arrow bottom">↑</span><span class="idle-arrow left">↑</span>';
document.body.appendChild(idleArrows);

const clickPrompt = document.createElement('div');
clickPrompt.id = 'click-prompt';
clickPrompt.setAttribute('aria-hidden', 'true');
clickPrompt.innerHTML = '<span class="click-arrow top">↑</span><span class="click-arrow right">↑</span><span class="click-arrow bottom">↑</span><span class="click-arrow left">↑</span>';
document.body.appendChild(clickPrompt);

const introTextWindow = document.createElement('div');
introTextWindow.id = 'intro-text-window';
introTextWindow.setAttribute('aria-hidden', 'true');
const introTextWindowLabel = document.createElement('span');
introTextWindowLabel.id = 'intro-text-window-label';
introTextWindow.appendChild(introTextWindowLabel);
introTextWindow.classList.add('active', 'is-visible');
document.body.appendChild(introTextWindow);

const getLocalizedText = (sprite, key) => {
  if (!sprite) return '';
  const primary = language === 'en' ? `${key}_en` : key;
  const fallback = language === 'en' ? key : `${key}_en`;
  return sprite[primary] ?? sprite[fallback] ?? '';
};

const updateLanguageToggleUi = () => {
  languageButton.textContent = language === 'lv' ? 'EN' : 'LV';
};

const updateDocumentTitle = () => {
  document.title = PORTFOLIO_TITLES[language] ?? PORTFOLIO_TITLES.lv;
};

const updateMainPageTooltip = () => {
  gameLogo.title = MAIN_PAGE_TOOLTIPS[language] ?? MAIN_PAGE_TOOLTIPS.lv;
};

const getIntroWindowMessages = () => language === 'en'
  ? ['ENOUGH SWIPING', 'ENJOY THE SPACE']
  : ['PIETIEK GLĀSTĪT', 'IZBAUDI TELPU'];

const updateLanguageToggleVisibility = () => {
  languageButton.classList.toggle('visible', currentArtwork?.id === INTRO_SPRITE_ID);
};

const clearIntroWindowTimers = () => {
  clearTimer(introWindowStepTimeout);
  introWindowStepTimeout = null;
  clearTimer(introWindowLoopTimeout);
  introWindowLoopTimeout = null;
  clearTimer(introWindowHideTimeout);
  introWindowHideTimeout = null;
};

const stopIntroTextWindow = () => {
  if (!introWindowRunning && !introTextWindow.classList.contains('active')) return;

  introWindowRunning = false;
  introIdleArrowsWithMessage = false;
  idleArrows.style.display = '';
  idleArrows.classList.remove('intro-sync-fade');
  introWindowToken++;
  clearIntroWindowTimers();

  introTextWindow.classList.remove('is-visible');
  introWindowHideTimeout = setTimeout(() => {
    introTextWindow.classList.remove('active');
    introTextWindowLabel.classList.remove('is-animating');
    introWindowHideTimeout = null;
  }, INTRO_TEXT_WINDOW_BG_FADE_MS);
};

const showIntroTextWindowBackground = (token, fadeIn) => {
  introTextWindow.classList.add('active');

  if (!fadeIn) {
    introTextWindow.classList.add('is-visible');
    return;
  }

  introTextWindow.classList.remove('is-visible');
  requestAnimationFrame(() => {
    if (!introWindowRunning || token !== introWindowToken) return;
    introTextWindow.classList.add('is-visible');
  });
};

const hideIntroTextWindowBackground = (token, onHidden) => {
  introTextWindow.classList.remove('is-visible');
  introWindowHideTimeout = setTimeout(() => {
    if (!introWindowRunning || token !== introWindowToken) return;
    introTextWindow.classList.remove('active');
    introWindowHideTimeout = null;
    onHidden?.();
  }, INTRO_TEXT_WINDOW_BG_FADE_MS);
};

const startIntroTextWindowCycle = (token, fadeIn) => {
  if (!introWindowRunning || token !== introWindowToken) return;
  showIntroTextWindowBackground(token, fadeIn);
  runIntroTextWindowStep(0, token);
};

const runIntroTextWindowStep = (stepIndex, token) => {
  if (!introWindowRunning || token !== introWindowToken) return;

  const messages = getIntroWindowMessages();
  introIdleArrowsWithMessage = stepIndex === 1;
  if (introIdleArrowsWithMessage) {
    idleArrows.classList.remove('intro-sync-fade');
    void idleArrows.offsetWidth;
    idleArrows.classList.add('intro-sync-fade');
  } else {
    idleArrows.classList.remove('intro-sync-fade');
  }
  introTextWindowLabel.textContent = messages[stepIndex] ?? '';
  introTextWindow.classList.add('active');
  introTextWindowLabel.classList.remove('is-animating');
  void introTextWindow.offsetWidth;
  introTextWindowLabel.classList.add('is-animating');

  introWindowStepTimeout = setTimeout(() => {
    if (!introWindowRunning || token !== introWindowToken) return;
    introTextWindowLabel.classList.remove('is-animating');
    introIdleArrowsWithMessage = false;

    if (introWindowRestartPending) {
      introWindowRestartPending = false;
      runIntroTextWindowStep(0, token);
      return;
    }

    const nextStep = stepIndex + 1;
    if (nextStep < messages.length) {
      runIntroTextWindowStep(nextStep, token);
      return;
    }
    hideIntroTextWindowBackground(token, () => {
      introWindowLoopTimeout = setTimeout(() => {
        if (!introWindowRunning || token !== introWindowToken) return;
        startIntroTextWindowCycle(token, true);
      }, INTRO_TEXT_WINDOW_GAP_MS);
    });
  }, INTRO_TEXT_WINDOW_STEP_MS);
};

const ensureIntroTextWindowState = () => {
  if (currentArtwork?.id !== INTRO_SPRITE_ID) {
    if (introWindowRunning) stopIntroTextWindow();
    return;
  }

  if (introWindowRunning) return;
  introWindowRunning = true;
  introWindowToken++;
  startIntroTextWindowCycle(introWindowToken, false);
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
updateDocumentTitle();
updateMainPageTooltip();
const sprites = getAllSprites();

const applyViewportSpriteAdjustments = () => {
  const isPortrait = window.innerWidth / window.innerHeight < 1;

  for (const s of sprites) {
    if (s._childOf) continue;

    if (!s._baseViewportMetricsReady) {
      s._baseViewportMetricsReady = true;
      s._baseSize = s.size;
      s._baseHasChildDistanceScale = Object.prototype.hasOwnProperty.call(s, 'childDistanceScale');
      s._baseChildDistanceScale = s.childDistanceScale;
    }

    if (isPortrait) {
      s.size = Math.max(0.05, s._baseSize - 0.3);
      s.childDistanceScale = 0.72;
    } else {
      s.size = s._baseSize;
      if (s._baseHasChildDistanceScale) s.childDistanceScale = s._baseChildDistanceScale;
      else delete s.childDistanceScale;
    }

    if (!s.childSprites) continue;
    for (const c of s.childSprites) {
      if (!c._baseViewportMetricsReady) {
        c._baseViewportMetricsReady = true;
        c._baseSize = c.size;
        c._baseHasYOffset = Object.prototype.hasOwnProperty.call(c, 'yOffset');
        c._baseYOffset = c.yOffset;
        c._baseHasXOffset = Object.prototype.hasOwnProperty.call(c, 'xOffset');
        c._baseXOffset = c.xOffset;
        c._baseHasHeightScale = Object.prototype.hasOwnProperty.call(c, 'heightScale');
        c._baseHeightScale = c.heightScale;
      }

      if (isPortrait) {
        c.size = Math.max(0.05, c._baseSize - 0.1);
        if (typeof c._baseYOffset === 'number') c.yOffset = c._baseYOffset * 1.5;
        else if (!c._baseHasYOffset) delete c.yOffset;

        const baseXOffset = typeof c._baseXOffset === 'number' ? c._baseXOffset : 0;
        const baseHeightScale = typeof c._baseHeightScale === 'number' ? c._baseHeightScale : 0;
        c.xOffset = baseHeightScale;
        c.heightScale = baseXOffset;
      } else {
        c.size = c._baseSize;

        if (c._baseHasYOffset) c.yOffset = c._baseYOffset;
        else delete c.yOffset;

        if (c._baseHasXOffset) c.xOffset = c._baseXOffset;
        else delete c.xOffset;

        if (c._baseHasHeightScale) c.heightScale = c._baseHeightScale;
        else delete c.heightScale;
      }
    }
  }
};

applyViewportSpriteAdjustments();
['resize', 'orientationchange'].forEach(e => window.addEventListener(e, applyViewportSpriteAdjustments));

const clearTimer = timer => timer && clearTimeout(timer);
const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const formatDetailsWindowText = (artwork, longDescription) => {
  if (!artwork || artwork.id !== INTRO_SPRITE_ID) return escapeHtml(longDescription);

  const commaIndex = longDescription.indexOf(',');
  if (commaIndex === -1) return escapeHtml(longDescription);

  const heading = longDescription.slice(0, commaIndex + 1).trim();
  const body = longDescription.slice(commaIndex + 1).trimStart();
  return `<span class="hud-window-name">${escapeHtml(heading)}</span>${escapeHtml(body)}`;
};

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
  const detailsTextHtml = formatDetailsWindowText(artwork, longDescription);
  hud.insertAdjacentHTML('beforeend', `<div class="hud-window"><p class="hud-window-text">${detailsTextHtml}</p></div>`);
  hud.dataset.details = '1';
  hud.classList.remove('hidden');
};

const handleArtworkInteraction = () => {
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
};

const isIdleArrowsMobileContext = () => {
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  const noHover = window.matchMedia?.('(hover: none)').matches;
  const isPhoneLikeViewport = Math.min(window.innerWidth, window.innerHeight) <= 900;
  return Boolean(touch.isMobile && coarsePointer && noHover && isPhoneLikeViewport);
};

const getClickPromptText = () => {
  const isMobilePrompt = isIdleArrowsMobileContext();
  if (language === 'en') return isMobilePrompt ? 'tap' : 'click';
  return isMobilePrompt ? 'spied' : 'kliksķini';
};

const registerPointerInteraction = () => {
  if (currentArtwork?.id && currentArtwork.id !== INTRO_SPRITE_ID) {
    clickPromptTargetId = currentArtwork.id;
    clickPromptStartedAt = performance.now();
  }
  if (clickPrompt.classList.contains('visible')) {
    clickPromptDisabled = true;
    clickPrompt.classList.remove('visible');
  }
};

const updateIdleArrows = (now, movedThisFrame, hasNonIntroProximity) => {
  if (introIdleArrowsWithMessage) {
    idleArrows.style.display = 'block';
    idleArrows.classList.add('visible');
    return;
  }

  idleArrows.style.display = '';
  idleArrows.classList.remove('intro-sync-fade');

  if (!isIdleArrowsMobileContext()) {
    idleArrows.classList.remove('visible');
    return;
  }

  if (movedThisFrame) lastMovementAt = now;
  const shouldShow = !hasNonIntroProximity && now - lastMovementAt >= IDLE_ARROWS_DELAY_MS;
  idleArrows.classList.toggle('visible', shouldShow);
};

const updateClickPrompt = (now, hasNonIntroProximity) => {
  if (clickPromptDisabled || !hasNonIntroProximity) {
    clickPromptTargetId = null;
    clickPromptStartedAt = 0;
    clickPrompt.classList.remove('visible');
    return;
  }

  const targetId = currentArtwork?.id ?? null;
  if (!targetId || targetId === INTRO_SPRITE_ID) {
    clickPromptTargetId = null;
    clickPromptStartedAt = 0;
    clickPrompt.classList.remove('visible');
    return;
  }

  if (clickPromptTargetId !== targetId || !clickPromptStartedAt) {
    clickPromptTargetId = targetId;
    clickPromptStartedAt = now;
    clickPrompt.classList.remove('visible');
    return;
  }

  const shouldShow = now - clickPromptStartedAt >= CLICK_PROMPT_DELAY_MS;
  if (!shouldShow) {
    clickPrompt.classList.remove('visible');
    return;
  }

  clickPrompt.classList.add('visible');
};

const checkProximity = (px, py, r, cosAngle, sinAngle) => {
  let closest = null, closestDistSq = Infinity;
  const rSq = r * r;
  const holdRadius = r + ARTWORK_HOLD_RADIUS_EXTRA;
  const introHoldRadiusSq = (holdRadius * INTRO_PROXIMITY_SCALE) * (holdRadius * INTRO_PROXIMITY_SCALE);
  const holdRadiusSq = holdRadius * holdRadius;

  // Hysteresis: keep the previously selected artwork while still nearby.
  if (previousArtwork && previousArtwork.interactive !== false) {
    const prevDx = previousArtwork.x - px;
    const prevDy = previousArtwork.y - py;
    const prevDistSq = prevDx * prevDx + prevDy * prevDy;
    const prevInFov = (prevDx * cosAngle + prevDy * sinAngle) / Math.sqrt(prevDistSq || 1) >= COS_HALF_FOV;
    const prevLimitSq = previousArtwork.id === INTRO_SPRITE_ID ? introHoldRadiusSq : holdRadiusSq;
    if (prevDistSq > 0 && prevDistSq < prevLimitSq && (previousArtwork.id === INTRO_SPRITE_ID || prevInFov)) {
      closest = previousArtwork;
      closestDistSq = prevDistSq;
    }
  }

  for (const s of sprites) {
    if (s.interactive === false) continue;
    const dx = s.x - px, dy = s.y - py, distSq = dx * dx + dy * dy;
    const spriteRadiusSq = (s.id === INTRO_SPRITE_ID ? r * INTRO_PROXIMITY_SCALE : r) ** 2;
    if (distSq >= spriteRadiusSq || distSq >= closestDistSq || distSq === 0) continue;
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
  if (hud.dataset.mode === 'artwork') showArtworkHud(currentArtwork, false);
  if (hud.dataset.details === '1') showDetailsHud(currentArtwork);
};

languageButton.addEventListener('click', () => {
  language = language === 'lv' ? 'en' : 'lv';
  if (introWindowRunning) {
    introWindowRestartPending = true;
  }
  updateLanguageToggleUi();
  updateDocumentTitle();
  updateMainPageTooltip();
  rerenderHudForLanguage();
});

const update = () => {
  const p = player;
  const startX = p.x;
  const startY = p.y;
  const startAngle = p.angle;
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

  const cosAngle = Math.cos(p.angle);
  const sinAngle = Math.sin(p.angle);
  const nextX = p.x + cosAngle * p.moveVelocity;
  const nextY = p.y + sinAngle * p.moveVelocity;
  
  if (!isWall(nextX, p.y)) p.x = nextX;
  if (!isWall(p.x, nextY)) p.y = nextY;
  
  const proximityRadius = 1;
  checkProximity(p.x, p.y, proximityRadius, cosAngle, sinAngle);
  ensureIntroTextWindowState();
  const movedThisFrame = Math.abs(p.x - startX) > 0.0001 || Math.abs(p.y - startY) > 0.0001 || Math.abs(p.angle - startAngle) > 0.0001;
  const hasNonIntroProximity = Boolean(currentArtwork?.id && currentArtwork.id !== INTRO_SPRITE_ID);
  const frameNow = performance.now();
  updateIdleArrows(frameNow, movedThisFrame, hasNonIntroProximity);
  updateClickPrompt(frameNow, hasNonIntroProximity);
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
    hud.classList.add('hidden');
    gameLogo.classList.toggle('visible', currentArtwork?.id === 'A');
    updateLanguageToggleVisibility();
    
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
canvas.addEventListener('pointerdown', evt => {
  if (evt.pointerType === 'touch') return;
  registerPointerInteraction();
  handleArtworkInteraction();
});

canvas.addEventListener('touchstart', evt => {
  for (const changedTouch of evt.changedTouches) {
    if (!isDeadZoneTouch(changedTouch.clientX, changedTouch.clientY)) continue;
    registerPointerInteraction();
    handleArtworkInteraction();
    break;
  }
}, { passive: true });

document.addEventListener('keydown', evt => {
  if (evt.key !== ' ' || evt.repeat) return;
  if (!currentArtwork?.id) return;
  evt.preventDefault();
  handleArtworkInteraction();
});

gameLogo.addEventListener('pointerdown', evt => {
  evt.preventDefault();
  evt.stopPropagation();

  // Fade out before returning to the index page.
  document.body.classList.remove('loaded');
  setTimeout(() => {
    window.location.href = 'index.html?home=1';
  }, NAVIGATION_FADE_MS);
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