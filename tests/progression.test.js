import test from 'node:test';
import assert from 'node:assert/strict';
import { Store, SHOP_ITEMS, STORAGE_KEY, ECONOMY_RULES } from '../src/store.js';
import { LEVELS, createLevel } from '../src/levels.js';
import { AudioManager } from '../src/audio.js';

function profile(t, saved) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map(saved ? [[STORAGE_KEY, JSON.stringify(saved)]] : []);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  t.after(() => original ? Object.defineProperty(globalThis, 'localStorage', original) : delete globalThis.localStorage);
  return { store: new Store(), storage };
}

const classic = () => LEVELS.find(level => !level.platformer);
const platformer = () => LEVELS.find(level => level.platformer);

test('original campaign rewards are once-only and practice/custom clears cannot earn campaign currency', t => {
  const { store } = profile(t);
  store.recordRun(classic(), { completed: true, practice: true });
  assert.equal(store.getSummary().orbs, 0);
  assert.equal(store.getSummary().stars, 0);
  store.recordRun({ ...createLevel(), custom: true }, { completed: true, coins: ['custom-coin'] });
  assert.equal(store.getSummary().orbs, 0);
  assert.equal(store.getSummary().coins, 0);
  const first = store.recordRun(classic(), { completed: true, time: 20 });
  assert.equal(first.orbsAwarded, 2 * ECONOMY_RULES.orbsPerRating);
  const funds = store.getSummary().orbs;
  const next = store.recordRun(classic(), { completed: true, time: 18, coins: ['one', 'two'] });
  assert.equal(next.orbsAwarded, 0);
  assert.equal(store.getSummary().orbs, funds);
  assert.equal(store.getProgress(classic().id).bestTime, 18);
  assert.equal(store.getProgress(classic().id).coins, 2);
});

test('platformer moons use campaign difficulty, while keys follow lifetime orbs rather than wallet balance', t => {
  const { store } = profile(t);
  store.recordRun(classic(), { completed: true });
  store.recordRun({ ...platformer(), difficulty: 'Demon' }, { completed: true });
  const summary = store.getSummary();
  assert.equal(summary.stars, 2);
  assert.equal(summary.moons, 3);
  assert.equal(summary.orbs, 500);
  assert.equal(summary.keys, 1);
  assert(store.purchase('icon-12').success);
  assert.equal(store.getSummary().orbs, 300);
  assert.equal(store.getSummary().keys, 1);
  store.recordRun(platformer(), { completed: true });
  assert.equal(store.getSummary().orbs, 300);
  assert.equal(store.getSummary().moons, 3);
  assert.equal(store.getSummary().keys, 1);
  store.recordRun(LEVELS.find(level => !level.platformer && level.difficulty === 'Hard'), { completed: true });
  assert.equal(store.data.economy.earnedOrbs, 1000);
  assert.equal(store.getSummary().keys, 2);
});

test('achievement diamonds remain stable across repeated profile views, runs, and reloads', t => {
  const { store } = profile(t);
  store.recordRun(classic(), { completed: true });
  assert.equal(store.getSummary().diamonds, 15);
  store.getAchievements();
  store.getAchievements();
  store.recordRun(classic(), { completed: true });
  assert.equal(store.getSummary().diamonds, 15);
  const reload = new Store();
  assert.equal(reload.getSummary().diamonds, 15);
  assert.deepEqual(reload.data.economy.achievementRewards, ['first-clear']);
});

test('v1 migration credits past milestones once and preserves equipped legacy cosmetics', t => {
  const legacy = {
    version: 1,
    progress: { [classic().id]: { best: 100, completed: true, coins: 1, attempts: 4, bestTime: 21 } },
    settings: { music: false, volume: 0.2 }, cosmetics: { icon: 23, trail: 'rainbow', primary: '#123456' },
    customLevels: [], stats: { totalAttempts: 4, jumps: 20, deaths: 3, playTime: 90 }, achievements: ['first-clear', 'first-coin'],
  };
  const { store } = profile(t, legacy);
  assert.equal(store.getSummary().orbs, 200);
  assert.equal(store.getSummary().diamonds, 25);
  assert.equal(store.data.settings.music, false);
  assert.equal(store.data.cosmetics.icon, 23);
  assert(store.isUnlocked('icon', 23));
  assert(store.isUnlocked('trail', 'rainbow'));
  assert.equal(store.data.cosmetics.primary, '#123456');
  store.save();
  const reload = new Store();
  reload.recordRun(classic(), { completed: true });
  assert.equal(reload.getSummary().orbs, 200);
  assert.equal(reload.getSummary().diamonds, 25);
  assert.equal(JSON.parse(reload.exportData()).version, 2);
});

test('locked cosmetics require a purchase and duplicate or unaffordable purchases never deduct funds', t => {
  const { store } = profile(t);
  for (let icon = 0; icon < 12; icon++) assert(store.isUnlocked('icon', icon));
  assert(!store.isUnlocked('icon', 12));
  store.updateCosmetics({ icon: 12, trail: 'rainbow' });
  assert.equal(store.data.cosmetics.icon, 0);
  assert.equal(store.data.cosmetics.trail, 'spark');
  const initial = store.exportData();
  assert(!store.purchase('icon-12').success);
  assert(!store.purchase('missing-item').success);
  assert.equal(store.exportData(), initial);
  store.recordRun(classic(), { completed: true });
  assert(store.purchase('icon-12').success);
  const bought = store.exportData();
  assert(!store.purchase('icon-12').success);
  assert.equal(store.exportData(), bought);
  assert(store.getShopItems().find(item => item.id === 'icon-12').owned);
  store.updateCosmetics({ icon: 12 });
  assert.equal(store.data.cosmetics.icon, 12);
});

