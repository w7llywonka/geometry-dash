// Original, replaceable offline courses. Positions are in the engine's 960 × 540 world.
// Coins, orbs, saws, and start positions use centers; other objects use top-left coordinates.
export const MODES = ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider', 'swing'];
export const DIFFICULTIES = ['Easy', 'Normal', 'Hard', 'Harder', 'Insane', 'Demon'];
export const OBJECT_TYPES = ['spike', 'block', 'slope', 'saw', 'coin', 'pad', 'orb', 'portal', 'checkpoint', 'trigger', 'startpos', 'decoration', 'text'];
export const EFFECT_VALUES = ['yellow', 'pink', 'red', 'blue', 'green', 'black', 'dash', 'gravity-dash', 'spider', 'teleport', 'trigger'];
export const TRIGGER_ACTIONS = ['move', 'rotate', 'color', 'alpha', 'toggle', 'spawn', 'pickup', 'follow', 'gravity', 'camera', 'sfx', 'stop-sfx', 'end', 'pulse'];
export const EASING_VALUES = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'bounce', 'elastic'];
export const PORTAL_VALUES = [...MODES, 'jetpack', 'mini', 'normal', 'gravity', 'gravity:normal', 'gravity:reverse', 'gravity:toggle', 'dual', 'dual:on', 'dual:off', 'mirror:on', 'mirror:off', 'direction:left', 'direction:right', 'direction:toggle', 'speed:slow', 'speed:normal', 'speed:fast', 'speed:faster', 'speed:fastest', 'speed:220', 'speed:300', 'speed:380', 'speed:460', 'teleport'];

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

