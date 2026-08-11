import { player } from "./engine/player.js";
import { keys } from "./engine/input.js";
import { isWall } from "./engine/collision.js";
import { renderFrame } from "./engine/raycaster.js";
import { clearChildSprites, getAllSprites, getSpriteById, spawnChildSprites } from "./engine/sprites.js";
import { isDeadZoneTouch, touch } from "./engine/touch.js";
const [canvas, hud, gameLogo, gamePageIndicator] = ['gameCanvas', 'hud', 'game-logo', 'page-indicator-game']
  .map(id => document.getElementById(id));
const FOV = Math.PI / 3;
const COS_HALF_FOV = Math.cos(FOV / 2);
const MAX_RENDER_PIXELS = 1_800_000;
const MOBILE_MAX_RENDER_PIXELS = 4_200_000;
const MIN_RENDER_SCALE = 0.5;
const MOBILE_MIN_RENDER_SCALE = 1;
const MOBILE_RENDER_PIXEL_RATIO_CAP = 3;
const MOBILE_DPR_BOOST_MAX_VIEWPORT_PIXELS = 2_000_000;
const INTRO_SPRITE_ID = 'A';
const PORTFOLIO_TITLES = {
  lv: 'Kočāns - dizaina portfolio',
  en: 'Kočāns - design portfolio'
};
const MAIN_PAGE_INDICATORS = {
  lv: 'uz galveno lapu',
  en: 'to main page'
};
const DETAILS_SOCIAL_LINKS = [
  {
    href: 'mailto:kocans@proton.me',
    icon: 'textures/mail.svg',
    label: 'Mail',
    external: false
  },
  {
    href: 'https://www.instagram.com/ezissoniks/',
    icon: 'textures/instagram.svg',
    label: 'Instagram',
    external: true
  }
];
const ARTWORK_HOLD_RADIUS_EXTRA = 0.3;
const ARTWORK_SWITCH_DEBOUNCE_MS = 160;
const ARTWORK_LOST_GRACE_MS = 240;
const DETAILS_WINDOW_FADE_MS = 220;
const CLICK_PROMPT_DELAY_MS = 2_000;
const INTRO_TEXT_WINDOW_STEP_MS = 5_000;
const INTRO_TEXT_WINDOW_MOBILE_STEP_MS = 2_500;
const INTRO_TEXT_WINDOW_BG_FADE_MS = 450;
const INTRO_AUTO_MOVE_DISTANCE = 1;
const NAVIGATION_FADE_MS = 450;
const INTRO_PROXIMITY_SCALE = 0.7;
const MOBILE_ENTITY_SCALE = 0.7;
const MOBILE_DPR_MIN = 2;
const TOUCH_TAP_MAX_MOVE_PX = 12;
const TOUCH_TAP_MAX_DURATION_MS = 300;
const IDLE_VELOCITY_EPSILON = 0.001;
const TWO_PI = Math.PI * 2;
let canvasResizeRafId = null;
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
let introWindowStepTimeout = null;
let introWindowLoopTimeout = null;
let introWindowHideTimeout = null;
let introWindowToken = 0;
let introWindowRunning = false;
let introWindowPlayedOnSpawn = false;
let introWindowStepIndex = 0;
let introWindowReplayedOnLanguageToggle = false;
let introWindowSkipAutoMoveOnce = false;
let introAutoMoveRemaining = 0;
let clickPromptDisabled = false;
let clickPromptTargetId = null;
let clickPromptStartedAt = 0;
const touchTapCandidates = new Map();

