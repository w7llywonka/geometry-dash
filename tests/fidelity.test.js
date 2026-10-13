import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/engine.js';
import { createLevel, normalizeLevel } from '../src/levels.js';

const TICK = 1 / 120;
const portal = (id, x, value, extra = {}) => ({ id, type: 'portal', x, y: 80, w: 24, h: 400, value, ...extra });

function play(t, objects, options = {}, callbacks = {}) {
  const level = normalizeLevel({ ...createLevel(), id: 'local-fidelity', length: 3000, speed: 300, objects });
  const engine = new GameEngine(callbacks);
  engine.start(level, { settings: { reducedMotion: true, autoCheckpoint: false }, ...options });
  t.after(() => engine.destroy());
  return engine;
}

function advanceUntil(engine, predicate, seconds = 4) {
  for (let index = 0; index < seconds / TICK && !predicate(); index++) engine.step(TICK);
  assert.ok(predicate(), 'Expected gameplay state was not reached within the simulated interval.');
}

const object = (engine, id) => engine.objects.find(item => item.id === id);

test('explicit gravity setters are idempotent while toggle reverses the current state', t => {
  const engine = play(t, [
    portal('reverse-a', 80, 'gravity:reverse'),
    portal('reverse-b', 140, 'gravity:reverse'),
    portal('normal-a', 260, 'gravity:normal'),
    portal('normal-b', 310, 'gravity:normal'),
    portal('toggle', 400, 'gravity:toggle'),
  ]);
  engine.step(0.3);
  assert.equal(engine.player.gravity, -1);
  assert.ok(engine.player.y < 464);
  engine.step(0.55);
  assert.equal(engine.player.gravity, 1);
  engine.step(0.3);
  assert.equal(engine.player.gravity, -1);
  assert.equal(engine.state.deaths, 0);
});

test('dual players can enter different forms and sizes without changing their partner', t => {
  const engine = play(t, [
    portal('dual', 80, 'dual:on'),
    portal('player-one-robot', 130, 'robot', { targetPlayer: 'one' }),
    portal('player-two-ship', 130, 'ship', { targetPlayer: 'two' }),
    portal('player-two-mini', 200, 'mini', { targetPlayer: 'two' }),
  ]);
  engine.step(0.6);
  assert.equal(engine.dual, true);
  assert.equal(engine.player.mode, 'robot');
  assert.equal(engine.player2.mode, 'ship');
  assert.equal(engine.player.mini, false);
  assert.equal(engine.player2.mini, true);
  assert.equal(engine.player.gravity, 1);
  assert.equal(engine.player2.gravity, -1);
  assert.equal(engine.state.deaths, 0);
});

test('direction portals reverse actual travel while mirror portals preserve travel direction', t => {
  const engine = play(t, [portal('mirror', 80, 'mirror:on'), portal('left', 180, 'direction:left')]);
  engine.step(0.15);
  assert.equal(engine.mirrored, true);
  assert.ok(engine.player.x > 80);
  advanceUntil(engine, () => engine.player.direction === -1);
  const reversedAt = engine.player.x;
  engine.step(0.1);
  assert.ok(engine.player.x < reversedAt);
  assert.equal(engine.mirrored, true);
  assert.equal(engine.state.deaths, 0);
});

test('dash orb holds a straight path until release and then returns to normal motion', t => {
  const engine = play(t, [{ id: 'dash', type: 'orb', x: 80, y: 464, w: 48, h: 48, value: 'dash', angle: -20 }]);
  engine.press(); engine.step(TICK);
  assert.ok(engine.player.dash);
  const y = engine.player.y;
  engine.step(0.2);
  assert.ok(engine.player.dash);
  assert.ok(engine.player.y < y);
  engine.release(); engine.step(TICK);
  assert.equal(engine.player.dash, null);
  const releasedY = engine.player.y;
  engine.step(0.3);
  assert.ok(engine.player.y > releasedY);
  assert.equal(engine.state.deaths, 0);
});