// These original courses double as editable examples of the local object/trigger system.
export const LAB_LEVELS = [
  course('lab-signal-foundry', 'Signal Foundry', 'Groups, motion, colors, and a little backstage magic.', 'Normal', '#ac91ff', 128, 285, 4500, [
    { type: 'text', x: 650, y: 200, text: 'THE SIGNAL IS ALIVE', w: 300, h: 40, color: '#c9a7ff', fontSize: 24, groups: [10] },
    { type: 'decoration', x: 1030, y: 160, w: 64, h: 64, value: 'diamond', groups: [10], color: '#a991ff' },
    { type: 'trigger', x: 680, y: 400, action: 'color', colorTarget: 'background', color: '#251844', duration: 1.5 },
    { type: 'trigger', x: 900, y: 400, action: 'move', targetGroup: 10, moveX: 160, moveY: 0, duration: 2, easing: 'ease-in-out' },
    spike(1180), coin(1240, 335), { type: 'trigger', x: 1500, y: 400, action: 'rotate', targetGroup: 10, rotation: 180, duration: 2 },
    { type: 'startpos', x: 1650, y: 464, mode: 'cube', gravity: 1, mini: false, dual: false, speed: 285 },
    { type: 'decoration', x: 2120, y: 190, w: 96, h: 96, value: 'circle', groups: [20], color: '#75ddbf' },
    { type: 'trigger', x: 1830, y: 400, action: 'alpha', targetGroup: 20, opacity: 0.25, duration: 1 },
    { type: 'trigger', x: 2250, y: 400, action: 'pulse', targetGroup: 20, color: '#ffbbdf', duration: 1.2 },
    spike(2480, 2), coin(2540, 335), { type: 'trigger', x: 2800, y: 400, action: 'spawn', spawnGroup: 30, delay: 0.15 },
    { type: 'trigger', x: 2800, y: 350, action: 'color', colorTarget: 'ground', color: '#6bcfbc', duration: 0.8, groups: [30], spawnTriggered: true },
    { type: 'trigger', x: 3100, y: 400, action: 'camera', zoom: 1.08, duration: 1, easing: 'ease-in-out' },
    spike(3520), coin(3580, 335), { type: 'trigger', x: 3880, y: 400, action: 'camera', zoom: 1, duration: 1 },
  ]),
  course('lab-ramp-garden', 'Ramp Garden', 'Slopes, checkpoints, and a jetpack above the garden.', 'Hard', '#76dfc5', 120, 220, 2900, [
    { type: 'text', x: 650, y: 180, text: 'CLIMB · COLLECT · FLY', w: 320, h: 40, color: '#8be6c8', fontSize: 23 },
    { type: 'slope', x: 820, y: 384, w: 192, h: 96, value: 'up' }, block(1012, 384, 96),
    coin(1060, 335), { type: 'slope', x: 1108, y: 384, w: 192, h: 96, value: 'down' },
    { type: 'checkpoint', x: 1390, y: 400, w: 32, h: 80 }, { type: 'saw', x: 1630, y: 450, w: 42, h: 42, radius: 21 },
    { type: 'portal', x: 1890, y: 120, w: 32, h: 320, value: 'jetpack' }, coin(2070, 290),
    block(2200, 408, 96, 72), { type: 'decoration', x: 2420, y: 220, w: 100, h: 100, value: 'diamond', color: '#88dfbd', rotation: 45 },
    coin(2580, 240), { type: 'startpos', x: 1950, y: 320, mode: 'jetpack', speed: 220, gravity: 1, mini: false, dual: false },
  ], true),
  course('lab-warp-studio', 'Warp Studio', 'Explicit gravity, linked space, and safe changes of pace.', 'Hard', '#ffb5d7', 132, 300, 4800, [
    { type: 'text', x: 660, y: 220, text: 'KEEP AN OPEN MIND', w: 300, h: 40, color: '#ffb5d7', fontSize: 22 },
    portal(920, 'gravity:reverse'), coin(1290, 145), spike(1620, 2, 80), portal(2040, 'gravity:normal'),
    { type: 'portal', x: 2490, y: 120, w: 32, h: 320, value: 'teleport', targetX: 2820, targetY: 464 },
    coin(3040, 400), portal(3330, 'speed:fast'), spike(3720, 2), coin(3790, 335), portal(4200, 'speed:normal'),
    { type: 'startpos', x: 2820, y: 464, mode: 'cube', speed: 300, gravity: 1, mini: false, dual: false },
  ]),
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

function enumValue(value, choices, fallback, field) {
  if (value === undefined || value === null || value === '') return fallback;
  if (!choices.includes(value)) throw new Error(`${field} has an unsupported value.`);
  return value;
}

function integer(value, field, min = 1, max = 99999) {
  const result = boundedNumber(value, null, min, max, field);
  if (result === null || !Number.isInteger(result)) throw new Error(`${field} must be a whole number between ${min} and ${max}.`);
  return result;
}

function booleanValue(value, field) {
  if (typeof value !== 'boolean') throw new Error(`${field} must be true or false.`);
  return value;
}

function normalizedId(value) {
  return safeText(value, '', 100).replace(/[^a-zA-Z0-9_-]/g, '-');
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
    const defaults = { spike: [32, 32], block: [48, 48], slope: [96, 48], saw: [48, 48], coin: [24, 24], pad: [40, 6], orb: [32, 32], portal: [32, 320], checkpoint: [32, 80], trigger: [32, 32], startpos: [32, 32], decoration: [48, 48], text: [192, 40] }[type];
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
      if (PORTAL_VALUES.includes(object.value)) result.value = object.value;
      else if (/^speed:\d+(?:\.\d+)?$/.test(object.value)) result.value = `speed:${boundedNumber(object.value.slice(6), 300, 100, 650, 'Portal speed')}`;
      else throw new Error(`Portal ${index + 1} has an unsupported effect.`);
    } else if (type === 'spike' || type === 'slope') result.value = enumValue(object.value, ['up', 'down'], 'up', `${type} orientation`);
    else if (type === 'pad' || type === 'orb') result.value = enumValue(object.value, EFFECT_VALUES, 'yellow', `${type} effect`);
    if (object.groups !== undefined) {
      if (!Array.isArray(object.groups) || object.groups.length > 64) throw new Error(`Object ${index + 1} needs an array of at most 64 group IDs.`);
      result.groups = [...new Set(object.groups.map((group) => integer(group, 'Group ID')))];
    }
    for (const field of ['active', 'visible', 'preserveVelocity']) if (object[field] !== undefined) result[field] = booleanValue(object[field], field);
    if (object.targetPlayer !== undefined) result.targetPlayer = enumValue(object.targetPlayer, ['one', 'two', 'both'], 'both', 'Target player');
    if (object.targetId !== undefined && object.targetId !== '') {
      if (typeof object.targetId !== 'string') throw new Error('Target object ID must be text.');
      result.targetId = normalizedId(object.targetId);
    }
    for (const field of ['targetGroup', 'centerGroup']) if (object[field] !== undefined && object[field] !== '') result[field] = integer(object[field], field);
    const numbers = {
      targetX: [0, length], targetY: [0, 480], angle: [-3600, 3600], rotation: [-3600, 3600], opacity: [0, 1], z: [-100, 100], radius: [1, 1000],
      duration: [0, 120], delay: [0, 120], moveX: [-40000, 40000], moveY: [-480, 480], centerX: [-40000, 40000], centerY: [-480, 960],
      count: [-1000000, 1000000], targetCount: [-1000000, 1000000], zoom: [0.25, 4], cameraX: [-40000, 40000], cameraY: [-480, 960], cameraRotation: [-3600, 3600],
      staticX: [-40000, 40000], staticY: [-480, 960], volume: [0, 1], dashDuration: [0.05, 10], fontSize: [8, 96],
    };
    for (const [field, [min, max]] of Object.entries(numbers)) if (object[field] !== undefined && object[field] !== '') {
      if (object[field] === null || typeof object[field] === 'boolean' || typeof object[field] === 'object') throw new Error(`${field} must be a number.`);
      result[field] = boundedNumber(object[field], null, min, max, field);
    }
    if (object.color !== undefined && object.color !== '') {
      if (typeof object.color !== 'string' || !/^#[\da-fA-F]{6}$/.test(object.color)) throw new Error('Object color must be a six-digit hex color.');
      result.color = object.color;
    }
    if (type === 'text') result.text = safeText(object.text, 'Your message', 240);
    if (type === 'decoration') result.value = enumValue(object.value, ['square', 'circle', 'diamond', 'line'], 'diamond', 'Decoration shape');
    if (type === 'startpos') {
      result.mode = enumValue(object.mode, [...MODES, 'jetpack'], 'cube', 'Start mode');
      result.mini = object.mini === undefined ? false : booleanValue(object.mini, 'Mini mode');
      result.gravity = enumValue(object.gravity, [1, -1, 'normal', 'reverse'], 1, 'Start gravity');
      result.speed = boundedNumber(object.speed, 300, 100, 650, 'Start speed');
      result.dual = object.dual === undefined ? false : booleanValue(object.dual, 'Dual mode');
      if (object.direction !== undefined) result.direction = enumValue(object.direction, [1, -1, 'left', 'right'], 1, 'Start direction');
    }
    if (type === 'trigger' || (['orb', 'pad'].includes(type) && result.value === 'trigger')) {
      result.action = enumValue(object.action ?? (type === 'trigger' ? object.value : undefined), TRIGGER_ACTIONS, type === 'trigger' ? 'move' : 'spawn', 'Trigger action');
      result.duration = boundedNumber(object.duration, 0, 0, 120, 'Trigger duration');
      result.delay = boundedNumber(object.delay, 0, 0, 120, 'Trigger delay');
      const aliases = { easeIn: 'ease-in', easeOut: 'ease-out', easeInOut: 'ease-in-out' };
      result.easing = enumValue(aliases[object.easing] || object.easing, EASING_VALUES, 'linear', 'Easing');
      for (const field of ['enabled', 'spawnTriggered', 'spawnOnly', 'touchTriggered', 'once', 'followX', 'followY']) if (object[field] !== undefined) result[field] = booleanValue(object[field], field);
      if (object.spawnGroup !== undefined && object.spawnGroup !== '') result.spawnGroup = integer(object.spawnGroup, 'Spawn group');
      if (object.counterId !== undefined && object.counterId !== '') result.counterId = integer(object.counterId, 'Counter ID');
      if (object.operation !== undefined) result.operation = enumValue(object.operation, ['add', 'set', 'multiply', 'divide'], 'add', 'Counter operation');
      if (result.operation === 'divide' && result.count === 0) throw new Error('A pickup counter cannot divide by zero.');
      if (object.followPlayer !== undefined) result.followPlayer = enumValue(object.followPlayer, ['one', 'two'], 'one', 'Follow player');
      if (object.gravityValue !== undefined) result.gravityValue = enumValue(object.gravityValue, [1, -1, 'normal', 'reverse', 'toggle'], 'toggle', 'Gravity effect');
      if (object.colorTarget !== undefined) result.colorTarget = enumValue(object.colorTarget, ['background', 'ground', 'group'], 'background', 'Color target');
      if (object.soundId !== undefined) result.soundId = normalizedId(object.soundId);
      for (const field of ['channel', 'soundChannel']) if (object[field] !== undefined && object[field] !== '') {
        if (typeof object[field] === 'number') result[field] = integer(object[field], 'Sound channel');
        else if (typeof object[field] === 'string') result[field] = normalizedId(object[field]);
        else throw new Error('Sound channel must be text or a positive integer.');
      }
    }
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