const setAppViewportHeight = () => {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${Math.max(1, Math.round(viewportHeight))}px`);
};

const languageButton = document.createElement('button');
languageButton.id = 'lang-toggle';
languageButton.type = 'button';
document.body.appendChild(languageButton);

const idleArrows = document.createElement('div');
idleArrows.id = 'idle-arrows';
idleArrows.setAttribute('aria-hidden', 'true');
idleArrows.innerHTML = '<span class="idle-arrow right">↑</span><span class="idle-arrow left">↑</span>';
document.body.appendChild(idleArrows);

const clickPrompt = document.createElement('div');
clickPrompt.id = 'click-prompt';
clickPrompt.setAttribute('aria-hidden', 'true');
clickPrompt.innerHTML = '<span class="click-arrow right">↑</span><span class="click-arrow left">↑</span>';
document.body.appendChild(clickPrompt);

const clickCursorLabel = document.createElement('div');
clickCursorLabel.id = 'click-cursor-label';
clickCursorLabel.setAttribute('aria-hidden', 'true');
clickCursorLabel.textContent = 'klikšķini';
document.body.appendChild(clickCursorLabel);

const setClickLabelPosition = (x, y) => {
  clickCursorLabel.style.setProperty('--click-label-x', `${x}px`);
  clickCursorLabel.style.setProperty('--click-label-y', `${y}px`);
};

setClickLabelPosition(window.innerWidth * 0.5, window.innerHeight * 0.5);
window.addEventListener('pointermove', evt => {
  if (evt.pointerType !== 'mouse' && evt.pointerType !== 'pen') return;
  setClickLabelPosition(evt.clientX, evt.clientY);
}, { passive: true });

const setClickPromptVisible = isVisible => {
  clickPrompt.classList.toggle('visible', isVisible);
  document.body.classList.toggle('click-hint-cursor', isVisible);
};

const introTextWindow = document.createElement('div');
introTextWindow.id = 'intro-text-window';
introTextWindow.setAttribute('aria-hidden', 'true');
const introControls = document.createElement('div');
introControls.id = 'intro-controls';
const introControlsHint = document.createElement('span');
introControlsHint.id = 'intro-controls-hint';
const introControlsArrows = document.createElement('div');
introControlsArrows.id = 'intro-controls-arrows';
introControlsArrows.innerHTML = '<span class="intro-control-arrow top">↑</span><span class="intro-control-arrow right">↑</span><span class="intro-control-arrow bottom">↑</span><span class="intro-control-arrow left">↑</span>';
introControls.appendChild(introControlsHint);
introControls.appendChild(introControlsArrows);
introTextWindow.appendChild(introControls);
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

const updateClickCursorLabel = () => {
  const isMobilePrompt = isIdleArrowsMobileContext();
  if (language === 'en') {
    clickCursorLabel.textContent = isMobilePrompt ? 'tap' : 'click';
    return;
  }
  clickCursorLabel.textContent = isMobilePrompt ? 'spied' : 'klikšķini';
};

const updateDocumentTitle = () => {
  document.title = PORTFOLIO_TITLES[language] ?? PORTFOLIO_TITLES.lv;
};

const updateMainPageIndicator = () => {
  if (!gamePageIndicator) return;
  gamePageIndicator.textContent = MAIN_PAGE_INDICATORS[language] ?? MAIN_PAGE_INDICATORS.lv;
};

const getIntroControlSteps = () => {
  const isMobilePrompt = isIdleArrowsMobileContext();

  if (!isMobilePrompt) {
    return [
      {
        mode: 'desktop',
        hint: language === 'en' ? 'move with arrow keys' : 'kusties ar bultiņām'
      }
    ];
  }

  return [
    {
      mode: 'turn',
      hint: language === 'en' ? 'swipe to turn' : 'velc, lai pagrieztos'
    },
    {
      mode: 'pinch',
      hint: language === 'en' ? 'pinch to move' : 'pievelc, lai kustētos'
    }
  ];
};

const renderIntroControls = introStep => {
  const isMobilePrompt = isIdleArrowsMobileContext();
  introTextWindow.dataset.controls = isMobilePrompt ? 'mobile' : 'desktop';
  introTextWindow.dataset.step = introStep?.mode ?? (isMobilePrompt ? 'turn' : 'desktop');
  introControlsHint.textContent = introStep?.hint ?? '';
};

const rerenderIntroControlsForCurrentStep = () => {
  const steps = getIntroControlSteps();
  const safeStepIndex = Math.max(0, Math.min(introWindowStepIndex, steps.length - 1));
  renderIntroControls(steps[safeStepIndex]);
};

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
  introWindowToken++;
  clearIntroWindowTimers();

  introTextWindow.classList.remove('is-visible');
  introWindowHideTimeout = setTimeout(() => {
    introTextWindow.classList.remove('active');
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

  const steps = getIntroControlSteps();
  const introStep = steps[stepIndex] ?? steps[steps.length - 1];
  introWindowStepIndex = stepIndex;
  renderIntroControls(introStep);
  introTextWindow.classList.add('active');
  introControls.classList.remove('is-animating');
  void introTextWindow.offsetWidth;
  introControls.classList.add('is-animating');

  const stepDuration = introTextWindow.dataset.controls === 'mobile'
    ? INTRO_TEXT_WINDOW_MOBILE_STEP_MS
    : INTRO_TEXT_WINDOW_STEP_MS;
  introControls.style.setProperty('--intro-step-duration', `${stepDuration}ms`);

  introWindowStepTimeout = setTimeout(() => {
    if (!introWindowRunning || token !== introWindowToken) return;
    introControls.classList.remove('is-animating');

    if (stepIndex + 1 < steps.length) {
      runIntroTextWindowStep(stepIndex + 1, token);
      return;
    }

    if (introWindowSkipAutoMoveOnce) {
      introWindowSkipAutoMoveOnce = false;
      introAutoMoveRemaining = 0;
    } else {
      introAutoMoveRemaining = INTRO_AUTO_MOVE_DISTANCE;
    }
    hideIntroTextWindowBackground(token, () => {
      introWindowRunning = false;
      introWindowLoopTimeout = null;
    });
  }, stepDuration);
};

const ensureIntroTextWindowState = () => {
  if (introWindowRunning) return;
  if (introWindowPlayedOnSpawn) return;

  introWindowRunning = true;
  introWindowPlayedOnSpawn = true;
  introWindowToken++;
  startIntroTextWindowCycle(introWindowToken, false);
};

const replayIntroTextWindowOnFirstLanguageToggle = () => {
  if (introWindowReplayedOnLanguageToggle) return;

  introWindowReplayedOnLanguageToggle = true;
  introWindowSkipAutoMoveOnce = true;
  clearIntroWindowTimers();
  introWindowToken++;
  introWindowRunning = true;
  introWindowStepIndex = 0;
  introAutoMoveRemaining = 0;
  startIntroTextWindowCycle(introWindowToken, true);
};

const setCanvasSize = () => {
  const rect = canvas.getBoundingClientRect();
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const vw = Math.max(1, Math.round(rect.width || viewportWidth));
  const vh = Math.max(1, Math.round(rect.height || viewportHeight));
  const pixelCount = vw * vh;
  const isMobileViewport = touch.isMobile || window.matchMedia?.('(pointer: coarse)').matches;
  const maxRenderPixels = isMobileViewport ? MOBILE_MAX_RENDER_PIXELS : MAX_RENDER_PIXELS;
  const autoScale = pixelCount > maxRenderPixels ? Math.sqrt(maxRenderPixels / pixelCount) : 1;
  const minRenderScale = isMobileViewport ? MOBILE_MIN_RENDER_SCALE : MIN_RENDER_SCALE;
  const renderScale = Math.max(minRenderScale, Math.min(1, autoScale));
  const shouldUseMobileDprBoost = isMobileViewport && pixelCount <= MOBILE_DPR_BOOST_MAX_VIEWPORT_PIXELS;
  const requestedDevicePixelRatioScale = shouldUseMobileDprBoost
    ? Math.min(
      Math.max(window.devicePixelRatio || 1, MOBILE_DPR_MIN),
      MOBILE_RENDER_PIXEL_RATIO_CAP
    )
    : 1;
  const dprBudgetCap = Math.sqrt(maxRenderPixels / Math.max(1, pixelCount * renderScale * renderScale));
  const devicePixelRatioScale = Math.max(1, Math.min(requestedDevicePixelRatioScale, dprBudgetCap));
  const nextWidth = Math.max(1, Math.floor(vw * renderScale * devicePixelRatioScale));
  const nextHeight = Math.max(1, Math.floor(vh * renderScale * devicePixelRatioScale));
  if (canvas.width === nextWidth && canvas.height === nextHeight) return false;
  canvas.width = nextWidth;
  canvas.height = nextHeight;
  return true;
};
const scheduleCanvasSizeSync = () => {
  if (canvasResizeRafId !== null) return;
  canvasResizeRafId = requestAnimationFrame(() => {
    canvasResizeRafId = null;
    const didResizeCanvas = setCanvasSize();
    if (didResizeCanvas) renderFrame(canvas, player.x, player.y, player.angle);
  });
};

const syncViewportMetrics = () => {
  setAppViewportHeight();
  scheduleCanvasSizeSync();
};

['load', 'resize', 'orientationchange'].forEach(e => window.addEventListener(e, syncViewportMetrics));
window.visualViewport?.addEventListener('resize', scheduleCanvasSizeSync);
window.visualViewport?.addEventListener('resize', setAppViewportHeight);
window.addEventListener('load', () => document.body.classList.add('loaded'));
setAppViewportHeight();
setCanvasSize();
renderFrame(canvas, player.x, player.y, player.angle);
updateLanguageToggleUi();
updateClickCursorLabel();
updateDocumentTitle();
updateMainPageIndicator();
const sprites = getAllSprites();
const introArtwork = getSpriteById(INTRO_SPRITE_ID);

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
      s.size = Math.max(0.05, s._baseSize * MOBILE_ENTITY_SCALE);
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
        c.size = Math.max(0.05, c._baseSize * MOBILE_ENTITY_SCALE);
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

const getDetailsSocialLinksHtml = () => {
  const links = DETAILS_SOCIAL_LINKS.map(link => {
    const targetAttrs = link.external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a class="social-link" href="${link.href}" aria-label="${link.label}"${targetAttrs}><img src="${link.icon}" alt="${link.label}" draggable="false"></a>`;
  }).join('');
  return `<div class="hud-social-links">${links}</div>`;
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
  const useMobileIntroDescription = artwork?.id === INTRO_SPRITE_ID && isIdleArrowsMobileContext();
  const longDescription = (
    useMobileIntroDescription
      ? getLocalizedText(artwork, 'm_long_description')
      : getLocalizedText(artwork, 'long_description')
  ) || getLocalizedText(artwork, 'long_description') || getLocalizedText(artwork, 'description');
  if (!longDescription) return;
  removeDetailsWindow(false);
  const detailsTextHtml = formatDetailsWindowText(artwork, longDescription);
  const detailsSocialLinksHtml = artwork?.id === INTRO_SPRITE_ID ? getDetailsSocialLinksHtml() : '';
  hud.insertAdjacentHTML('beforeend', `<div class="hud-window"><p class="hud-window-text">${detailsTextHtml}</p>${detailsSocialLinksHtml}</div>`);
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
  if (spawned > 0) {
    clickPromptDisabled = true;
    clickPromptTargetId = null;
    clickPromptStartedAt = 0;
    setClickPromptVisible(false);
    return;
  }

  const childCount = Array.isArray(currentArtwork.childSprites) ? currentArtwork.childSprites.length : 0;
  const viewedAllChildren = childCount === 0 || (currentArtwork._nextChildIndex ?? 0) >= childCount;
  if (viewedAllChildren && currentArtwork.long_description) {
    showDetailsHud(currentArtwork);
  }
};

