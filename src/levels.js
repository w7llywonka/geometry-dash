// Original, replaceable offline courses. Positions are in the engine's 960 × 540 world.
// Coins and orbs use center coordinates; every other object uses its top-left corner.
export const MODES = ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider', 'swing'];
export const DIFFICULTIES = ['Easy', 'Normal', 'Hard', 'Harder', 'Insane', 'Demon'];
export const OBJECT_TYPES = ['spike', 'block', 'coin', 'pad', 'orb', 'portal'];
export const PORTAL_VALUES = [...MODES, 'mini', 'normal', 'gravity', 'dual', 'speed:220', 'speed:300', 'speed:380', 'speed:460'];

const spike = (x, count = 1, y = 448) => Array.from({ length: count }, (_, i) => ({ type: 'spike', x: x + i * 32, y, w: 32, h: 32, ...(y === 80 ? { value: 'down' } : {}) }));
const block = (x, y = 384, w = 96, h = 480 - y) => ({ type: 'block', x, y, w, h });
const coin = (x, y = 342) => ({ type: 'coin', x, y, w: 24, h: 24 });
const orb = (x, y = 370, value = 'yellow') => ({ type: 'orb', x, y, w: 32, h: 32, value });
const pad = (x, value = 'yellow') => ({ type: 'pad', x, y: 474, w: 40, h: 6, value });
const portal = (x, value) => ({ type: 'portal', x, y: 120, w: 32, h: 320, value });

const course = (id, name, subtitle, difficulty, color, bpm, speed, length, objects, platformer = false) => ({
  id, name, subtitle, difficulty, color, bpm, speed, length, platformer,
  objects: objects.flat().map((object, index) => ({ ...object, id: `${id}-${index}` })).sort((a, b) => a.x - b.x),
});

// A flight lane gently alternates floor and ceiling obstacles, leaving a broad readable path.
function flightLane(start, count, step = 410, narrow = false) {
  return Array.from({ length: count }, (_, index) => {
    const x = start + index * step;
    return index % 2 === 0
      ? block(x, narrow ? 384 : 408, 80, narrow ? 96 : 72)
      : block(x, 80, 80, narrow ? 96 : 72);
  });
}

