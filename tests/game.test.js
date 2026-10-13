import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, MODES, normalizeLevel, createLevel } from '../src/levels.js';
import { Store, STORAGE_KEY } from '../src/store.js';
import { GameEngine } from '../src/engine.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

function useStorage(t, storage = memoryStorage()) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  t.after(() => previous ? Object.defineProperty(globalThis, 'localStorage', previous) : delete globalThis.localStorage);
  return storage;
}

test('campaign courses validate, include all eight forms, and offer platformer play', () => {
  assert.ok(LEVELS.length >= 10);
  assert.equal(new Set(LEVELS.map(level => level.id)).size, LEVELS.length);
  const forms = new Set(['cube']);
  for (const level of LEVELS) {
    const normalized = normalizeLevel(level);
    assert.equal(normalized.id, level.id);
    assert.equal(normalized.objects.length, level.objects.length);
    assert.equal(new Set(normalized.objects.map(object => object.id)).size, normalized.objects.length);
    assert.equal(normalized.objects.filter(object => object.type === 'coin').length, 3);
    for (const object of normalized.objects) {
      if (object.type === 'portal' && MODES.includes(object.value)) forms.add(object.value);
    }
  }
  assert.deepEqual([...forms].sort(), [...MODES].sort());
  assert.ok(LEVELS.some(level => level.platformer));
});

test('editor JSON import rejects broken geometry and unsupported effects', () => {
  const level = createLevel();
  for (const objects of [
    [{ type: 'block', x: -1, y: 400 }],
    [{ type: 'block', x: 300, y: 400, w: 0 }],
    [{ type: 'block', x: 300, y: Infinity }],
    [{ type: 'block', y: 400 }],
    [{ type: 'script', x: 300, y: 400 }],
    [{ type: 'portal', x: 300, y: 120, value: 'speed:9999' }],
    [{ type: 'portal', x: 300, y: 120, value: 'unknown' }],
  ]) assert.throws(() => normalizeLevel({ ...level, objects }));
  assert.throws(() => normalizeLevel({ ...level, objects: Array(5001).fill({ type: 'coin', x: 100, y: 300 }) }));
});