function isIdleArrowsMobileContext() {
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  const noHover = window.matchMedia?.('(hover: none)').matches;
  const isPhoneLikeViewport = Math.min(window.innerWidth, window.innerHeight) <= 900;
  return Boolean(touch.isMobile && coarsePointer && noHover && isPhoneLikeViewport);
}

const getClickPromptText = () => {
  const isMobilePrompt = isIdleArrowsMobileContext();
  if (language === 'en') return isMobilePrompt ? 'tap' : 'click';
  return isMobilePrompt ? 'spied' : 'klikšķini';
};

const registerPointerInteraction = () => {
  if (currentArtwork?.id && currentArtwork.id !== INTRO_SPRITE_ID) {
    clickPromptTargetId = currentArtwork.id;
    clickPromptStartedAt = performance.now();
  }
  if (clickPrompt.classList.contains('visible')) setClickPromptVisible(false);
};

const updateIdleArrows = () => {
  idleArrows.classList.remove('visible');
};

const updateClickPrompt = (now, hasNonIntroProximity) => {
  if (clickPromptDisabled || !hasNonIntroProximity) {
    clickPromptTargetId = null;
    clickPromptStartedAt = 0;
    setClickPromptVisible(false);
    return;
  }

  const targetId = currentArtwork?.id ?? null;
  if (!targetId || targetId === INTRO_SPRITE_ID) {
    clickPromptTargetId = null;
    clickPromptStartedAt = 0;
    setClickPromptVisible(false);
    return;
  }

  if (clickPromptTargetId !== targetId || !clickPromptStartedAt) {
    clickPromptTargetId = targetId;
    clickPromptStartedAt = now;
    setClickPromptVisible(false);
    return;
  }

  const shouldShow = now - clickPromptStartedAt >= CLICK_PROMPT_DELAY_MS;
  if (!shouldShow) {
    setClickPromptVisible(false);
    return;
  }

  setClickPromptVisible(true);
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
  if (introWindowRunning) rerenderIntroControlsForCurrentStep();
  if (currentArtwork?.id === INTRO_SPRITE_ID || introWindowRunning) {
    replayIntroTextWindowOnFirstLanguageToggle();
  }
  updateLanguageToggleUi();
  updateClickCursorLabel();
  updateDocumentTitle();
  updateMainPageIndicator();
  rerenderHudForLanguage();
});

