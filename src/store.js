import { LEVELS, normalizeLevel } from './levels.js';

/**
 * Offline profile storage. All values remain on this browser/device.
 * recordRun() records ONE run/session's level progress and attempt delta;
 * recordStats() owns global counters so the game can report input/death events
 * without recordRun double-counting them. Pass a session's attempts explicitly
 * to recordRun when a session contains automatic restarts.
 */
export const STORAGE_KEY = 'geometry-dash-offline-profile-v1';

// This is this game's original offline economy, not the commercial game's
// reward table. All rewards are deterministic; there are no timed lotteries.
export const ECONOMY_RULES = Object.freeze({ orbsPerRating: 100, orbsPerKey: 500, description: 'Original offline rewards: campaign clears earn orbs; achievements earn diamonds.' });
const FREE_COLORS = ['#b8ff65', '#9b7bff', '#ffb35c', '#ff638b', '#5ddcff', '#fff275', '#f7f3ff', '#ed71ff', '#63ffce', '#ff775d'];
export const SHOP_ITEMS = [
  ...['Comet', 'Beacon', 'Prism', 'Switch', 'Orbit', 'Signal', 'Crown', 'Apex', 'Flux', 'Nova', 'Circuit', 'Zenith'].map((name, index) => ({
    id: `icon-${index + 12}`, name: `${name} icon`, description: 'An original geometric player design.',
    cost: { orbs: 200 + index * 50, ...(index >= 8 ? { diamonds: 10 } : {}), ...(index >= 10 ? { keys: 1 } : {}) },
    reward: { type: 'icon', value: index + 12 },
  })),
  { id: 'trail-rainbow', name: 'Spectrum trail', description: 'Leave a trail of shifting colors.', cost: { orbs: 650, diamonds: 25, keys: 1 }, reward: { type: 'trail', value: 'rainbow' } },
  { id: 'trail-pulse', name: 'Pulse trail', description: 'A luminous pulse follows your player.', cost: { orbs: 850, diamonds: 35, keys: 2 }, reward: { type: 'trail', value: 'pulse' } },
  ...['#ff4d6d', '#38bdf8', '#a78bfa', '#fbbf24', '#2dd4bf', '#f472b6'].map((value, index) => ({
    id: `color-${index}`, name: ['Crimson', 'Sky', 'Lilac', 'Gold', 'Lagoon', 'Rose'][index], description: 'Unlock this color for either player color.',
    cost: { orbs: 100, diamonds: 5, ...(index >= 4 ? { keys: 1 } : {}) }, reward: { type: 'color', value },
  })),
].map(item => Object.freeze({ ...item, cost: Object.freeze(item.cost), reward: Object.freeze(item.reward) }));
const SHOP_BY_ID = new Map(SHOP_ITEMS.map(item => [item.id, item]));

const DIFFICULTY_STARS = { easy: 2, normal: 3, hard: 5, harder: 7, insane: 9, demon: 10 };
const CAMPAIGN_LEVELS = new Map(LEVELS.map(level => [level.id, level]));
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const COLORS = /^#[0-9a-f]{6}$/i;
const MAX_IMPORT_SIZE = 8 * 1024 * 1024;
const emptyProgress = () => ({ best: 0, practiceBest: 0, completed: false, coins: 0, attempts: 0, bestTime: null });
const emptyEconomy = () => ({ orbs: 0, diamonds: 0, keys: 0, earnedOrbs: 0, earnedDiamonds: 0, earnedKeys: 0, levelRewards: [], achievementRewards: [], purchases: [] });
const emptyInventory = () => ({ icons: Array.from({ length: 12 }, (_, i) => i), trails: ['spark', 'line', 'none'], colors: [...FREE_COLORS] });
const defaults = () => ({
  progress: {},
  settings: { music: true, sfx: true, autoCheckpoint: true, reducedMotion: false, volume: 0.5 },
  cosmetics: { primary: '#b8ff65', secondary: '#9b7bff', icon: 0, trail: 'spark' },
  customLevels: [],
  stats: { totalAttempts: 0, jumps: 0, deaths: 0, playTime: 0 },
  achievements: [],
  economy: emptyEconomy(),
  inventory: emptyInventory(),
});
const number = (value, fallback = 0, max = Number.MAX_SAFE_INTEGER) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : fallback;
const integer = (value, fallback = 0, max = Number.MAX_SAFE_INTEGER) => Math.floor(number(value, fallback, max));
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeId = value => typeof value === 'string' && value.length > 0 && value.length <= 128 && !BLOCKED_KEYS.has(value);
const campaignProgress = data => Object.values(data.progress).filter(item => !item.custom);