test('trigger and spider orbs interact with current group state rather than original geometry', t => {
  const triggered = play(t, [
    { id: 'door', type: 'block', x: 180, y: 384, w: 64, h: 96, groups: [1] },
    { id: 'switch', type: 'orb', x: 80, y: 464, w: 48, h: 48, value: 'trigger', action: 'toggle', targetGroup: 1, enabled: false },
  ]);
  triggered.press(); triggered.step(TICK); triggered.release();
  triggered.step(0.6);
  assert.equal(object(triggered, 'door').active, false);
  assert.equal(triggered.state.deaths, 0);
  assert.ok(triggered.player.x > 244);

  const ceiling = { id: 'ceiling', type: 'block', x: 40, y: 200, w: 120, h: 48, groups: [1] };
  const orb = { id: 'spider', type: 'orb', x: 80, y: 464, w: 48, h: 48, value: 'spider' };
  const active = play(t, [ceiling, orb]);
  active.press(); active.step(TICK); active.release();
  assert.equal(active.player.gravity, -1);
  assert.equal(active.player.y, 264);
  const disabled = play(t, [ceiling, orb, { id: 'disable', type: 'trigger', x: 0, y: 300, action: 'toggle', targetGroup: 1, enabled: false }]);
  disabled.press(); disabled.step(TICK); disabled.release();
  assert.equal(disabled.player.gravity, -1);
  assert.equal(disabled.player.y, 96);
});

test('linked teleport moves the player to its target without immediately bouncing back', t => {
  const engine = play(t, [
    portal('entry', 110, 'teleport', { targetId: 'exit' }),
    portal('exit', 850, 'teleport', { targetId: 'entry', y: 220, h: 100 }),
  ]);
  engine.step(0.15);
  assert.ok(engine.player.x > 800);
  assert.ok(engine.player.y < 400);
  engine.step(0.2);
  assert.ok(engine.player.x > 800);
  assert.equal(engine.state.deaths, 0);
});

test('a platformer walks up a slope and saw contact remains lethal', t => {
  const slope = play(t, [{ id: 'ramp', type: 'slope', x: 120, y: 400, w: 240, h: 80, value: 'up' }], { platformer: true });
  slope.input.right = true;
  advanceUntil(slope, () => slope.player.x >= 260);
  assert.equal(slope.state.deaths, 0);
  assert.ok(slope.player.y < 430);
  assert.equal(slope.player.grounded, true);
  const hazard = play(t, [{ id: 'saw', type: 'saw', x: 200, y: 464, radius: 30 }]);
  advanceUntil(hazard, () => hazard.state.status === 'dead');
  assert.equal(hazard.state.deaths, 1);
});

test('large saws collide at their perimeter before the player reaches the saw center', t => {
  const engine = play(t, [{ id: 'large-saw', type: 'saw', x: 260, y: 464, radius: 180 }]);
  engine.step(0.15);
  assert.equal(engine.state.status, 'dead');
  assert.equal(engine.state.deaths, 1);
});

test('native platformer checkpoint survives death without converting the run to practice', t => {
  const finishes = [];
  const engine = play(t, [
    { id: 'checkpoint', type: 'checkpoint', x: 180, y: 400, w: 32, h: 80 },
    { id: 'hazard', type: 'spike', x: 390, y: 448, w: 32, h: 32 },
    { id: 'goal', type: 'trigger', x: 700, y: 400, action: 'end' },
  ], { platformer: true }, { onFinish: result => finishes.push(result) });
  engine.input.right = true;
  advanceUntil(engine, () => engine.state.nativeCheckpointCount === 1);
  const checkpointX = engine.nativeCheckpoint.player.x;
  assert.ok(checkpointX > 80);
  advanceUntil(engine, () => engine.state.status === 'dead');
  advanceUntil(engine, () => engine.state.attempts === 2);
  assert.ok(engine.player.x >= checkpointX && engine.player.x < 300);
  assert.equal(engine.state.practice, false);
  advanceUntil(engine, () => engine.player.x >= 260);
  engine.press(); engine.step(TICK); engine.release();
  advanceUntil(engine, () => engine.state.status === 'complete');
  assert.equal(finishes.length, 1);
  assert.equal(finishes[0].practice, false);
  assert.equal(finishes[0].progress, 100);
});

