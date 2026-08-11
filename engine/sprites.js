const PLAYER_START_X = 3.5;
const PLAYER_START_Y = 1;
const SPRITE_PUSH_DISTANCE = 2;

const moveSpriteAwayFromPlayer = sprite => {
  const dx = sprite.x - PLAYER_START_X;
  const dy = sprite.y - PLAYER_START_Y;
  const distance = Math.hypot(dx, dy);

  // If a sprite is on/near the player, bias the push downward to keep it reachable.
  const dirX = distance > 0.0001 ? dx / distance : 0;
  const dirY = distance > 0.0001 ? dy / distance : 1;

  const movedX = sprite.x + dirX * SPRITE_PUSH_DISTANCE;
  const movedY = sprite.y + dirY * SPRITE_PUSH_DISTANCE;

  return {
    ...sprite,
    x: movedX,
    y: movedY
  };
};

const BASE_SPRITES = [
  {
    id: 'A',
    x: 0,
    y: 0,
    texture: '',
    size: 0.3,
    heightScale: 1.0,
    screenSize: true,
    long_description: 'čau,\n\nEs esmu Kočāns Miķelis, Latvijas Mākslas akadēmijas grafikas dizaina students. Esiet sveicināti manā dizaina portfolio! Man patīk veidot afišas un ņemties ar tipografiku, bet esmu gatavs darīt visu apkārt dizainam! Vienmēr pievēršu īpašu uzmanību detaļām un ar dizainu mēģinu risināt problēmas.',
    long_description_en: 'hi,\n\nI am Kočāns Miķelis (Mike), and I study graphic design at the Art Academy of Latvia. Welcome to my design portfolio! I enjoy creating posters and working with typography, but I am ready to work on anything around design. I always pay close attention to details and try to solve problems with design.',
    m_long_description: 'čau,\n\nEs esmu Kočāns Miķelis, Latvijas Mākslas akadēmijas grafikas dizaina students. Esiet sveicināti manā dizaina portfolio! Man patīk veidot afišas un ņemties ar tipografiku, bet esmu gatavs darīt visu apkārt dizainam! Vienmēr pievēršu īpašu uzmanību detaļām un ar dizainu mēģinu risināt problēmas.',
    m_long_description_en: 'hi,\n\nI am Kočāns Miķelis (Mike), and I study graphic design at the Art Academy of Latvia. Welcome to my design portfolio! I enjoy creating posters and working with typography, but I am ready to work on anything around design. I always pay close attention to details and try to solve problems with design.',
  
  },

  {
    id: 'B',
    x: 3.5,
    y: 2,
    texture: 'textures/putraimi.png',
    size: 0.5,
    childProximityRadius: 2.2,
    childFadeRange: 0.8,
    childFadeDuration: 220,
    name: 'Putraimi: Neo-šlāgeru kopums vol.2',
    description: 'Albuma vizuālā identitāte. 2026.',
    description_en: 'Album visual identity. 2026.',
    childSprites: [
      { xOffset: -0.10, yOffset: -0.05, texture: 'textures/chibas.png', size: 0.18, heightScale: 0.1 },
      { xOffset: 0.10, yOffset: -0.05, texture: 'textures/ceturta.png', size: 0.18, heightScale: -0.1 },
      { xOffset: -0.10, yOffset: 0.01, texture: 'textures/disc (1).jpg', size: 0.28, heightScale: -0.1 },
      { xOffset: 0.10, yOffset: -0.02, texture: 'textures/disc (2).jpg', size: 0.38, heightScale: 0.1 },
      { xOffset: 0.10, yOffset: 0, texture: 'textures/putraimi_disc.png', size: 0.28, heightScale: 0 },
      { xOffset: -0.10, yOffset: -0.02, texture: 'textures/disc (3).jpg', size: 0.28, heightScale: 0 },
      { xOffset: 0, yOffset: 0.06, texture: 'textures/disc (4).jpg', size: 0.35, heightScale: 0 },
    ],
    long_description: 'Albuma autori: Kočāns Miķelis, Biezenīts. Eklektiskā albuma vizuālā identitāte vieno dziesmu pūru ar šīs mākslas pašu pamatu - disks, krekls, papīra lapa, vai kāda ikdienas iedvesma - tukšais laukums, kur idejas sāk tapt. Noformējums šādi svin manu radošo procesu, tāpēc visai albuma atribūtikai piemīt rokdarbu sajūta. Dizainu vieno viegli uztveramā vizuālā valoda ar atpazīstamo putraimu krāsu shēmu.',
    long_description_en: "Album authors: Kočāns Miķelis, Biezenīts. The visual identity of this eclectic album centers around the foundation of art - a disc, shirt, sheet of paper, or even inspiration - the empty space where ideas are born. This is how the design celebrates my creative process. It is why the album's merchandise has a handcrafted feel. This design is united by concise visual language and an easily recognizable grain color scheme."
  },

  {
    id: 'C',
    x: 4,
    y: 1.5,
    texture: 'textures/disc (5).png',
    size: 0.5,
    childProximityRadius: 2.2,
    childFadeRange: 0.8,
    childFadeDuration: 220,
    name: 'Putraimu grāmata',
    name_en: 'Putraimi book',
    description: 'Blakus izdevums albumam. 2026.',
    description_en: 'Publication for the album. 2026.',
    childSprites: [
      { xOffset: 0.10, yOffset: 0, texture: 'textures/pbook_1.png', size: 0.3, heightScale: 0 },
      { xOffset: -0.10, yOffset: 0, texture: 'textures/pbook_3.png', size: 0.3, heightScale: 0 },
      { xOffset: 0, yOffset: 0.1, texture: 'textures/pbook_2.png', size: 0.5, heightScale: 0 },
    ],
    long_description: "Daļa no Latvijas Mākslas akadēmijas Datorprogrammu studijām, pasniedzēja Līga Dubrovska. Izdevuma mērķis ir attēlot paveikto darbu fizikālā mērvienībā. Iekļauti komentāri par mūzikas industriju un to kā paveiktais darbs netiek īpaši labi atalgots. Darbs tiek uzskatīts kā ‘putraimi’ - nopērkams liela kvantitātē par mazu cenu.",
    long_description_en: "Part of an assignment for computer studies in the Art Academy of Latvia, mentored by Līga Dubrovska. The goal was to depict album creation as a physical unit of measurement. It has commentary on the music industry and how artists do not get compensated justly. The effort of album creation is depicted as grain, which you purchase for cheap in large quantities."
  },

  {
    id: 'D',
    x: 2.5,
    y: 4.0,
    texture: 'textures/luize_2.png',
    size: 0.5,
    childProximityRadius: 2.2,
    childFadeRange: 0.8,
    childFadeDuration: 220,

    name: 'Tipogrāfiskas afišas',
    name_en: 'Typographic posters',
    description: 'Luīze Kate Alsiņa - plakātu sērija. 2026.',
    description_en: 'Luīze Kate Alsiņa - poster series. 2026.',
    childSprites: [
      { xOffset: 0.10, yOffset: 0, texture: 'textures/luize_1.png', size: 0.3, heightScale: 0 },
      { xOffset: -0.10, yOffset: 0, texture: 'textures/luize_3.png', size: 0.3, heightScale: 0 },
    ],
    long_description: "Daļa no Latvijas Mākslas akadēmijas tipografikas studijām, pasniedzējs Ivs Zenne. Izveides nosacījumi bija izveidot kāda kursabiedra tipografikā balstītu plakātu sēriju.",
    long_description_en: "Part of an assignment for typography studies in the Art Academy of Latvia, mentored by Ivs Zenne. The task was to create typography-driven posters based on a fellow student."
  },

  {
    id: 'E',
    x: 4.5,
    y: 4.0,
    texture: 'textures/spuldze25_insta_1.png',
    size: 0.5,
    childProximityRadius: 2.2,
    childFadeRange: 0.8,
    childFadeDuration: 220,

    name: 'SPULDZE',
    description: 'Vizuālā identitāte skolēnu pašpārvalžu forumam. 2023-2025.',
    description_en: 'Visual identity for a school council forum. 2023-2025.',
    childSprites: [
      { xOffset: -0.10, yOffset: -0.05, texture: 'textures/spuldze25_insta_2.png', size: 0.28, heightScale: 0.1 },
      { xOffset: 0.10, yOffset: -0.05, texture: 'textures/spuldze_25_balle_insta.png', size: 0.28, heightScale: -0.1 },
      { xOffset: -0.10, yOffset: 0.01, texture: 'textures/spuldze25_2.png', size: 0.28, heightScale: -0.1 },
      { xOffset: 0, yOffset: 0.04, texture: 'textures/spuldze24_1.png', size: 0.38, heightScale: 0},
      { xOffset: 0.10, yOffset: 0.05, texture: 'textures/spuldze24_2.png', size: 0.38, heightScale: 0.1 },
      { xOffset: -0.10, yOffset: 0.05, texture: 'textures/spuris.png', size: 0.28, heightScale: -0.1 },
      { xOffset: 0, yOffset: 0.07, texture: 'textures/spuldze_2023.png', size: 0.5, heightScale: 0 },
    ],
    long_description: "SPULDZE ir ikgadējs Cēsu Valsts ģimnāzijas Skolēnu pašpārvalžu saliedēšanās pasākums, kura mērķis ir satikties ar citām pašpārvaldēm un pārrunāt aktualitātes un notikumus.",
    long_description_en: "SPULDZE is an annual Cēsis State gymnasium student council event. The event cultivates Latvian student council experience exchange."
  },

  {
    id: 'F',
    x: 2,
    y: 6.5,
    texture: 'textures/kakitis.png',
    size: 0.5,
    childProximityRadius: 2.2,
    childFadeRange: 0.8,
    childFadeDuration: 220,

    name: 'Cēsu Alus etiķešu maketi',
    name_en: 'Cēsu Alus product design mock-ups',
    description: 'Konceptuāli dizaina pieteikumi jaunai produkcijai. 2024.',
    description_en: 'Design concepts for new products. 2024.',
    childSprites: [
      { xOffset: 0.10, yOffset: 0, texture: 'textures/14_premium.png', size: 0.3, heightScale: 0 },
      { xOffset: -0.10, yOffset: 0, texture: 'textures/capybara.png', size: 0.25, heightScale: -0.02 },
      { xOffset: 0, yOffset: 0.2, texture: 'textures/summer.png', size: 0.5, heightScale: 0.05},
    ],
    long_description: "Dizainu maketi veidoti saskaņā ar Cēsu Alus darbinieku inovāciju dienām.",
    long_description_en: "Product concept-art created for the Cēsu Alus internal innovation competition."
  },

  {
    id: 'G',
    x: 3,
    y: 1.5,
    texture: 'textures/sphongiun.png',
    size: 0.5,
    childProximityRadius: 2.2,
    childFadeRange: 0.8,
    childFadeDuration: 220,

    name: 'Sphongiun Display burtveidols',
    name_en: 'Sphongiun Display typeface',
    description: 'Displeja burtveidols izveidots ar analogiem paņēmieniem. 2025.',
    description_en: 'Display typeface created using analog techniques. 2025.',
    childSprites: [
      { xOffset: 0.10, yOffset: -0.05, texture: 'textures/sphongiun_2.png', size: 0.3, heightScale: 0 },
      { xOffset: -0.10, yOffset: -0.05, texture: 'textures/sphongiun_4.png', size: 0.3, heightScale: 0 },
      { xOffset: 0, yOffset: 0.1, texture: 'textures/sphongiun_3.png', size: 0.4, heightScale: 0 },
    ],
    long_description: "Daļa no Latvijas Mākslas akadēmijas tipografikas studijām, pasniedzējs Ivs Zenne. Sphongiun Display ir burtveidols piemērots virsrakstiem lielgabarīta izmēros. Tas veidots izgrebjot un plūkājot simbolus virtuves sūkļos, tālāk izmantojot tos kā akrila zīmogus.",
    long_description_en: "Part of an assignment for typography studies in the Art Academy of Latvia, mentored by Ivs Zenne. Sphongiun Display is a font best used in large sizes. It's made by carving and plucking out symbols in kitchen sponges and then used as acrylic stamps."
  },

  {
    id: 'H',
    x: 5.0,
    y: 6.5,
    texture: 'textures/kocans_ilustracija_1.jpg',
    size: 0.5,
    childProximityRadius: 2.2,
    childFadeRange: 0.8,
    childFadeDuration: 220,

    name: 'NEESAM VIENALDZĪGI!',
    name_en: 'DO NOT BE INDIFFERENT!',
    description: 'Ilustratīvu plakātu sērija. 2025.',
    description_en: 'Illustrative poster collection. 2025.',
    childSprites: [
      { xOffset: 0.10, yOffset: 0, texture: 'textures/kocans_ilustracija_2.jpg', size: 0.3, heightScale: 0 },
    ],
    long_description: "Daļa no Latvijas Mākslas akadēmijas grafikas dizaina studijām, pasniedzēja Ella Mežule. Ilustrācijas iegūtas visaptverošā radošā procesā, ņemot kursabiedru 'aklos' portretu skices kā pamatu.",
    long_description_en: "Part of an assignment for graphic design studies in the Art Academy of Latvia, mentored by Ella Mežule. The illustrations were created with a comprehensive creative process, using students 'blind' portrait sketches as a base."
  },

].map(moveSpriteAwayFromPlayer);