export const ACHIEVEMENTS = [
  { id: 'first-clear', title: 'First light', description: 'Complete your first campaign level.', icon: '★', test: data => campaignProgress(data).some(item => item.completed) },
  { id: 'three-clear', title: 'Finding the rhythm', description: 'Complete 3 campaign levels.', icon: '◆', test: data => campaignProgress(data).filter(item => item.completed).length >= 3 },
  { id: 'eight-clear', title: 'Full spectrum', description: 'Complete 8 campaign levels.', icon: '✦', test: data => campaignProgress(data).filter(item => item.completed).length >= 8 },
  { id: 'first-coin', title: 'Off the beaten path', description: 'Collect a campaign coin and finish the level.', icon: '◉', test: data => campaignProgress(data).some(item => item.coins > 0) },
  { id: 'coin-hunter', title: 'Coin collector', description: 'Collect 10 campaign coins.', icon: '◉', test: data => campaignProgress(data).reduce((sum, item) => sum + item.coins, 0) >= 10 },
  { id: 'practice-clear', title: 'Prepared for anything', description: 'Finish a level in practice mode.', icon: '⚑', test: data => Object.values(data.progress).some(item => item.practiceBest >= 100) },
  { id: 'hundred-attempts', title: 'One more try', description: 'Make 100 attempts.', icon: '↻', test: data => data.stats.totalAttempts >= 100 },
  { id: 'platformer-clear', title: 'Room to explore', description: 'Complete a campaign platformer level.', icon: '▣', test: data => campaignProgress(data).some(item => item.completed && item.mode === 'platformer') },
  { id: 'level-maker', title: 'Make your own rhythm', description: 'Save a level in the editor.', icon: '✎', test: data => data.customLevels.length > 0 },
  { id: 'thousand-jumps', title: 'Air time', description: 'Jump 1,000 times.', icon: '↑', test: data => data.stats.jumps >= 1000 },
  { id: 'orb-spark', title: 'Stored energy', description: 'Earn 500 campaign orbs.', icon: '◉', test: data => data.economy.earnedOrbs >= 500 },
  { id: 'moon-traveler', title: 'Above the horizon', description: 'Earn 8 moons from campaign platformers.', icon: '☾', test: data => campaignProgress(data).reduce((sum, item) => sum + (item.completed ? item.moons ?? 0 : 0), 0) >= 8 },
  { id: 'first-purchase', title: 'Personal signal', description: 'Buy your first local shop cosmetic.', icon: '✦', test: data => data.economy.purchases.length > 0 },
];
const ACHIEVEMENT_DIAMONDS = { 'first-clear': 15, 'three-clear': 30, 'eight-clear': 60, 'first-coin': 10, 'coin-hunter': 25, 'practice-clear': 10, 'hundred-attempts': 10, 'platformer-clear': 30, 'level-maker': 10, 'thousand-jumps': 20, 'orb-spark': 25, 'moon-traveler': 25, 'first-purchase': 10 };
const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map(item => item.id));

// Levels are plain JSON only. Reject dangerous keys anywhere, excessive depth,
// non-finite values, and oversize structures; no imported text is executed.
function cloneJSON(value, depth = 0, budget = { nodes: 0 }) {
  if (depth > 20 || ++budget.nodes > 100000) throw new Error('The level data is too complex.');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.length > 100000) throw new Error('A text field is too large.');
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(item => cloneJSON(item, depth + 1, budget));
  if (isObject(value)) {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (BLOCKED_KEYS.has(key)) throw new Error('The imported data contains an invalid key.');
      if (typeof item === 'undefined') continue;
      result[key] = cloneJSON(item, depth + 1, budget);
    }
    return result;
  }
  throw new Error('Levels must contain only JSON data.');
}

function cleanSettings(source, base = defaults().settings) {
  const result = { ...base };
  if (!isObject(source)) return result;
  for (const key of ['music', 'sfx', 'autoCheckpoint', 'reducedMotion']) {
    if (typeof source[key] === 'boolean') result[key] = source[key];
  }
  if (typeof source.volume === 'number' && Number.isFinite(source.volume)) result.volume = number(source.volume, base.volume, 1);
  return result;
}

