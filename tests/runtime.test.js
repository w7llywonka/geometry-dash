import test from 'node:test';
import assert from 'node:assert/strict';
import { Runtime } from '../src/runtime.js';

const block = { id: 'block', type: 'block', x: 10, y: 20, w: 20, h: 20, groups: [1] };
const player = (x, prevX = x, y = 400) => ({ x, prevX, y });

test('group effects move collision geometry without mutating source objects', () => {
  const source = [block, { ...block, id: 'other', x: 40, groups: [1, 1, -1, '2'] }];
  const before = JSON.stringify(source);
  const runtime = new Runtime({ objects: source });
  runtime.activate({ action: 'move', targetGroup: 1, moveX: 80, moveY: -20, duration: 2 });
  runtime.step(0.5);
  assert.equal(runtime.objects[0].x, 30);
  assert.equal(runtime.objects[0].y, 15);
  runtime.step(1.5);
  assert.equal(runtime.objects[0].x, 90);
  assert.equal(runtime.objects[1].x, 120);
  assert.deepEqual(runtime.objects[1].groups, [1]);
  assert.equal(JSON.stringify(source), before);
  runtime.reset();
  assert.equal(runtime.objects[0].x, 10);
});

test('JSON checkpoint resumes delayed spawn, active animations, counters and group toggles', () => {
  const objects = [block,
    { id: 'move', type: 'trigger', action: 'move', x: 100, targetGroup: 1, moveX: 100, duration: 2 },
    { id: 'count', type: 'trigger', action: 'pickup', x: 120, counterId: 7, count: 3 },
    { id: 'spawn', type: 'trigger', action: 'spawn', x: 130, spawnGroup: 2, delay: 1 },
    { id: 'toggle', type: 'trigger', action: 'toggle', x: 1000, groups: [2], spawnTriggered: true, targetGroup: 1, enabled: false },
  ];
  const runtime = new Runtime({ objects });
  runtime.step(0, { players: [player(80)] });
  runtime.step(0.5, { players: [player(140, 80)] });
  const checkpoint = JSON.parse(JSON.stringify(runtime.snapshot()));
  assert.equal(checkpoint.queue.length, 1);
  assert.equal(checkpoint.animations.length, 1);
  assert.equal(runtime.counters[7], 3);
  runtime.step(1.5, { players: [player(200, 140)] });
  const expected = runtime.snapshot();
  assert.equal(runtime.objects[0].active, false);
  assert.equal(runtime.objects[0].x, 110);
  runtime.restore(checkpoint);
  runtime.step(1.5, { players: [player(200, 140)] });
  assert.deepEqual(runtime.snapshot(), expected);
});

test('queued trigger arguments are captured and unsafe counter arithmetic remains finite', () => {
  const runtime = new Runtime({ objects: [block] });
  const trigger = { action: 'move', targetGroup: 1, moveX: 30, delay: 1 };
  runtime.activate(trigger);
  trigger.moveX = 999;
  runtime.step(1);
  assert.equal(runtime.objects[0].x, 40);
  runtime.activate({ action: 'pickup', counterId: 1, operation: 'set', count: 5 });
  runtime.activate({ action: 'pickup', counterId: 1, operation: 'divide', count: 0 });
  assert.equal(runtime.counters[1], 5);
  runtime.activate({ action: 'pickup', counterId: 1, operation: 'multiply', count: 1e308 });
  assert.equal(runtime.counters[1], 5);
});

test('spawn-only triggers require explicit activation and cyclic spawn groups are bounded', () => {
  const runtime = new Runtime({ objects: [block, { id: 'cycle', type: 'trigger', action: 'spawn', x: 0, spawnTriggered: true, groups: [2], spawnGroup: 2, once: false }] });
  runtime.step(1, { players: [player(80)] });
  assert.equal(runtime.limitHits, 0);
  runtime.activate(runtime.objects[1]);
  assert.ok(runtime.limitHits > 0);
  assert.equal(runtime.queue.length, 0);
});

test('follow preserves relative placement and checkpoint restores the current player binding', () => {
  const runtime = new Runtime({ objects: [block] });
  const first = player(80);
  runtime.activate({ action: 'follow', targetGroup: 1, followX: 0.5, followY: 1 }, { player: first, players: [first] });
  runtime.step(1, { players: [player(120, 80, 410)] });
  assert.equal(runtime.objects[0].x, 30);
  assert.equal(runtime.objects[0].y, 30);
  const checkpoint = JSON.parse(JSON.stringify(runtime.snapshot()));
  runtime.step(1, { players: [player(140, 120, 420)] });
  runtime.restore(checkpoint);
  runtime.step(1, { players: [player(140, 120, 420)] });
  assert.equal(runtime.objects[0].x, 40);
  assert.equal(runtime.objects[0].y, 40);
});