test('failed persistence rolls a purchase back, including its new achievement', t => {
  const { store, storage } = profile(t);
  store.recordRun(classic(), { completed: true });
  const previous = store.exportData();
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  const result = store.purchase('icon-12');
  assert.equal(result.success, false);
  assert.match(result.message, /not saved/i);
  assert.equal(store.exportData(), previous);
  assert(!store.isUnlocked('icon', 12));
  assert(!store.data.achievements.includes('first-purchase'));
});

test('the full original catalog is attainable from finite offline campaign rewards', t => {
  const { store } = profile(t);
  for (const level of LEVELS) store.recordRun(level, { completed: true, coins: ['one', 'two', 'three'] });
  for (const item of SHOP_ITEMS) assert(store.purchase(item.id).success, `${item.name} should be attainable without replay farming or a server`);
  assert(store.getShopItems().every(item => item.owned));
  for (const currency of ['orbs', 'diamonds', 'keys']) assert(store.getSummary()[currency] >= 0);
});

test('v2 round trips preserve spent balances and inventory; invalid imports leave all progression intact', t => {
  const { store } = profile(t);
  for (const level of LEVELS) store.recordRun(level, { completed: true, coins: ['one', 'two', 'three'] });
  assert(store.purchase('trail-rainbow').success);
  assert(store.purchase('color-0').success);
  assert(store.purchase('icon-23').success);
  store.updateCosmetics({ icon: 23, trail: 'rainbow', primary: SHOP_ITEMS.find(item => item.id === 'color-0').reward.value });
  const snapshot = store.exportData();
  const copy = new Store();
  copy.importData(snapshot);
  assert.deepEqual(JSON.parse(copy.exportData()), JSON.parse(snapshot));
  const invalid = JSON.parse(snapshot);
  invalid.customLevels = [{ ...createLevel(), objects: [{ type: 'block', x: -100, y: 20 }] }];
  assert.throws(() => copy.importData(JSON.stringify(invalid)));
  assert.equal(copy.exportData(), snapshot);
  copy.reset();
  assert.equal(copy.getSummary().orbs, 0);
  assert.equal(copy.getSummary().diamonds, 0);
  assert.equal(copy.getSummary().moons, 0);
  assert(!copy.isUnlocked('icon', 23));
});

function mockAudio(t) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  const nodes = [];
  const param = () => ({ value: 0, setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime(value) { assert(value > 0); } });
  class Node {
    constructor() { this.gain = param(); this.frequency = param(); nodes.push(this); }
    connect() {}
    disconnect() { this.disconnected = true; }
    start() { this.started = true; }
    stop(when) { if (when === undefined) this.cancelled = true; }
  }
  class Context {
    constructor() { this.currentTime = 0; this.sampleRate = 100; this.state = 'running'; this.destination = {}; }
    createGain() { return new Node(); }
    createOscillator() { return new Node(); }
    createBiquadFilter() { return new Node(); }
    createBufferSource() { return new Node(); }
    createBuffer(_, size) { return { getChannelData: () => new Float32Array(size) }; }
    resume() { return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }
  Object.defineProperty(globalThis, 'AudioContext', { value: Context, configurable: true });
  const audio = new AudioManager();
  let now = 0;
  audio.clock = () => now;
  t.after(() => { audio.destroy(); descriptor ? Object.defineProperty(globalThis, 'AudioContext', descriptor) : delete globalThis.AudioContext; });
  return { audio, advance: amount => { now += amount; if (audio.context) audio.context.currentTime += amount; }, nodes };
}

test('audio checkpoints restore logical music phase and active trigger channels without serializing nodes', async t => {
  const { audio, advance } = mockAudio(t);
  await audio.unlock();
  audio.startMusic(120);
  advance(1.5);
  assert(audio.playSfx('alarm', { channel: 'gate', volume: 0.4 }));
  advance(0.2);
  const checkpoint = JSON.parse(JSON.stringify(audio.snapshot()));
  assert.equal(checkpoint.step, 13);
  assert.equal(checkpoint.bpm, 120);
  assert.equal(checkpoint.channels[0].channel, 'gate');
  advance(2);
  audio.startMusic(160);
  assert(audio.restore(checkpoint));
  const restored = audio.snapshot();
  assert.equal(restored.elapsed, checkpoint.elapsed);
  assert.equal(restored.step, checkpoint.step);
  assert.equal(restored.bpm, checkpoint.bpm);
  assert.equal(restored.channels[0].volume, 0.4);
  assert.equal(restored.channels[0].soundId, 'alarm');
  assert(Math.abs(restored.channels[0].elapsed - 0.2) < 1e-10);
  audio.stopSfx('gate');
  assert.equal(audio.snapshot().channels.length, 0);
});

test('music pause freezes its logical phase and resume differs from restart; SFX channels stop independently', async t => {
  const { audio, advance } = mockAudio(t);
  await audio.unlock();
  audio.startMusic(140);
  advance(1);
  audio.stopMusic();
  advance(5);
  assert.equal(audio.snapshot().elapsed, 1);
  audio.startMusic(140, { restart: false });
  advance(0.5);
  assert.equal(audio.snapshot().elapsed, 1.5);
  audio.startMusic(140);
  assert.equal(audio.snapshot().elapsed, 0);
  assert(audio.playSfx('pulse', { channel: 'first' }));
  assert(audio.playSfx('coin', { channel: 'second' }));
  audio.stopSfx('first');
  assert.deepEqual(audio.snapshot().channels.map(item => item.channel), ['second']);
  audio.setSettings({ sfx: false, music: false });
  assert.equal(audio.snapshot().channels.length, 0);
  assert.equal(audio.timer, null);
  assert.equal(audio.playSfx('jump'), false);
  assert.equal(audio.playSfx('download-this'), false);
});
