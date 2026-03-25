import { player } from "./engine/player.js";
import { keys } from "./engine/input.js";
import { isWall } from "./engine/collision.js";
import { renderFrame } from "./engine/raycaster.js";
import { getAllSprites } from "./engine/sprites.js";
import { touch } from "./engine/touch.js";
const [canvas, hud, extra, info] = [
  document.getElementById("gameCanvas"),
  document.getElementById("hud"),
  document.getElementById("extra"),
  document.getElementById("info")
];
const FOV = Math.PI / 3;
const DEFAULT_THEME = { bg: '#FFF5EB', primary: '#3C2828' };
let [currentArtwork, previousArtwork, infoPanelOpen] = [null, null, false];
let [typewriterIndex, typewriterText, typewriterTimeout] = [0, '', null];
let proximityTimeout = null;
let infoProximityActive = false;
const setCanvasSize = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
};
setCanvasSize();
window.addEventListener("resize", setCanvasSize);
window.addEventListener("load", () => {
  document.body.classList.add("loaded");
});
const preloadInfoMainImages = () => {
  const preload = src => {
    const img = new Image();
    img.src = src;
    if (img.decode) {
      img.decode().catch(() => {});
    }
  };
  getAllSprites().forEach(sprite => {
    const srcs = [
      sprite.infoMainImage?.src,
      sprite.texture,
      sprite.proximityFade?.to
    ].filter(Boolean);
    srcs.forEach(preload);
  });
};
preloadInfoMainImages();
const sprites = getAllSprites();
const spriteC = sprites.find(s => s.id === 'C');
const applyProximityTheme = theme => {
  document.body.style.setProperty('--bg-color', theme?.bg || DEFAULT_THEME.bg);
  document.body.style.setProperty('--primary-color', theme?.primary || DEFAULT_THEME.primary);
};
let fadeResetTimeout = null;
const startSpriteCFadeOut = () => {
  if (!spriteC?.proximityFade) return;
  const fadeConfig = spriteC.proximityFade;
  fadeConfig._target = 0;
  fadeConfig._from = fadeConfig._value ?? 1;
  fadeConfig._start = performance.now();
  if (fadeResetTimeout) clearTimeout(fadeResetTimeout);
  const duration = fadeConfig.duration ?? 400;
  fadeResetTimeout = setTimeout(() => {
    fadeConfig._value = 0;
    fadeConfig._from = 0;
    fadeConfig._target = 0;
    fadeConfig._start = 0;
    fadeResetTimeout = null;
  }, duration + 50);
};
const checkProximity = (px, py, r, angle) => {
  let closest = null;
  let closestDist = Infinity;
  for (const s of sprites) {
    const dx = s.x - px;
    const dy = s.y - py;
    const dist = Math.hypot(dx, dy);
    if (dist >= r || dist >= closestDist) continue;
    const targetAngle = Math.atan2(dy, dx);
    let relative = targetAngle - angle;
    while (relative > Math.PI) relative -= 2 * Math.PI;
    while (relative < -Math.PI) relative += 2 * Math.PI;
    if (Math.abs(relative) > FOV / 2) continue;
    closest = s;
    closestDist = dist;
  }
  currentArtwork = closest;
};
const typeWriter = () => {
  if (typewriterIndex < typewriterText.length) {
    const char = typewriterText[typewriterIndex];
    if (char === '<') {
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
  } else {
    extra.classList.add('visible');
    touch.extraVisible = true;
  }
};
const closeInfo = () => {
  info.classList.add('closing');
  setTimeout(() => {
    info.classList.remove('active', 'closing');
    infoPanelOpen = false;
    touch.disabled = false;
  }, 600);
};
const update = () => {
  const k = keys;
  const t = touch;
  const p = player;
  const rotLeft = k["a"] || k["arrowleft"] || t.rotateLeft;
  const rotRight = k["d"] || k["arrowright"] || t.rotateRight;
  const moveForward = k["w"] || k["arrowup"] || t.forward;
  const moveBackward = k["s"] || k["arrowdown"] || t.backward;
  
  if (rotLeft) p.rotVelocity = Math.max(p.rotVelocity - p.rotAccel, -p.maxRotVelocity);
  else if (rotRight) p.rotVelocity = Math.min(p.rotVelocity + p.rotAccel, p.maxRotVelocity);
  else p.rotVelocity *= p.rotFriction;
  p.angle += p.rotVelocity;
  if (moveForward) p.moveVelocity = Math.min(p.moveVelocity + p.moveAccel, p.maxMoveVelocity);
  else if (moveBackward) p.moveVelocity = Math.max(p.moveVelocity - p.moveAccel, -p.maxMoveVelocity);
  else p.moveVelocity *= p.moveFriction;
  
  const moveX = Math.cos(p.angle) * p.moveVelocity;
  const moveY = Math.sin(p.angle) * p.moveVelocity;
  const nextX = p.x + moveX;
  const nextY = p.y + moveY;
  
  if (!isWall(nextX, p.y)) p.x = nextX;
  if (!isWall(p.x, nextY)) p.y = nextY;
  
  const proximityRadius = touch.isMobile ? 2 : 1;
  checkProximity(p.x, p.y, proximityRadius, p.angle);
  const targetBgColor = infoProximityActive ? '#EBE9AE' : '#FFF5EB';
  renderFrame(canvas, p.x, p.y, p.angle, proximityRadius, infoProximityActive, targetBgColor);
  if (currentArtwork !== previousArtwork) {
    clearTimeout(typewriterTimeout);
    typewriterTimeout = null;
    if (proximityTimeout) {
      clearTimeout(proximityTimeout);
      proximityTimeout = null;
    }
    extra.classList.remove('visible');
    touch.extraVisible = false;
    hud.classList.add('hidden');
    
    if (infoPanelOpen) {
      info.classList.add('closing');
      setTimeout(() => {
        info.classList.remove('active', 'closing');
      }, 600);
    }
    infoPanelOpen = false;
    
    setTimeout(() => {
      hud.innerHTML = extra.innerHTML = typewriterText = '';
      typewriterIndex = 0;
    }, 500);
    
    if (currentArtwork?.name && currentArtwork?.description) {
      setTimeout(() => {
        typewriterText = `<strong>-- ${currentArtwork.name} --</strong><br><br>${currentArtwork.description}`;
        typewriterIndex = 0;
        hud.innerHTML = '';
        hud.classList.remove('hidden');
        if (currentArtwork.long_description) extra.innerHTML = '[vairāk informācija]';
        const shouldActivateProximity = currentArtwork?.id === 'C';
        if (shouldActivateProximity !== infoProximityActive) {
          infoProximityActive = shouldActivateProximity;
          document.body.classList.toggle('info-proximity', infoProximityActive);
          applyProximityTheme(infoProximityActive ? currentArtwork?.proximityTheme : DEFAULT_THEME);
        }
        typeWriter();
      }, 500);
    } else if (previousArtwork?.id === 'C' && infoProximityActive) {
      proximityTimeout = setTimeout(() => {
        infoProximityActive = false;
        document.body.classList.remove('info-proximity');
        applyProximityTheme(DEFAULT_THEME);
        startSpriteCFadeOut();
        proximityTimeout = null;
      }, 250);
    }
    previousArtwork = currentArtwork;
  }
  
  requestAnimationFrame(update);
};
extra.addEventListener('click', () => {
  if (infoPanelOpen) {
    closeInfo();
    extra.innerHTML = '[vairāk informācija]';
  } else if (currentArtwork?.long_description) {
    touch.disabled = true;
    touch.forward = touch.backward = touch.rotateLeft = touch.rotateRight = false;
    
    const marqueeText = ` ${currentArtwork.description || ''} -- ${currentArtwork.type || ''} -- ${currentArtwork.year || ''} --`;
    const repetitions = touch.isMobile ? 2 : 6;
    const mainImgData = currentArtwork.infoMainImage || (currentArtwork.texture ? { src: currentArtwork.texture, alt: currentArtwork.name } : null);
    const artworkImg = mainImgData ? `<img src="${mainImgData.src}" alt="${mainImgData.alt || currentArtwork.name || 'Artwork'}">` : '';
    const additionalImgs = (currentArtwork.infoImages || [])
      .map(img => `<img src="${img.src}" alt="${img.alt || currentArtwork.name || 'Artwork'}">`)
      .join('');
    const formattedDescription = currentArtwork.long_description.replace(/\n/g, '<br>');
    
    info.innerHTML = `
      <div class="info-marquee">
        <div class="marquee-content">${marqueeText.repeat(repetitions)}</div>
      </div>
      <div class="info-content" style="margin-top: 30px;">${formattedDescription}</div>
      ${artworkImg || additionalImgs ? `<div class="info-artwork">${artworkImg}${additionalImgs}</div>` : ''}
    `;
    
    infoPanelOpen = true;
    extra.innerHTML = '[mazāk informācija]';
    info.classList.add('active');
  }
});
update();