function cleanCosmetics(source, base = defaults().cosmetics) {
  const result = { ...base };
  if (!isObject(source)) return result;
  for (const key of ['primary', 'secondary']) {
    if (typeof source[key] === 'string' && COLORS.test(source[key])) result[key] = source[key];
  }
  if (typeof source.icon === 'number') result.icon = integer(source.icon, base.icon, 23);
  if (['spark', 'line', 'none', 'rainbow', 'pulse'].includes(source.trail)) result.trail = source.trail;
  return result;
}

function cleanProgress(source) {
  const result = {};
  if (!isObject(source)) return result;
  for (const [id, value] of Object.entries(source).slice(0, 1000)) {
    if (!safeId(id) || !isObject(value)) continue;
    const completed = value.completed === true;
    const campaign = CAMPAIGN_LEVELS.get(id);
    result[id] = {
      best: completed ? 100 : number(value.best, 0, 100),
      practiceBest: number(value.practiceBest, 0, 100),
      completed,
      coins: completed ? integer(value.coins, 0, 3) : 0,
      attempts: integer(value.attempts),
      bestTime: completed && number(value.bestTime) > 0 ? number(value.bestTime) : null,
      custom: !campaign,
      stars: campaign && !campaign.platformer ? DIFFICULTY_STARS[String(campaign.difficulty).toLowerCase()] ?? 3 : 0,
      moons: campaign?.platformer ? DIFFICULTY_STARS[String(campaign.difficulty).toLowerCase()] ?? 3 : 0,
      mode: campaign ? (campaign.platformer ? 'platformer' : 'classic') : value.mode === 'platformer' ? 'platformer' : 'classic',
      coinIds: Array.isArray(value.coinIds) ? [...new Set(value.coinIds.filter(id => typeof id === 'string' || Number.isInteger(id)))].slice(0, 3) : [],
    };
  }
  return result;
}

function cleanProfile(source) {
  if (!isObject(source)) throw new Error('The save file must contain a profile object.');
  if (!isObject(source.progress) && !isObject(source.settings) && !Array.isArray(source.customLevels)) {
    throw new Error('This is not a compatible profile save file.');
  }
  const result = defaults();
  result.progress = cleanProgress(source.progress);
  result.settings = cleanSettings(source.settings);
  result.cosmetics = cleanCosmetics(source.cosmetics);
  if (Array.isArray(source.customLevels)) {
    if (source.customLevels.length > 100) throw new Error('A profile can contain at most 100 custom levels.');
    const seen = new Set();
    result.customLevels = source.customLevels.map(level => {
      const cleaned = cleanLevel(level);
      if (seen.has(cleaned.id)) throw new Error('Every custom level needs a unique valid ID.');
      seen.add(cleaned.id);
      return cleaned;
    });
  }
  for (const level of result.customLevels) if (result.progress[level.id]) result.progress[level.id].custom = true;
  if (isObject(source.stats)) {
    for (const key of Object.keys(result.stats)) result.stats[key] = number(source.stats[key]);
    for (const key of ['totalAttempts', 'jumps', 'deaths']) result.stats[key] = Math.floor(result.stats[key]);
  }
  if (Array.isArray(source.achievements)) result.achievements = [...new Set(source.achievements.filter(id => ACHIEVEMENT_IDS.has(id)))];
  result.economy = cleanEconomy(source.economy);
  result.inventory = cleanInventory(source.inventory);
  // An older profile had no unlock restrictions. Grandfather any equipped
  // legacy cosmetic, including previously selected extended icons/trails.
  if (!isObject(source.inventory)) {
    unlockReward(result.inventory, { type: 'icon', value: result.cosmetics.icon });
    unlockReward(result.inventory, { type: 'trail', value: result.cosmetics.trail });
    unlockReward(result.inventory, { type: 'color', value: result.cosmetics.primary });
    unlockReward(result.inventory, { type: 'color', value: result.cosmetics.secondary });
  }
  for (const id of result.economy.purchases) unlockReward(result.inventory, SHOP_BY_ID.get(id).reward);
  for (const [id, progress] of Object.entries(result.progress)) if (!progress.custom && progress.completed) creditLevel(result, id);
  for (const id of result.achievements) creditAchievement(result, id);
  if (!isOwned(result.inventory, 'icon', result.cosmetics.icon)) result.cosmetics.icon = 0;
  if (!isOwned(result.inventory, 'trail', result.cosmetics.trail)) result.cosmetics.trail = 'spark';
  for (const key of ['primary', 'secondary']) if (!isOwned(result.inventory, 'color', result.cosmetics[key])) result.cosmetics[key] = defaults().cosmetics[key];
  return result;
}