test('practice checkpoint restores in-flight group movement, counters, and delayed spawns', t => {
  const engine = play(t, [
    { id: 'moving', type: 'decoration', x: 1600, y: 240, groups: [1] },
    { id: 'door', type: 'decoration', x: 1800, y: 240, groups: [3] },
    { id: 'move', type: 'trigger', x: 100, y: 300, action: 'move', targetGroup: 1, moveX: 180, duration: 2 },
    { id: 'pickup', type: 'trigger', x: 110, y: 300, action: 'pickup', counterId: 1, count: 2 },
    { id: 'spawn', type: 'trigger', x: 130, y: 300, action: 'spawn', spawnGroup: 2, delay: 0.8 },
    { id: 'hide', type: 'trigger', x: 0, y: 300, action: 'toggle', groups: [2], targetGroup: 3, enabled: false, spawnTriggered: true },
    { id: 'later-pickup', type: 'trigger', x: 350, y: 300, action: 'pickup', counterId: 1, count: 3 },
  ], { practice: true });
  engine.step(0.3);
  assert.equal(engine.runtime.counters['1'], 2);
  assert.ok(object(engine, 'moving').x > 1600);
  assert.notEqual(object(engine, 'door').active, false);
  assert.equal(engine.checkpoint(), true);
  const savedX = object(engine, 'moving').x;
  engine.step(0.8);
  const advancedX = object(engine, 'moving').x;
  assert.equal(engine.runtime.counters['1'], 5);
  assert.equal(object(engine, 'door').active, false);
  engine.restart();
  assert.equal(object(engine, 'moving').x, savedX);
  assert.equal(engine.runtime.counters['1'], 2);
  assert.notEqual(object(engine, 'door').active, false);
  engine.step(0.8);
  assert.ok(Math.abs(object(engine, 'moving').x - advancedX) < 1e-8);
  assert.equal(engine.runtime.counters['1'], 5);
  assert.equal(object(engine, 'door').active, false);
});

test('touch-triggered effects require contact rather than passing the same X position', t => {
  const engine = play(t, [
    { id: 'distant', type: 'trigger', x: 100, y: 100, w: 32, h: 32, action: 'pickup', counterId: 1, count: 10, touchTriggered: true },
    { id: 'touching', type: 'trigger', x: 180, y: 440, w: 32, h: 40, action: 'pickup', counterId: 2, count: 5, touchTriggered: true },
  ]);
  engine.step(0.7);
  assert.equal(engine.runtime.counters['1'] ?? 0, 0);
  assert.equal(engine.runtime.counters['2'], 5);
});

test('repeatable touch triggers restore contact at checkpoints and rearm only after leaving', t => {
  const engine = play(t, [
    { id: 'repeat', type: 'trigger', x: 80, y: 440, w: 80, h: 40, action: 'pickup', counterId: 3, count: 1, touchTriggered: true, once: false },
  ], { platformer: true, practice: true });
  engine.step(TICK);
  assert.equal(engine.runtime.counters['3'], 1);
  assert.equal(engine.checkpoint(), true);
  engine.step(0.2);
  assert.equal(engine.runtime.counters['3'], 1);
  engine.restart();
  engine.step(0.2);
  assert.equal(engine.runtime.counters['3'], 1);
  engine.input.right = true;
  advanceUntil(engine, () => engine.player.x > 190);
  engine.input.right = false;
  engine.input.left = true;
  advanceUntil(engine, () => engine.runtime.counters['3'] === 2);
  assert.equal(engine.state.deaths, 0);
  assert.equal(engine.state.attempts, 2);
});

test('moving platforms carry a standing player with the trigger-driven surface', t => {
  const engine = play(t, [
    { id: 'moving-platform', type: 'block', x: 150, y: 400, w: 500, h: 80, groups: [1] },
    { id: 'lift', type: 'trigger', x: 100, y: 300, action: 'move', targetGroup: 1, moveY: -60, duration: 1 },
    { id: 'standing', type: 'startpos', x: 300, y: 384 },
  ], { platformer: true, testMode: true, startPositionId: 'standing' });
  engine.step(0.5);
  assert.equal(engine.state.deaths, 0);
  assert.equal(engine.player.grounded, true);
  assert.ok(engine.player.y < 370);
  assert.ok(Math.abs(engine.player.y + 16 - object(engine, 'moving-platform').y) < 1e-8);
});

