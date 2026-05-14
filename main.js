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
let [currentArtwork, previousArtwork] = [null, null];
let [typewriterIndex, typewriterText, typewriterTimeout] = [0, '', null];
let proximityTimeout = null;
let inactivityHintTimeout = null;

const showInactivityHint = () => {
  hud.innerHTML = touch.isMobile ? 'Kusties 🡰 🡱 🡲 🡳 ' : 'Kusties 🡰 🡱 🡲 🡳 ';
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
const sprites = getAllSprites();
if (window.innerWidth / window.innerHeight < 1) {
  for (const s of sprites) {
    s.size = Math.max(0.05, s.size - 0.3);
    if (s.childSprites) for (const c of s.childSprites) c.size = Math.max(0.05, c.size - 0.1);
  }
}
const clearTimer = timer => timer && clearTimeout(timer);
const checkProximity = (px, py, r, cosAngle, sinAngle) => {
  let closest = null, closestDistSq = Infinity;
  const rSq = r * r;
  for (const s of sprites) {
    if (s.interactive === false) continue;
    const dx = s.x - px, dy = s.y - py, distSq = dx * dx + dy * dy;
    if (distSq >= rSq || distSq >= closestDistSq || distSq === 0) continue;
    if ((dx * cosAngle + dy * sinAngle) / Math.sqrt(distSq) < COS_HALF_FOV) continue;
    closest = s; closestDistSq = distSq;
  }
  currentArtwork = closest;
};
const typeWriter = () => {
  if (typewriterIndex >= typewriterText.length) return;
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
  if (anyInput && (inactivityHintTimeout || hud.dataset.hint)) {
    clearInactivityHint();
    if (currentArtwork?.id === 'A') scheduleInactivityHint();
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
    if (previousArtwork?.id) clearChildSprites(previousArtwork.id);
    clearTimer(typewriterTimeout);
    typewriterTimeout = null;
    clearTimer(proximityTimeout);
    proximityTimeout = null;
    clearInactivityHint();
    hud.classList.add('hidden');
    gameLogo.classList.toggle('visible', currentArtwork?.id === 'A');
    if (currentArtwork?.id === 'A') setTimeout(scheduleInactivityHint, 500);
    
    setTimeout(() => {
      hud.innerHTML = '';
      typewriterText = '';
      typewriterIndex = 0;
    }, 500);

    if (currentArtwork?.name && currentArtwork?.description) {
      setTimeout(() => {
        typewriterText = `<strong>-- ${currentArtwork.name} --</strong><br><br>${currentArtwork.description}`;
        typewriterIndex = 0;
        hud.innerHTML = '';
        hud.classList.remove('hidden');
        typeWriter();
      }, 500);
    }
    previousArtwork = currentArtwork;
  }

  requestAnimationFrame(update);
};
canvas.addEventListener('pointerdown', () => {
  if (!currentArtwork?.id) return;
  spawnChildSprites(currentArtwork.id, player.x, player.y);
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