const MIRROR_ANCHOR_Y = PLAYER_START_Y;
const MIRROR_CLOSE_STEPS = 4;
const MIN_MIRROR_BEHIND_DISTANCE = 0.2;

const createMirroredSprite = sprite => {
  // Keep mirrored copies behind the player but pull them 4 map units closer.
  // Example: original distance 7 -> mirrored distance 3 from anchor line.
  // Very near sprites stay slightly behind to avoid crossing in front of player.
  const mirroredDistance = Math.max(
    MIN_MIRROR_BEHIND_DISTANCE,
    Math.abs(sprite.y - MIRROR_ANCHOR_Y) - MIRROR_CLOSE_STEPS
  );

  return {
    ...sprite,
    id: `${sprite.id}__mirror`,
    y: MIRROR_ANCHOR_Y - mirroredDistance,
    childSprites: Array.isArray(sprite.childSprites)
      ? sprite.childSprites.map(child => ({ ...child }))
      : sprite.childSprites,
    _mirrored: true
  };
};

const MIRRORED_SPRITES = BASE_SPRITES.map(createMirroredSprite);

export const SPRITES = [...BASE_SPRITES, ...MIRRORED_SPRITES];

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
  const childDistanceScale = parent.childDistanceScale ?? 1;
  const frontDistance = (t.frontDistance ?? (0.35 + (t.yOffset ?? 0))) * childDistanceScale;
  const sideOffset = (t.sideOffset ?? (t.xOffset ?? 0)) * childDistanceScale;

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
      _value: 1,
      _from: 1,
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