test('editor JSON import creates independent sorted data with safe presentation fields', () => {
  const original = { ...createLevel(), name: '\u0000  Test course  ', color: 'url(javascript:alert(1))', objects: [
    { id: 'same', type: 'portal', x: 900, y: 120, value: 'ship' },
    { id: 'same', type: 'coin', x: 400, y: 300, extra: 'discard me' },
  ] };
  const imported = normalizeLevel({ version: 1, level: original });
  assert.equal(imported.name, 'Test course');
  assert.match(imported.color, /^#[0-9a-f]{6}$/i);
  assert.equal(imported.objects[0].x, 400);
  assert.equal(new Set(imported.objects.map(object => object.id)).size, 2);
  assert.equal(imported.objects[0].extra, undefined);
  imported.objects[0].x = 500;
  assert.equal(original.objects[1].x, 400);
});

test('practice finishes never grant normal completion, stars, or campaign coins', t => {
  useStorage(t);
  const store = new Store();
  const level = LEVELS[0];
  store.recordRun(level, { practice: true, percent: 100, attempts: 4, coins: ['a', 'b'], time: 15 });
  const progress = store.getProgress(level.id);
  assert.equal(progress.practiceBest, 100);
  assert.equal(progress.best, 0);
  assert.equal(progress.completed, false);
  assert.equal(progress.coins, 0);
  assert.equal(progress.bestTime, null);
  assert.equal(progress.attempts, 4);
  assert.equal(store.getSummary().stars, 0);
  assert.equal(store.getSummary().completed, 0);
  assert.ok(store.data.achievements.includes('practice-clear'));
  assert.ok(!store.data.achievements.includes('first-clear'));
});

test('normal scoring retains best run and accumulates distinct finish coins without stat double counting', t => {
  useStorage(t);
  const store = new Store();
  const level = LEVELS[0];
  store.recordRun(level, { percent: 74, attempts: 2, coins: ['lost'], time: 20 });
  assert.equal(store.getProgress(level.id).coins, 0);
  store.recordRun(level, { percent: 100, attempts: 1, coins: ['a', 'b'], time: 22 });
  store.recordRun(level, { percent: 100, attempts: 1, coins: ['b', 'c'], time: 19 });
  store.recordRun(level, { percent: 11, attempts: 1 });
  store.recordStats({ attempts: 5, totalAttempts: 5, jumps: 9, deaths: 3, playTime: 60 });
  assert.equal(store.getProgress(level.id).best, 100);
  assert.equal(store.getProgress(level.id).bestTime, 19);
  assert.equal(store.getProgress(level.id).coins, 3);
  assert.equal(store.getProgress(level.id).attempts, 5);
  assert.equal(store.getSummary().attempts, 5);
  assert.equal(store.getSummary().jumps, 9);
  assert.equal(store.getSummary().coins, 3);
  assert.equal(store.getSummary().completed, 1);
  assert.equal(store.getSummary().stars, 2);
});

test('profile round trip restores progress, preferences, cosmetics, and custom levels', t => {
  const storage = useStorage(t);
  const store = new Store();
  const custom = { ...createLevel(), id: 'local-roundtrip', name: 'Round trip' };
  store.saveLevel(custom);
  store.updateSettings({ music: false, volume: 0.25 });
  store.updateCosmetics({ primary: '#123456', icon: 4 });
  store.recordRun(LEVELS[0], { percent: 100, coins: ['coin-1'], time: 21 });
  const backup = store.exportData();
  assert.equal(storage.getItem(STORAGE_KEY), backup);
  const restored = new Store();
  assert.equal(restored.getProgress(LEVELS[0].id).completed, true);
  assert.equal(restored.data.customLevels[0].name, 'Round trip');
  assert.equal(restored.data.settings.music, false);
  assert.equal(restored.data.settings.volume, 0.25);
  assert.equal(restored.data.cosmetics.primary, '#123456');
  restored.reset();
  restored.importData(backup);
  assert.deepEqual(JSON.parse(restored.exportData()), JSON.parse(backup));
});

test('invalid and hostile profile imports preserve the current save atomically', t => {
  const storage = useStorage(t);
  const store = new Store();
  store.recordRun(LEVELS[0], { percent: 68 });
  const current = store.exportData();
  const invalid = [
    '{broken JSON',
    '{"version":999,"progress":{}}',
    '{"unrelated":true}',
    '{"progress":{},"customLevels":[{"id":"local-bad","objects":[{"type":"block","x":-50,"y":400}]}]}',
    '{"progress":{},"customLevels":[{"id":"local-proto","objects":[],"__proto__":{"polluted":true}}]}',
    JSON.stringify({ progress: {}, customLevels: [{ ...createLevel(), id: LEVELS[0].id }] }),
  ];
  for (const text of invalid) {
    assert.throws(() => store.importData(text));
    assert.equal(store.exportData(), current);
    assert.equal(storage.getItem(STORAGE_KEY), current);
  }
  assert.equal({}.polluted, undefined);
  assert.throws(() => store.saveLevel({ ...createLevel(), id: LEVELS[0].id }));
  assert.equal(store.getProgress(LEVELS[0].id).best, 68);
  assert.equal(store.data.customLevels.length, 0);
});

test('a platformer campaign finish unlocks its achievement while custom finishes earn no campaign rewards', t => {
  useStorage(t);
  const store = new Store();
  const level = LEVELS.find(level => level.platformer);
  store.recordRun(level, { percent: 100, coins: ['p1'], time: 30 });
  assert.equal(store.getProgress(level.id).mode, 'platformer');
  assert.ok(store.data.achievements.includes('platformer-clear'));
  const before = store.getSummary();
  const custom = { ...createLevel(), id: 'local-finish' };
  store.saveLevel(custom);
  store.recordRun(custom, { percent: 100, coins: ['c1', 'c2'], time: 5 });
  assert.equal(store.getProgress(custom.id).completed, true);
  assert.equal(store.getSummary().stars, before.stars);
  assert.equal(store.getSummary().coins, before.coins);
  assert.equal(store.getSummary().completed, before.completed);
});

test('blocked browser storage preserves a playable in-memory profile with a backup', t => {
  useStorage(t, { getItem() { throw new Error('Storage blocked'); }, setItem() { throw new Error('Quota exceeded'); } });
  const store = new Store();
  assert.match(store.storageError, /blocked/);
  store.recordRun(LEVELS[0], { percent: 50 });
  assert.equal(store.getProgress(LEVELS[0].id).best, 50);
  assert.match(store.storageError, /Quota/);
  assert.equal(JSON.parse(store.exportData()).progress[LEVELS[0].id].best, 50);
});

function startEngine(t, objects = [], options = {}, callbacks = {}) {
  const engine = new GameEngine(callbacks);
  engine.start({ id: 'test-course', length: 2000, speed: 300, objects }, { settings: { reducedMotion: true, autoCheckpoint: false }, ...options });
  t.after(() => engine.destroy());
  return engine;
}

const tick = engine => engine.step(1 / 120);

test('fixed physics advances identically across frame chunk sizes and pauses without progress', t => {
  const engine = startEngine(t);
  const reference = startEngine(t);
  engine.press(); reference.press();
  engine.step(0.25);
  for (let index = 0; index < 30; index++) tick(reference);
  engine.release(); reference.release();
  engine.step(0.75);
  for (let index = 0; index < 90; index++) tick(reference);
  assert.equal(engine.player.x, reference.player.x);
  assert.equal(engine.player.y, reference.player.y);
  assert.equal(engine.state.jumps, reference.state.jumps);
  assert.equal(engine.state.status, 'playing');
  engine.pause();
  const paused = { x: engine.player.x, y: engine.player.y, time: engine.state.time };
  engine.step(1);
  assert.deepEqual({ x: engine.player.x, y: engine.player.y, time: engine.state.time }, paused);
  engine.resume();
  engine.step(0.1);
  assert.ok(engine.player.x > paused.x);
});

test('a timely cube jump clears a spike, while a missed jump dies and automatically retries', t => {
  const spike = { id: 'spike', type: 'spike', x: 240, y: 448, w: 32, h: 32 };
  const missed = startEngine(t, [spike]);
  const jumped = startEngine(t, [spike]);
  jumped.step(0.1);
  jumped.press(); tick(jumped); jumped.release();
  jumped.step(1);
  assert.equal(jumped.state.status, 'playing');
  assert.equal(jumped.state.deaths, 0);
  assert.equal(jumped.state.jumps, 1);
  assert.ok(jumped.player.x > spike.x + spike.w + 16);
  missed.step(0.5);
  assert.equal(missed.state.status, 'dead');
  assert.equal(missed.state.deaths, 1);
  missed.step(0.4);
  assert.equal(missed.state.status, 'playing');
  assert.equal(missed.state.attempts, 2);
  assert.ok(missed.player.x < spike.x);
});

test('cube lands on block tops and platformer movement stops at walls and reverses', t => {
  const landing = startEngine(t, [{ id: 'platform', type: 'block', x: 220, y: 400, w: 100, h: 80 }]);
  landing.press(); tick(landing); landing.release();
  landing.step(0.65);
  assert.equal(landing.state.status, 'playing');
  assert.equal(landing.player.y, 384);
  assert.equal(landing.player.grounded, true);
  const platformer = startEngine(t, [{ id: 'wall', type: 'block', x: 200, y: 384, w: 64, h: 96 }], { platformer: true });
  platformer.step(0.5);
  assert.equal(platformer.player.x, 80);
  platformer.input.right = true;
  platformer.step(0.5);
  assert.equal(platformer.player.x, 184);
  assert.equal(platformer.state.deaths, 0);
  platformer.input.right = false;
  platformer.input.left = true;
  platformer.step(0.2);
  assert.ok(platformer.player.x < 184);
});

test('ball and spider taps flip gravity, with distinct flight and instant teleport behavior', t => {
  for (const mode of ['ball', 'spider']) {
    const engine = startEngine(t, [{ id: 'entry', type: 'portal', x: 80, y: 80, w: 32, h: 400, value: mode }]);
    engine.step(0.15);
    engine.press(); tick(engine); engine.release();
    assert.equal(engine.player.mode, mode);
    assert.equal(engine.player.gravity, -1);
    assert.equal(engine.state.jumps, 1);
    if (mode === 'spider') {
      assert.equal(engine.player.y, 96);
      assert.equal(engine.player.grounded, true);
    } else {
      assert.ok(engine.player.y > 96 && engine.player.y < 464);
      assert.equal(engine.player.grounded, false);
      engine.step(0.65);
      assert.equal(engine.player.y, 96);
      assert.equal(engine.player.grounded, true);
    }
  }
});

test('flight forms react to held input and robot hold produces a higher jump', t => {
  const portal = mode => [{ id: 'entry', type: 'portal', x: 80, y: 80, w: 32, h: 400, value: mode }];
  for (const mode of ['ship', 'wave']) {
    const held = startEngine(t, portal(mode));
    const released = startEngine(t, portal(mode));
    tick(held); tick(released);
    held.press();
    held.step(0.2); released.step(0.2);
    assert.ok(held.player.y < released.player.y, `${mode} must lift when held`);
    assert.equal(held.state.deaths, 0);
  }
  const holdRobot = startEngine(t, portal('robot'));
  const tapRobot = startEngine(t, portal('robot'));
  tick(holdRobot); tick(tapRobot);
  holdRobot.press(); tapRobot.press(); tick(holdRobot); tick(tapRobot); tapRobot.release();
  holdRobot.step(0.2); tapRobot.step(0.2);
  assert.ok(holdRobot.player.y < tapRobot.player.y, 'robot hold should extend its jump');
  for (const mode of ['ufo', 'swing']) {
    const engine = startEngine(t, portal(mode));
    engine.step(0.15);
    const gravity = engine.player.gravity;
    engine.press(); tick(engine); engine.release();
    assert.equal(engine.state.jumps, 1);
    if (mode === 'ufo') assert.ok(engine.player.vy < 0);
    else assert.equal(engine.player.gravity, -gravity);
  }
});

test('practice checkpoints restore dual players, activated portals, speed, and collected coins', t => {
  const objects = [
    { id: 'dual', type: 'portal', x: 80, y: 80, w: 32, h: 400, value: 'dual' },
    { id: 'mini', type: 'portal', x: 110, y: 80, w: 32, h: 400, value: 'mini' },
    { id: 'speed', type: 'portal', x: 150, y: 80, w: 32, h: 400, value: 'speed:380' },
    { id: 'first-coin', type: 'coin', x: 180, y: 470, w: 24, h: 24 },
    { id: 'second-coin', type: 'coin', x: 500, y: 470, w: 24, h: 24 },
  ];
  const engine = startEngine(t, objects, { practice: true });
  engine.step(0.5);
  assert.equal(engine.dual, true);
  assert.equal(engine.player.mini, true);
  assert.equal(engine.speed, 380);
  assert.deepEqual(engine.state.coinIds, ['first-coin']);
  assert.equal(engine.checkpoint(), true);
  const saved = { player: { ...engine.player }, player2: { ...engine.player2 }, portals: [...engine.activated] };
  engine.step(1);
  assert.equal(engine.state.coins, 2);
  engine.restart();
  assert.equal(engine.state.attempts, 2);
  assert.equal(engine.player.x, saved.player.x);
  assert.equal(engine.player.y, saved.player.y);
  assert.equal(engine.player2.y, saved.player2.y);
  assert.equal(engine.speed, 380);
  assert.deepEqual([...engine.activated], saved.portals);
  assert.deepEqual(engine.state.coinIds, ['first-coin']);
  assert.equal(engine.removeCheckpoint(), true);
  engine.restart();
  assert.equal(engine.player.x, 80);
  assert.equal(engine.state.coins, 0);
  assert.equal(engine.dual, false);
});

test('finishing emits once with coin identities that combine across completed runs', t => {
  useStorage(t);
  const store = new Store();
  const finishes = [];
  const engine = startEngine(t, [{ id: 'earned-coin', type: 'coin', x: 150, y: 464, w: 24, h: 24 }], {}, { onFinish: result => finishes.push(result) });
  engine.level.length = 1000;
  for (let index = 0; index < 5; index++) engine.step(1);
  assert.equal(engine.state.status, 'complete');
  assert.equal(finishes.length, 1);
  assert.equal(finishes[0].progress, 100);
  assert.equal(finishes[0].coins, 1);
  assert.deepEqual(finishes[0].coinIds, ['earned-coin']);
  store.recordRun(LEVELS[0], { ...finishes[0], coins: finishes[0].coinIds });
  store.recordRun(LEVELS[0], { percent: 100, coins: ['another-coin'], time: 4 });
  assert.equal(store.getProgress(LEVELS[0].id).coins, 2);
});