export const LEVELS = [
  course('first-light', 'First Light', 'Every great run starts with one jump.', 'Easy', '#55d9f0', 112, 285, 4500, [
    spike(760), spike(1140), coin(1190, 338), spike(1570), block(1960, 408, 96),
    spike(2410), spike(2800, 2), coin(2850, 335), block(3270, 408, 96), spike(3700), coin(3860, 410),
  ]),
  course('pulse-route', 'Pulse Route', 'Find the rhythm. Trust the launch.', 'Easy', '#b88aff', 120, 300, 4900, [
    spike(760), spike(1150, 2), coin(1200, 338), pad(1570), spike(1660, 3),
    block(2090, 408, 96), spike(2540, 2), orb(2600, 350), coin(2700, 265),
    spike(3010), pad(3390), spike(3480, 3), spike(4010, 2), coin(4080, 338),
  ]),
  course('neon-flight', 'Neon Flight', 'A little lift takes you a long way.', 'Normal', '#62e1a4', 126, 300, 5200, [
    spike(760), portal(1150, 'ship'), flightLane(1620, 6, 440),
    coin(1870, 265), coin(3150, 290), portal(4250, 'cube'), spike(4640), coin(4700, 338),
  ]),
  course('gravity-garden', 'Gravity Garden', 'The other side has a rhythm, too.', 'Normal', '#ffbd69', 128, 300, 5400, [
    spike(760, 2), portal(1200, 'ball'), spike(1630, 2), coin(1860, 165),
    spike(2100, 2, 80), spike(2620, 2), coin(2920, 375), spike(3170, 2, 80),
    spike(3710, 2), portal(4250, 'cube'), spike(4640, 2), coin(4710, 335),
  ]),
  course('sky-lantern', 'Sky Lantern', 'Tap a constellation into the sky.', 'Hard', '#ff87b7', 132, 310, 5800, [
    spike(780, 2), portal(1240, 'ufo'), flightLane(1710, 7, 420),
    coin(1950, 240), coin(3200, 290), coin(4480, 225), portal(4960, 'cube'), spike(5310, 2),
  ]),
  course('razor-tide', 'Razor Tide', 'Straight lines. Sharp turns. Clear focus.', 'Harder', '#73d7ff', 138, 310, 6000, [
    spike(780, 2), portal(1250, 'wave'), flightLane(1740, 8, 400, true),
    coin(1980, 250), coin(3300, 300), coin(4490, 235), portal(5140, 'cube'), spike(5500, 2),
  ]),
  course('iron-pulse', 'Iron Pulse', 'Hold your jump. Shape your arc.', 'Harder', '#ff986e', 142, 320, 6200, [
    spike(780, 2), portal(1210, 'robot'), block(1610, 384, 96), spike(2060, 2), coin(2110, 327),
    block(2550, 384, 96), pad(3030), spike(3130, 3), coin(3230, 285),
    block(3670, 384, 96), spike(4180, 2), orb(4250, 340), spike(4710, 2),
    portal(5210, 'cube'), spike(5570, 2), coin(5650, 335),
  ]),
  course('violet-shift', 'Violet Shift', 'Blink between worlds. Leave nothing behind.', 'Insane', '#c29bff', 146, 320, 6500, [
    spike(780, 2), portal(1230, 'spider'), spike(1690, 3), coin(1920, 155),
    spike(2180, 3, 80), spike(2690, 3), coin(2970, 390), spike(3230, 3, 80),
    spike(3770, 3), spike(4290, 3, 80), coin(4570, 390), portal(5120, 'cube'),
    spike(5550, 2), spike(6020, 2),
  ]),
  course('solar-swing', 'Solar Swing', 'Change your gravity. Keep your momentum.', 'Insane', '#fbd06e', 148, 325, 6800, [
    spike(780, 2), portal(1250, 'swing'), flightLane(1760, 9, 420, true),
    coin(1990, 250), coin(3580, 295), coin(4880, 250), portal(5720, 'cube'),
    spike(6110, 2), orb(6180, 340),
  ]),
  course('mirror-run', 'Mirror Run', 'Two icons. One perfect rhythm.', 'Insane', '#8b9cff', 152, 325, 7000, [
    spike(780, 2), portal(1270, 'dual'), spike(1730, 2), spike(1730, 2, 80),
    coin(1770, 340), spike(2280, 2), spike(2280, 2, 80),
    spike(2830, 2), spike(2830, 2, 80), coin(2880, 145),
    spike(3380, 2), spike(3380, 2, 80), portal(3850, 'dual'), portal(4140, 'ship'),
    flightLane(4630, 4, 410), coin(5200, 250), portal(6320, 'cube'),
  ]),
  course('overclock', 'Overclock', 'Read the change before the beat drops.', 'Demon', '#ff6e91', 160, 340, 7600, [
    spike(780, 2), portal(1220, 'ship'), flightLane(1710, 3, 370, true), coin(1990, 235),
    portal(2860, 'ball'), spike(3250, 2), spike(3690, 2, 80), coin(3920, 390),
    portal(4190, 'wave'), flightLane(4650, 4, 360, true), coin(5550, 230),
    portal(6170, 'cube'), portal(6430, 'speed:380'), spike(6820, 3), orb(6890, 335),
  ]),
  course('night-circuit', 'Night Circuit', 'Eight forms. One final signal.', 'Demon', '#f08bff', 168, 340, 9000, [
    spike(760, 2), portal(1140, 'ship'), flightLane(1510, 2, 370, true),
    portal(2150, 'ball'), spike(2520, 2), spike(2900, 2, 80), coin(3110, 385),
    portal(3340, 'ufo'), flightLane(3750, 2, 370, true), portal(4430, 'wave'),
    flightLane(4830, 2, 370, true), coin(5040, 240), portal(5500, 'robot'),
    block(5860, 384, 80), spike(6260, 2), portal(6690, 'spider'),
    spike(7050, 2), spike(7420, 2, 80), portal(7830, 'swing'),
    block(8230, 408, 80), coin(8440, 265),
  ]),
  course('little-summit', 'Little Summit', 'Take your time. Find your way up.', 'Normal', '#7ee8c5', 112, 220, 2600, [
    spike(680), block(970, 384, 96), block(1090, 288, 96), block(1210, 192, 144),
    coin(1260, 145), block(1440, 288, 144), coin(1520, 238), block(1690, 384, 144),
    spike(1940, 2), block(2230, 408, 96), coin(2290, 355),
  ], true),
  course('clockwork-vault', 'Clockwork Vault', 'Three coins hide above the obvious route.', 'Hard', '#eab6ff', 126, 220, 2900, [
    block(680, 384, 96), block(800, 288, 96), block(920, 192, 144), coin(985, 145),
    block(1160, 288, 144), spike(1430, 2), block(1720, 384, 96),
    block(1840, 288, 96), block(1960, 192, 144), coin(2020, 145),
    block(2200, 288, 144), block(2430, 384, 144), coin(2500, 335), spike(2690),
  ], true),
];