function cleanEconomy(source) {
  const result = emptyEconomy();
  if (!isObject(source)) return result;
  for (const key of ['orbs', 'diamonds', 'keys', 'earnedOrbs', 'earnedDiamonds', 'earnedKeys']) result[key] = integer(source[key]);
  for (const [key, allowed] of [['levelRewards', CAMPAIGN_LEVELS], ['achievementRewards', ACHIEVEMENT_IDS], ['purchases', SHOP_BY_ID]]) {
    if (Array.isArray(source[key])) result[key] = [...new Set(source[key].filter(id => allowed.has(id)))];
  }
  // Lifetime amounts cannot fall below available balances. This also keeps
  // legacy/partial imports well-defined without taking away valid funds.
  result.earnedOrbs = Math.max(result.earnedOrbs, result.orbs);
  result.earnedDiamonds = Math.max(result.earnedDiamonds, result.diamonds);
  result.earnedKeys = Math.max(result.earnedKeys, result.keys);
  return result;
}

function cleanInventory(source) {
  const result = emptyInventory();
  if (!isObject(source)) return result;
  if (Array.isArray(source.icons)) result.icons = [...new Set([...result.icons, ...source.icons.filter(value => Number.isInteger(value) && value >= 0 && value < 24)])];
  if (Array.isArray(source.trails)) result.trails = [...new Set([...result.trails, ...source.trails.filter(value => ['rainbow', 'pulse'].includes(value))])];
  if (Array.isArray(source.colors)) result.colors = [...new Set([...result.colors, ...source.colors.filter(value => typeof value === 'string' && COLORS.test(value)).map(value => value.toLowerCase())])].slice(0, 100);
  return result;
}

function unlockReward(inventory, reward) {
  const key = { icon: 'icons', trail: 'trails', color: 'colors' }[reward.type];
  if (key && !inventory[key].includes(reward.value)) inventory[key].push(reward.value);
}

function isOwned(inventory, kind, value) {
  const key = { icon: 'icons', icons: 'icons', trail: 'trails', trails: 'trails', color: 'colors', colors: 'colors' }[kind];
  if (!key) return false;
  if (key === 'colors') {
    if (typeof value !== 'string' || !COLORS.test(value)) return false;
    const color = value.toLowerCase();
    // Preserve user-chosen custom hex colors; only the additional shop
    // palette entries are gated. These are cosmetic choices, not credentials.
    return inventory.colors.includes(color) || !SHOP_ITEMS.some(item => item.reward.type === 'color' && item.reward.value === color);
  }
  return inventory[key].includes(value);
}

function creditLevel(data, id) {
  const level = CAMPAIGN_LEVELS.get(id);
  if (!level || data.economy.levelRewards.includes(id)) return 0;
  const amount = (DIFFICULTY_STARS[String(level.difficulty).toLowerCase()] ?? 3) * ECONOMY_RULES.orbsPerRating;
  data.economy.levelRewards.push(id);
  data.economy.orbs += amount;
  data.economy.earnedOrbs += amount;
  const earnedKeys = Math.floor(data.economy.earnedOrbs / ECONOMY_RULES.orbsPerKey);
  const newKeys = Math.max(0, earnedKeys - data.economy.earnedKeys);
  data.economy.keys += newKeys;
  data.economy.earnedKeys += newKeys;
  return amount;
}

function creditAchievement(data, id) {
  if (data.economy.achievementRewards.includes(id)) return 0;
  const amount = ACHIEVEMENT_DIAMONDS[id] ?? 0;
  data.economy.achievementRewards.push(id);
  data.economy.diamonds += amount;
  data.economy.earnedDiamonds += amount;
  return amount;
}

function cleanLevel(level) {
  if (!isObject(level) || !safeId(level.id)) throw new Error('A custom level needs a valid ID.');
  const copy = { ...normalizeLevel(cloneJSON(level)), custom: true };
  if (copy.id !== level.id) throw new Error('Use only letters, numbers, underscores, and hyphens in a level ID (up to 80 characters).');
  if (CAMPAIGN_LEVELS.has(copy.id)) throw new Error('A custom level cannot use a campaign level ID.');
  return copy;
}

export class Store {
  constructor() {
    this.data = defaults();
    this.storageError = null;
    this.storage = null;
    try {
      this.storage = globalThis.localStorage ?? null;
      const saved = this.storage?.getItem(STORAGE_KEY);
      if (saved && saved.length <= MAX_IMPORT_SIZE) this.data = cleanProfile(JSON.parse(saved));
    } catch (error) {
      // Storage can be blocked in private or embedded browsing. Keep playing
      // with an in-memory profile, and expose the failure to the settings UI.
      this.storageError = error.message;
    }
    this.checkAchievements();
  }