test('rotation, alpha, color and camera effects share the saved timeline', () => {
  const runtime = new Runtime({ objects: [{ ...block, color: '#000000' }] });
  runtime.activate({ action: 'rotate', targetGroup: 1, rotation: 90, centerX: 0, centerY: 0, duration: 1 });
  runtime.activate({ action: 'alpha', targetGroup: 1, opacity: 0, duration: 1 });
  runtime.activate({ action: 'color', targetGroup: 1, color: '#ffffff', duration: 1 });
  runtime.activate({ action: 'camera', zoom: 2, cameraX: 40, cameraRotation: 10, duration: 1 });
  runtime.step(0.5);
  assert.equal(runtime.objects[0].rotation, 45);
  assert.equal(runtime.objects[0].opacity, 0.5);
  assert.equal(runtime.objects[0].color, '#808080');
  assert.equal(runtime.camera.zoom, 1.5);
  const checkpoint = runtime.snapshot();
  runtime.step(0.5);
  assert.ok(Math.abs(runtime.objects[0].x - -40) < 1e-10);
  assert.ok(Math.abs(runtime.objects[0].y - 10) < 1e-10);
  runtime.restore(checkpoint);
  runtime.step(0.5);
  assert.equal(runtime.objects[0].rotation, 90);
  assert.equal(runtime.objects[0].color, '#ffffff');
  assert.equal(runtime.camera.offsetX, 40);
});

test('boolean follow axes disable movement while numeric weights remain supported', () => {
  const runtime = new Runtime({ objects: [block] });
  const first = player(80);
  runtime.activate({ action: 'follow', targetGroup: 1, followX: false, followY: true }, { player: first, players: [first] });
  runtime.step(1, { players: [player(120, 80, 410)] });
  assert.equal(runtime.objects[0].x, 10);
  assert.equal(runtime.objects[0].y, 30);
});

test('touch triggers rearm on exit and end/audio/gravity events carry activation context', () => {
  const events = [];
  const runtime = new Runtime({ onEvent: (event) => events.push(event), objects: [
    { id: 'touch', type: 'trigger', action: 'pickup', x: 100, y: 384, w: 32, h: 32, touchTriggered: true, once: false, counterId: 1 },
  ] });
  runtime.step(0, { players: [player(110)] });
  runtime.step(0, { players: [player(110)] });
  assert.equal(runtime.counters[1], 1);
  runtime.step(0, { players: [player(200)] });
  runtime.step(0, { players: [player(110)] });
  assert.equal(runtime.counters[1], 2);
  const second = player(90);
  const players = [player(80), second];
  runtime.activate({ action: 'gravity', gravityValue: 'reverse', targetPlayer: 'two' }, { player: second, players });
  runtime.activate({ action: 'sfx', soundId: 'orb', volume: 0.4 });
  runtime.activate({ action: 'stop-sfx', soundId: 'orb' });
  runtime.activate({ action: 'end' });
  assert.deepEqual(events[0], { type: 'gravity', targetPlayer: 'two', playerIndex: 1, gravityValue: 'reverse', value: 'reverse' });
  assert.equal(events[1].soundId, 'orb');
  assert.equal(events[1].channel, 'orb');
  assert.equal(events[1].volume, 0.4);
  assert.equal(events[2].type, 'stop-sfx');
  assert.equal(events[3].type, 'end');
});

test('sound triggers retain authored channels independently of the sound being played', () => {
  const events = [];
  const runtime = new Runtime({ onEvent: (event) => events.push(event) });
  runtime.activate({ action: 'sfx', soundId: 'pulse', channel: 'doors' });
  runtime.activate({ action: 'sfx', soundId: 'coin', soundChannel: 'ambient' });
  runtime.activate({ action: 'stop-sfx', channel: 'doors' });
  runtime.activate({ action: 'stop-sfx' });
  assert.equal(events[0].channel, 'doors');
  assert.equal(events[0].soundId, 'pulse');
  assert.equal(events[1].channel, 'ambient');
  assert.equal(events[2].channel, 'doors');
  assert.equal(events[3].channel, null);
});
