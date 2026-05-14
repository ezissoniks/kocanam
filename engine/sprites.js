const BASE_SPRITES = [
  {
    id: 'A',
    x: 3.5,
    y: 0.8,
    texture: '',
    size: 0.3,
    heightScale: 1.0,
    screenSize: true
  },

  {
    id: 'B',
    x: 2.5,
    y: 0.8,
    texture: 'textures/putraimi.png',
    size: 0.5,
    childProximityRadius: 2.2,
    childFadeRange: 0.8,
    childFadeDuration: 220,
    name: 'Putraimi: Neo-šlāgeru kopums vol.2',
    description: 'Albuma vizuālā identitāte. 2026.',
    childSprites: [
      { xOffset: -0.10, yOffset: -0.05, texture: 'textures/chibas.png', size: 0.18, heightScale: 0.1 },
      { xOffset: 0.10, yOffset: -0.05, texture: 'textures/ceturta.png', size: 0.18, heightScale: -0.1 },
      { xOffset: -0.10, yOffset: 0.01, texture: 'textures/disc (1).jpg', size: 0.28, heightScale: -0.1 },
      { xOffset: 0.10, yOffset: -0.02, texture: 'textures/disc (2).jpg', size: 0.38, heightScale: 0.1 },
      { xOffset: 0.10, yOffset: -0.02, texture: 'textures/putraimi_disc.png', size: 0.28, heightScale: 0 },
      { xOffset: -0.10, yOffset: -0.02, texture: 'textures/disc (3).jpg', size: 0.28, heightScale: 0 },
      { xOffset: 0, yOffset: 0.06, texture: 'textures/disc (4).jpg', size: 0.35, heightScale: 0 },
    ],
    long_description: ''
  },

    {
    id: 'C',
    x: 4.5,
    y: 0.8,
    texture: 'textures/lma_mode_1.png',
    size: 0.5,
    childProximityRadius: 2.2,
    childFadeRange: 0.8,
    childFadeDuration: 220,

    name: 'Latvijas Mākslas akadēmijas Modes skate 2026',
    description: 'Latvijas mākslas akadēmijas pasākuma vizuālās identitātes pieteikums. 2026.',
    childSprites: [
      { xOffset: -0.10, yOffset: -0.05, texture: 'textures/lma_mode_poster.png', size: 0.18, heightScale: 0.1 },
      { xOffset: 0.10, yOffset: -0.05, texture: 'textures/lma_mode (2).png', size: 0.18, heightScale: -0.1 },
      { xOffset: 0, yOffset: 0.06, size: 0.35, heightScale: 0, frames: [
        'textures/Asset 1@4x.png',
        'textures/Asset 3@4x.png',
        'textures/Asset 4@4x.png',
        'textures/Asset 5@4x.png',
        'textures/Asset 6@4x.png',
        'textures/Asset 7@4x.png',
        'textures/Asset 8@4x.png',
        'textures/Asset 9@4x.png',
        'textures/Asset 10@4x.png',
        'textures/Asset 11@4x.png',
        'textures/Asset 12@4x.png',
        'textures/Asset 13@4x.png',
        'textures/Asset 14@4x.png',
      ] },
    ],
    long_description: ''
  },

  {
    id: 'D',
    x: 3.5,
    y: 2,
    texture: 'textures/luize_2.png',
    size: 0.5,
    childProximityRadius: 2.2,
    childFadeRange: 0.8,
    childFadeDuration: 220,

    name: 'Plakātu sērija. Luīze Kate Alsiņa.',
    description: 'Kāda kursabiedra tipografikā balstītu plakātu sērijas izveide. 2026.',
    childSprites: [
      { xOffset: 0.10, yOffset: 0, texture: 'textures/luize_1.png', size: 0.3, heightScale: 0 },
      { xOffset: -0.10, yOffset: 0, texture: 'textures/luize_3.png', size: 0.3, heightScale: 0 },
    ],  
  },

];

export const SPRITES = BASE_SPRITES.slice();

export const getSpriteById = id => SPRITES.find(s => s.id === id);
export const getAllSprites = () => SPRITES;

export function spawnChildSprites(parentId, playerX, playerY, maxVisible = 3) {
  const parent = getSpriteById(parentId);
  const templates = parent?.childSprites;
  if (!parent || !Array.isArray(templates) || templates.length === 0) return 0;

  let write = 0;
  for (let i = 0; i < SPRITES.length; i++) {
    const sprite = SPRITES[i];
    if (sprite._childOf === parentId && sprite._removeAfterFade) continue;
    SPRITES[write++] = sprite;
  }
  SPRITES.length = write;

  // Monotonic counter — never resets, always advances in order
  if (parent._nextChildIndex === undefined) parent._nextChildIndex = 0;
  if (parent._nextChildIndex >= templates.length) return 0;

  // Evict the oldest child if we're at the cap
  write = 0;
  let evicted = false;
  for (let i = 0; i < SPRITES.length; i++) {
    if (!evicted && SPRITES[i]._childOf === parentId) {
      // count how many children exist
      let count = 0;
      for (let j = i; j < SPRITES.length; j++) if (SPRITES[j]._childOf === parentId) count++;
      if (count >= maxVisible) { evicted = true; continue; } // skip (evict) this one
    }
    SPRITES[write++] = SPRITES[i];
  }
  SPRITES.length = write;

  const templateIndex = parent._nextChildIndex++;
  const t = templates[templateIndex];
  const toPlayerX = typeof playerX === 'number' ? playerX - parent.x : 0;
  const toPlayerY = typeof playerY === 'number' ? playerY - parent.y : 0;
  const toPlayerLen = Math.hypot(toPlayerX, toPlayerY) || 1;
  const forwardX = toPlayerX / toPlayerLen;
  const forwardY = toPlayerY / toPlayerLen;
  const sideX = -forwardY;
  const sideY = forwardX;
  const frontDistance = t.frontDistance ?? (0.35 + (t.yOffset ?? 0));
  const sideOffset = t.sideOffset ?? (t.xOffset ?? 0);

  SPRITES.push({
    ...t,
    id: `${parentId}__child_${templateIndex}`,
    x: parent.x + forwardX * frontDistance + sideX * sideOffset,
    y: parent.y + forwardY * frontDistance + sideY * sideOffset,
    interactive: false,
    _childOf: parentId,
    proximityOpacity: {
      radius: parent.childProximityRadius ?? 2.2,
      fadeRange: parent.childFadeRange ?? 0.8,
      duration: parent.childFadeDuration ?? 220,
      _value: 0,
      _from: 0,
      _target: 1,
      _start: performance.now()
    }
  });
  return 1;
}

export function clearChildSprites(parentId) {
  const parent = getSpriteById(parentId);
  if (parent) {
    parent._nextChildIndex = 0;
  }

  const now = performance.now();
  for (let i = 0; i < SPRITES.length; i++) {
    const sprite = SPRITES[i];
    if (sprite._childOf !== parentId) continue;
    sprite._removeAfterFade = true;
    if (sprite.proximityOpacity) {
      sprite.proximityOpacity._from = sprite.proximityOpacity._value ?? 1;
      sprite.proximityOpacity._target = 0;
      sprite.proximityOpacity._start = now;
    }
  }
}