  save() {
    try {
      if (!this.storage) throw new Error('Local storage is unavailable. Export your save to keep it.');
      this.storage.setItem(STORAGE_KEY, this.exportData());
      this.storageError = null;
      return true;
    } catch (error) {
      this.storageError = error.message;
      return false;
    }
  }

  updateSettings(patch) {
    this.data.settings = cleanSettings(patch, this.data.settings);
    this.save();
    return this.data.settings;
  }

  updateCosmetics(patch) {
    const next = cleanCosmetics(patch, this.data.cosmetics);
    if (!this.isUnlocked('icon', next.icon)) next.icon = this.data.cosmetics.icon;
    if (!this.isUnlocked('trail', next.trail)) next.trail = this.data.cosmetics.trail;
    for (const key of ['primary', 'secondary']) if (!this.isUnlocked('color', next[key])) next[key] = this.data.cosmetics[key];
    this.data.cosmetics = next;
    this.save();
    return this.data.cosmetics;
  }

  saveLevel(level) {
    const copy = cleanLevel(level);
    const index = this.data.customLevels.findIndex(item => item.id === copy.id);
    if (index < 0 && this.data.customLevels.length >= 100) throw new Error('You can save up to 100 custom levels. Export or delete a level first.');
    if (JSON.stringify(copy).length > 2 * 1024 * 1024) throw new Error('This level is too large to save.');
    if (index >= 0) this.data.customLevels[index] = copy;
    else this.data.customLevels.push(copy);
    if (this.data.progress[copy.id]) this.data.progress[copy.id].custom = true;
    this.checkAchievements();
    this.save();
    return copy;
  }

  deleteLevel(id) {
    const previous = this.data.customLevels.length;
    this.data.customLevels = this.data.customLevels.filter(level => level.id !== id);
    if (this.data.progress[id]?.custom) delete this.data.progress[id];
    this.save();
    return previous !== this.data.customLevels.length;
  }

  getProgress(id) {
    return safeId(id) && Object.hasOwn(this.data.progress, id) ? this.data.progress[id] : emptyProgress();
  }

  isUnlocked(kind, value) {
    return isOwned(this.data.inventory, kind, value);
  }

  getShopItems() {
    return SHOP_ITEMS.map(item => ({
      ...item,
      owned: this.isUnlocked(item.reward.type, item.reward.value),
      affordable: Object.entries(item.cost).every(([currency, cost]) => this.data.economy[currency] >= cost),
    }));
  }

  purchase(id) {
    const item = SHOP_BY_ID.get(id);
    if (!item) return { success: false, message: 'This shop item does not exist.', item: null };
    if (this.isUnlocked(item.reward.type, item.reward.value)) return { success: false, message: 'You already own this item.', item };
    if (!Object.entries(item.cost).every(([currency, cost]) => this.data.economy[currency] >= cost)) {
      return { success: false, message: 'Earn more rewards to buy this item.', item };
    }
    // Commit all deductions, inventory, and achievement rewards together. A
    // storage write failure rolls the purchase back rather than losing funds.
    const previous = this.data;
    this.data = JSON.parse(JSON.stringify(previous));
    for (const [currency, cost] of Object.entries(item.cost)) this.data.economy[currency] -= cost;
    this.data.economy.purchases.push(id);
    unlockReward(this.data.inventory, item.reward);
    this.checkAchievements();
    if (!this.save()) {
      this.data = previous;
      return { success: false, message: `The purchase was not saved. ${this.storageError}`, item };
    }
    return { success: true, message: `${item.name} unlocked.`, item };
  }