function boundedNumber(value, fallback, min, max, field) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${field} must be a number between ${min} and ${max}.`);
  }
  return Math.round(number * 100) / 100;
}

function safeText(value, fallback, maxLength) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength) || fallback : fallback;
}

/** Accepts a plain editor level or { version: 1, level }. Throws a readable Error for invalid data. */
export function normalizeLevel(input) {
  const raw = input?.level && typeof input.level === 'object' ? input.level : input;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Choose a JSON file containing a level object.');
  if (!Array.isArray(raw.objects)) throw new Error('This level is missing its objects array.');
  if (raw.objects.length > 5000) throw new Error('A level can contain at most 5,000 objects.');
  const length = boundedNumber(raw.length, 4800, 1000, 40000, 'Length');
  const id = safeText(raw.id, `local-${Date.now().toString(36)}`, 80).replace(/[^a-zA-Z0-9_-]/g, '-') || `local-${Date.now().toString(36)}`;
  const color = typeof raw.color === 'string' && /^#[\da-fA-F]{6}$/.test(raw.color) ? raw.color : '#b88aff';
  const usedIds = new Set();
  const objects = raw.objects.map((object, index) => {
    if (!object || typeof object !== 'object' || !OBJECT_TYPES.includes(object.type)) throw new Error(`Object ${index + 1} has an unsupported type.`);
    const type = object.type;
    const defaults = { spike: [32, 32], block: [48, 48], coin: [24, 24], pad: [40, 6], orb: [32, 32], portal: [32, 320] }[type];
    const x = boundedNumber(object.x, null, 0, length, `Object ${index + 1} X`);
    const y = boundedNumber(object.y, null, 0, 480, `Object ${index + 1} Y`);
    if (x === null || y === null) throw new Error(`Object ${index + 1} needs X and Y coordinates.`);
    const baseId = safeText(object.id, `${id}-object-${index}`, 100).replace(/[^a-zA-Z0-9_-]/g, '-');
    let objectId = baseId;
    let suffix = 1;
    while (usedIds.has(objectId)) objectId = `${baseId}-${index}-${suffix++}`;
    usedIds.add(objectId);
    const result = { id: objectId, type, x, y, w: boundedNumber(object.w, defaults[0], 1, 2000, `Object ${index + 1} width`), h: boundedNumber(object.h, defaults[1], 1, 480, `Object ${index + 1} height`) };
    if (type === 'portal') {
      if (typeof object.value !== 'string') throw new Error(`Portal ${index + 1} needs a mode or effect.`);
      if (MODES.includes(object.value) || ['mini', 'normal', 'gravity', 'dual'].includes(object.value)) result.value = object.value;
      else if (/^speed:\d+(?:\.\d+)?$/.test(object.value)) result.value = `speed:${boundedNumber(object.value.slice(6), 300, 100, 650, 'Portal speed')}`;
      else throw new Error(`Portal ${index + 1} has an unsupported effect.`);
    } else if (type === 'spike' && object.value === 'down') result.value = 'down';
    else if (type === 'pad' || type === 'orb') result.value = ['yellow', 'pink', 'red', 'blue', 'green', 'black'].includes(object.value) ? object.value : 'yellow';
    return result;
  }).sort((a, b) => a.x - b.x || a.y - b.y);
  return {
    id, name: safeText(raw.name, 'Untitled Signal', 60), subtitle: safeText(raw.subtitle, 'An original local level.', 140),
    difficulty: DIFFICULTIES.includes(raw.difficulty) ? raw.difficulty : 'Normal', color,
    bpm: boundedNumber(raw.bpm, 128, 60, 220, 'BPM'), speed: boundedNumber(raw.speed, 300, 100, 650, 'Speed'),
    length, platformer: raw.platformer === true, objects,
  };
}

export function createLevel() {
  return { id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, name: 'Untitled Signal', subtitle: 'An original local level.', difficulty: 'Normal', color: '#b88aff', bpm: 128, speed: 300, length: 4800, platformer: false, objects: [] };
}