['resize', 'orientationchange'].forEach(e => window.addEventListener(e, () => {
  updateClickCursorLabel();
  if (introWindowRunning) rerenderIntroControlsForCurrentStep();
}));

const update = () => {
  const p = player;
  const rotLeft = keys['a'] || keys['arrowleft'] || touch.rotateLeft;
  const rotRight = keys['d'] || keys['arrowright'] || touch.rotateRight;
  const introAutoMoving = introAutoMoveRemaining > 0;
  const moveForward = keys['w'] || keys['arrowup'] || touch.forward || introAutoMoving;
  const moveBackward = keys['s'] || keys['arrowdown'] || touch.backward;
  const beforeMoveX = p.x;
  const beforeMoveY = p.y;
  
  if (rotLeft) p.rotVelocity = Math.max(p.rotVelocity - p.rotAccel, -p.maxRotVelocity);
  else if (rotRight) p.rotVelocity = Math.min(p.rotVelocity + p.rotAccel, p.maxRotVelocity);
  else p.rotVelocity *= p.rotFriction;
  p.angle += p.rotVelocity;
  if (p.angle > Math.PI || p.angle < -Math.PI) p.angle = ((p.angle + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
  if (moveForward) p.moveVelocity = Math.min(p.moveVelocity + p.moveAccel, p.maxMoveVelocity);
  else if (moveBackward) p.moveVelocity = Math.max(p.moveVelocity - p.moveAccel, -p.maxMoveVelocity);
  else p.moveVelocity *= p.moveFriction;

  const cosAngle = Math.cos(p.angle);
  const sinAngle = Math.sin(p.angle);
  const nextX = p.x + cosAngle * p.moveVelocity;
  const nextY = p.y + sinAngle * p.moveVelocity;
  
  if (!isWall(nextX, p.y)) p.x = nextX;
  if (!isWall(p.x, nextY)) p.y = nextY;

  if (introAutoMoving) {
    const movedDistance = Math.hypot(p.x - beforeMoveX, p.y - beforeMoveY);
    if (movedDistance <= 0.0001) {
      introAutoMoveRemaining = 0;
    } else {
      introAutoMoveRemaining = Math.max(0, introAutoMoveRemaining - movedDistance);
    }
  }
  
  const proximityRadius = 1;
  checkProximity(p.x, p.y, proximityRadius, cosAngle, sinAngle);

  const introFallbackReady = introWindowPlayedOnSpawn && !introWindowRunning && !introAutoMoving;
  const hasMovementInput = rotLeft || rotRight || moveForward || moveBackward;
  const isIdleMovement = !hasMovementInput
    && Math.abs(p.moveVelocity) <= IDLE_VELOCITY_EPSILON
    && Math.abs(p.rotVelocity) <= IDLE_VELOCITY_EPSILON;

  if (introFallbackReady && !currentArtwork?.id && isIdleMovement && introArtwork) {
    currentArtwork = introArtwork;
  }

  ensureIntroTextWindowState();
  const hasNonIntroProximity = Boolean(currentArtwork?.id && currentArtwork.id !== INTRO_SPRITE_ID);
  const frameNow = performance.now();
  updateIdleArrows();
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
    const isIntroArtworkActive = currentArtwork?.id === INTRO_SPRITE_ID;
    gameLogo.classList.toggle('visible', isIntroArtworkActive);
    gamePageIndicator?.classList.toggle('visible', isIntroArtworkActive);
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
  const now = performance.now();
  const isSingleTouchStart = evt.touches.length === 1;

  for (const changedTouch of evt.changedTouches) {
    touchTapCandidates.set(changedTouch.identifier, {
      startX: changedTouch.clientX,
      startY: changedTouch.clientY,
      startTime: now,
      moved: false,
      startedInDeadZone: isDeadZoneTouch(changedTouch.clientX, changedTouch.clientY),
      singleTouchOnly: isSingleTouchStart
    });
  }
}, { passive: true });

canvas.addEventListener('touchmove', evt => {
  const isSingleTouch = evt.touches.length === 1;

  for (const movedTouch of evt.changedTouches) {
    const tapCandidate = touchTapCandidates.get(movedTouch.identifier);
    if (!tapCandidate) continue;

    const deltaX = movedTouch.clientX - tapCandidate.startX;
    const deltaY = movedTouch.clientY - tapCandidate.startY;
    const movedDistance = Math.hypot(deltaX, deltaY);

    if (movedDistance > TOUCH_TAP_MAX_MOVE_PX) tapCandidate.moved = true;
    if (!isSingleTouch) tapCandidate.singleTouchOnly = false;
  }
}, { passive: true });

canvas.addEventListener('touchend', evt => {
  const now = performance.now();

  for (const endedTouch of evt.changedTouches) {
    const tapCandidate = touchTapCandidates.get(endedTouch.identifier);
    touchTapCandidates.delete(endedTouch.identifier);
    if (!tapCandidate) continue;

    const touchDuration = now - tapCandidate.startTime;
    const isTap = tapCandidate.startedInDeadZone
      && tapCandidate.singleTouchOnly
      && !tapCandidate.moved
      && touchDuration <= TOUCH_TAP_MAX_DURATION_MS;

    if (!isTap) continue;
    registerPointerInteraction();
    handleArtworkInteraction();
    break;
  }
}, { passive: true });

canvas.addEventListener('touchcancel', evt => {
  for (const cancelledTouch of evt.changedTouches) {
    touchTapCandidates.delete(cancelledTouch.identifier);
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
);

update();