test('follow triggers respect disabled axes while following player movement on enabled axes', t => {
  const engine = play(t, [
    { id: 'follower', type: 'decoration', x: 1500, y: 200, groups: [1] },
    { id: 'follow', type: 'trigger', x: 80, y: 300, action: 'follow', targetGroup: 1, followX: false, followY: true },
  ]);
  engine.press(); engine.step(TICK); engine.release();
  engine.step(0.2);
  assert.equal(object(engine, 'follower').x, 1500);
  assert.ok(object(engine, 'follower').y < 200);
});

test('sound triggers preserve channel identity so stopping one channel leaves another playing', t => {
  const played = [];
  const stopped = [];
  const channels = new Map();
  const audio = {
    playSfx(id, options) { played.push({ id, channel: options.channel }); channels.set(options.channel, id); },
    stopSfx(channel) { stopped.push(channel); channels.delete(channel); },
  };
  const engine = play(t, [
    { id: 'door-sound', type: 'trigger', x: 80, y: 300, action: 'sfx', soundId: 'pulse', soundChannel: 'doors' },
    { id: 'ambient-sound', type: 'trigger', x: 100, y: 300, action: 'sfx', soundId: 'coin', soundChannel: 'ambient' },
    { id: 'stop-door', type: 'trigger', x: 160, y: 300, action: 'stop-sfx', soundId: 'pulse', soundChannel: 'doors' },
  ], {}, { audio });
  engine.step(0.4);
  assert.deepEqual(played, [{ id: 'pulse', channel: 'doors' }, { id: 'coin', channel: 'ambient' }]);
  assert.deepEqual(stopped, ['doors']);
  assert.equal(channels.has('doors'), false);
  assert.equal(channels.get('ambient'), 'coin');
});

test('recursive spawn groups are bounded so malformed local levels cannot freeze gameplay', t => {
  const engine = play(t, [
    { id: 'cycle', type: 'trigger', x: 100, y: 300, groups: [1], action: 'spawn', spawnGroup: 1, once: false },
  ]);
  engine.step(0.5);
  assert.equal(engine.state.status, 'playing');
  assert.ok(engine.player.x > 200);
  assert.ok(engine.runtime.limitHits > 0);
  assert.ok(engine.runtime.queue.length < 2048);
});

test('editor start positions are ignored in normal play and marked as test runs when used', t => {
  const objects = [{ id: 'test-start', type: 'startpos', x: 600, y: 300, mode: 'ship', mini: true, gravity: -1, speed: 380 }];
  const normal = play(t, objects, { startPositionId: 'test-start' });
  assert.equal(normal.player.x, 80);
  assert.equal(normal.player.mode, 'cube');
  const finishes = [];
  const testing = play(t, objects, { testMode: true, startPositionId: 'test-start' }, { onFinish: result => finishes.push(result) });
  assert.equal(testing.player.x, 600);
  assert.equal(testing.player.mode, 'ship');
  assert.equal(testing.player.mini, true);
  assert.equal(testing.player.gravity, -1);
  assert.equal(testing.state.testMode, true);
  for (let index = 0; index < 5; index++) testing.step(2);
  assert.equal(finishes.length, 1);
  assert.equal(finishes[0].testMode, true);
});

test('malformed trigger imports fail before they can enter the runtime', () => {
  for (const changes of [
    { groups: [0] }, { targetPlayer: 'third' }, { duration: Infinity },
    { action: 'eval' }, { operation: 'divide', count: 0 }, { color: 'url(javascript:alert(1))' },
  ]) assert.throws(() => normalizeLevel({ ...createLevel(), objects: [{ id: 'bad', type: 'trigger', x: 100, y: 300, action: 'pickup', ...changes }] }));
});