  recordRun(level, result = {}) {
    if (!isObject(level) || !safeId(level.id)) throw new Error('A run needs a valid level.');
    const progress = { ...emptyProgress(), ...this.getProgress(level.id) };
    const practice = result.practice === true || result.mode === 'practice';
    const percent = number(result.percent ?? result.progress ?? result.best, 0, 100);
    const completed = result.completed === true || percent >= 100;
    progress.attempts += integer(result.attempts, 1);
    const campaign = CAMPAIGN_LEVELS.get(level.id);
    if (campaign && level.custom === true) throw new Error('A custom level cannot use a campaign level ID.');
    progress.custom = !campaign;
    const platformer = campaign ? campaign.platformer : level.platformer === true || level.mode === 'platformer' || level.type === 'platformer';
    const rating = DIFFICULTY_STARS[String((campaign ?? level).difficulty).toLowerCase()] ?? 3;
    progress.stars = progress.custom || platformer ? 0 : rating;
    progress.moons = !progress.custom && platformer ? rating : 0;
    progress.mode = platformer ? 'platformer' : 'classic';
    let orbsAwarded = 0;
    if (practice) {
      progress.practiceBest = Math.max(progress.practiceBest, completed ? 100 : percent);
    } else {
      progress.best = Math.max(progress.best, completed ? 100 : percent);
      progress.completed ||= completed;
      if (completed) {
        if (Array.isArray(result.coins)) {
          const validIds = result.coins.filter(id => typeof id === 'string' || Number.isInteger(id));
          progress.coinIds = [...new Set([...(progress.coinIds ?? []), ...validIds])].slice(0, 3);
          progress.coins = Math.max(progress.coins, progress.coinIds.length);
        } else {
          progress.coins = Math.max(progress.coins, integer(result.coins, 0, 3));
        }
        const time = number(result.time ?? result.bestTime);
        if (time > 0) progress.bestTime = progress.bestTime === null ? time : Math.min(progress.bestTime, time);
        if (!progress.custom) orbsAwarded = creditLevel(this.data, level.id);
      }
    }
    this.data.progress[level.id] = progress;
    const unlocked = this.checkAchievements();
    this.save();
    return { ...progress, unlocked, orbsAwarded };
  }

  recordStats(delta = {}) {
    const mapping = { attempts: 'totalAttempts', totalAttempts: 'totalAttempts', jumps: 'jumps', deaths: 'deaths', playTime: 'playTime' };
    for (const [key, target] of Object.entries(mapping)) {
      if (key === 'totalAttempts' && typeof delta.attempts === 'number') continue;
      if (typeof delta[key] === 'number' && Number.isFinite(delta[key])) {
        this.data.stats[target] = Math.min(Number.MAX_SAFE_INTEGER, this.data.stats[target] + (target === 'playTime' ? number(delta[key]) : integer(delta[key])));
      }
    }
    const unlocked = this.checkAchievements();
    this.save();
    return unlocked;
  }

  getSummary() {
    const campaign = campaignProgress(this.data);
    return {
      stars: campaign.reduce((sum, item) => sum + (item.completed ? item.stars ?? 0 : 0), 0),
      moons: campaign.reduce((sum, item) => sum + (item.completed ? item.moons ?? 0 : 0), 0),
      orbs: this.data.economy.orbs,
      diamonds: this.data.economy.diamonds,
      keys: this.data.economy.keys,
      coins: campaign.reduce((sum, item) => sum + item.coins, 0),
      completed: campaign.filter(item => item.completed).length,
      attempts: this.data.stats.totalAttempts,
      jumps: this.data.stats.jumps,
      deaths: this.data.stats.deaths,
      playTime: this.data.stats.playTime,
    };
  }

  checkAchievements() {
    const unlocked = [];
    for (const item of ACHIEVEMENTS) {
      if (!this.data.achievements.includes(item.id) && item.test(this.data)) {
        this.data.achievements.push(item.id);
        creditAchievement(this.data, item.id);
        unlocked.push(item);
      }
    }
    return unlocked;
  }

  getAchievements() {
    this.checkAchievements();
    return ACHIEVEMENTS.map(({ test, ...item }) => ({ ...item, diamonds: ACHIEVEMENT_DIAMONDS[item.id] ?? 0, unlocked: this.data.achievements.includes(item.id) }));
  }

  exportData() {
    return JSON.stringify({ version: 2, ...this.data }, null, 2);
  }

  // Import atomically replaces the profile after validation. The caller should
  // explain that replacement and request confirmation before calling this.
  importData(text) {
    if (typeof text !== 'string' || text.length > MAX_IMPORT_SIZE) throw new Error('Choose a save file smaller than 8 MB.');
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error('The save file is not valid JSON.'); }
    if (!isObject(parsed)) throw new Error('The save file must contain a profile object.');
    if (parsed.version !== undefined && ![1, 2].includes(parsed.version)) throw new Error('This save file uses an unsupported version.');
    const cleaned = cleanProfile(parsed);
    this.data = cleaned;
    this.checkAchievements();
    this.save();
    return this.data;
  }

  // The app owns the explicit user confirmation for this destructive action.
  reset() {
    this.data = defaults();
    this.save();
    return this.data;
  }
}

export default Store;
