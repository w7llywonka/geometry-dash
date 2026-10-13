const MAX_EVENTS = 256;
const MAX_QUEUE = 2048;
const MAX_SPAWN_DEPTH = 32;
const clone = (value) => JSON.parse(JSON.stringify(value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const add = (a, b) => finite(finite(a) + finite(b), finite(a));
const kind = (trigger) => trigger.action || trigger.value || trigger.trigger;
const followWeight = (value) => typeof value === 'boolean' ? Number(value) : finite(value, 1);

function color(value, fallback = '#ffffff') {
  if (/^#[\da-f]{6}$/i.test(value || '')) return value.toLowerCase();
  if (/^#[\da-f]{3}$/i.test(value || '')) return `#${value.slice(1).split('').map((digit) => digit + digit).join('')}`.toLowerCase();
  return fallback;
}

function mixColor(from, to, amount) {
  const a = color(from);
  const b = color(to);
  return `#${[1, 3, 5].map((index) => {
    const first = parseInt(a.slice(index, index + 2), 16);
    const second = parseInt(b.slice(index, index + 2), 16);
    return Math.round(clamp(first + (second - first) * amount, 0, 255)).toString(16).padStart(2, '0');
  }).join('')}`;
}

function ease(name, t) {
  switch (name) {
    case 'easeIn': case 'ease-in': return t * t;
    case 'easeOut': case 'ease-out': return 1 - (1 - t) ** 2;
    case 'easeInOut': case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    case 'bounce': {
      const n = 7.5625;
      const d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) return n * (t - 1.5 / d) ** 2 + 0.75;
      if (t < 2.5 / d) return n * (t - 2.25 / d) ** 2 + 0.9375;
      return n * (t - 2.625 / d) ** 2 + 0.984375;
    }
    case 'elastic': return t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
    default: return t;
  }
}

function normalizeObjects(objects) {
  const keys = new Set();
  return clone(objects).map((object, index) => {
    let key = object._key ?? object.id ?? index;
    if (keys.has(key)) key = `object-${index}`;
    while (keys.has(key)) key = `${key}-next`;
    keys.add(key);
    return {
      ...object,
      _key: key,
      groups: [...new Set((Array.isArray(object.groups) ? object.groups : []).filter((group) => Number.isInteger(group) && group > 0))],
      x: finite(object.x), y: finite(object.y),
      rotation: finite(object.rotation),
      opacity: clamp(finite(object.opacity, 1), 0, 1),
      active: object.active !== false,
      visible: object.visible !== false,
    };
  });
}

/** Local group effects and trigger timelines. All persistent state is JSON serializable. */
export class Runtime {
  constructor({ objects = [], onEvent = () => {} } = {}) {
    this.source = normalizeObjects(objects);
    this.onEvent = typeof onEvent === 'function' ? onEvent : () => {};
    this.reset();
  }

  reset() {
    this.objects = clone(this.source);
    this.time = 0;
    this.camera = { zoom: 1, rotation: 0, offsetX: 0, offsetY: 0, staticX: null, staticY: null };
    this.backgroundColor = '#16244c';
    this.groundColor = '#255280';
    this.counters = {};
    this.activated = new Set();
    this.touching = new Set();
    this.queue = [];
    this.animations = [];
    this.follow = [];
    this.sequence = 0;
    this.initialScan = true;
    this.limitHits = 0;
    this.players = [];
    this.eventBudget = MAX_EVENTS;
    this.draining = false;
    this.reindex();
  }

  reindex() {
    this.byKey = new Map(this.objects.map((object) => [object._key, object]));
  }

  targets(trigger) {
    if (trigger.targetId !== undefined && trigger.targetId !== '') {
      return this.objects.filter((object) => String(object.id ?? object._key) === String(trigger.targetId));
    }
    const group = trigger.targetGroup;
    return Number.isInteger(group) && group > 0 ? this.objects.filter((object) => object.groups.includes(group)) : [];
  }

  enqueue(trigger, playerIndex = 0, depth = 0, due = this.time) {
    if (depth > MAX_SPAWN_DEPTH || this.queue.length >= MAX_QUEUE) {
      this.limitHits++;
      return false;
    }
    const saved = clone(trigger);
    const key = saved._key;
    if (saved.once !== false && key !== undefined && this.activated.has(key)) return false;
    if (saved.once !== false && key !== undefined) this.activated.add(key);
    this.queue.push({ trigger: saved, playerIndex, depth, due: due + Math.max(0, finite(saved.delay)), sequence: this.sequence++ });
    this.queue.sort((a, b) => a.due - b.due || a.sequence - b.sequence);
    return true;
  }

  activate(trigger, { player, players = [] } = {}) {
    if (!trigger || trigger.active === false) return false;
    if (players.length) this.players = players;
    const playerIndex = Math.max(0, this.players.indexOf(player));
    const accepted = this.enqueue(trigger, playerIndex);
    if (!this.draining) {
      this.eventBudget = MAX_EVENTS;
      this.drain(this.time);
    }
    return accepted;
  }

  autoActivate() {
    const touched = new Set();
    for (const object of this.objects) {
      if (object.type !== 'trigger' || object.active === false || object.spawnTriggered || object.spawnOnly) continue;
      if (object.once !== false && this.activated.has(object._key)) continue;
      for (let index = 0; index < this.players.length; index++) {
        const player = this.players[index];
        if (!player) continue;
        let hits;
        if (object.touchTriggered) {
          const half = player.mini ? 9 : 16;
          hits = player.x + half > object.x && player.x - half < object.x + finite(object.w, 32)
            && player.y + half > object.y && player.y - half < object.y + finite(object.h, 32);
          if (hits) touched.add(`${object._key}:${index}`);
          hits = hits && !this.touching.has(`${object._key}:${index}`);
        } else {
          const previous = finite(player.prevX, player.x);
          hits = previous < object.x && player.x >= object.x || previous > object.x && player.x <= object.x
            || this.initialScan && player.x >= object.x;
        }
        if (hits) this.enqueue(object, index);
      }
    }
    this.touching = touched;
    this.initialScan = false;
  }

  step(dt, { players = [] } = {}) {
    dt = Math.max(0, finite(dt));
    this.players = players;
    this.eventBudget = MAX_EVENTS;
    this.autoActivate();
    const end = this.time + dt;
    this.drain(this.time);
    while (this.queue.length && this.queue[0].due <= end && this.eventBudget > 0) {
      const next = Math.max(this.time, this.queue[0].due);
      this.advance(next);
      this.time = next;
      this.drain(next);
    }
    this.advance(end);
    this.time = end;
    this.advanceFollow();
  }

  drain(until) {
    this.draining = true;
    try {
      while (this.queue.length && this.queue[0].due <= until && this.eventBudget > 0) {
        const event = this.queue.shift();
        this.eventBudget--;
        this.execute(event);
      }
      if (this.queue.length && this.queue[0].due <= until && this.eventBudget <= 0) {
        // Discard only the over-budget immediate branch. Delayed independent work survives.
        this.queue = this.queue.filter((event) => event.due > until);
        this.limitHits++;
      }
    } finally {
      this.draining = false;
    }
  }

  spawn(group, event) {
    if (!Number.isInteger(group) || group <= 0) return;
    for (const object of this.objects) {
      if (object.type === 'trigger' && object.active !== false && object.groups.includes(group)) {
        this.enqueue(object, event.playerIndex, event.depth + 1);
      }
    }
  }

  animate(animation, duration, easing = 'linear') {
    duration = Math.max(0, finite(duration));
    const record = { ...animation, start: this.time, end: this.time + duration, easing, last: 0 };
    if (record.track) this.animations = this.animations.filter((current) => current.track !== record.track);
    if (duration === 0) this.applyAnimation(record, 1);
    else this.animations.push(record);
  }

  colorTargets(trigger) {
    if (trigger.colorTarget === 'ground') return [{ scope: 'runtime', property: 'groundColor', track: 'groundColor' }];
    if (trigger.colorTarget === 'background' || trigger.colorTarget !== 'group' && !trigger.targetGroup && !trigger.targetId) {
      return [{ scope: 'runtime', property: 'backgroundColor', track: 'backgroundColor' }];
    }
    return this.targets(trigger).map((object) => ({ scope: 'object', key: object._key, property: 'color', track: `color:${object._key}` }));
  }

  owner(animation) {
    return animation.scope === 'camera' ? this.camera : animation.scope === 'runtime' ? this : this.byKey.get(animation.key);
  }

  execute(event) {
    const trigger = event.trigger;
    const action = kind(trigger);
    const targets = this.targets(trigger);
    const duration = Math.max(0, finite(trigger.duration));
    const payload = { targetPlayer: trigger.targetPlayer || 'both', playerIndex: event.playerIndex };
    switch (action) {
      case 'move':
        this.animate({ kind: 'move', keys: targets.map((object) => object._key), x: finite(trigger.moveX), y: finite(trigger.moveY) }, duration, trigger.easing);
        break;
      case 'rotate': {
        const centerObjects = trigger.centerGroup ? this.targets({ targetGroup: trigger.centerGroup }) : targets;
        const centerX = finite(trigger.centerX, centerObjects.length ? centerObjects.reduce((total, object) => total + object.x + finite(object.w, 32) / 2, 0) / centerObjects.length : 0);
        const centerY = finite(trigger.centerY, centerObjects.length ? centerObjects.reduce((total, object) => total + object.y + finite(object.h, 32) / 2, 0) / centerObjects.length : 0);
        this.animate({ kind: 'rotate', keys: targets.map((object) => object._key), degrees: finite(trigger.rotation), centerX, centerY }, duration, trigger.easing);
        break;
      }
      case 'alpha':
        for (const object of targets) this.animate({ kind: 'number', scope: 'object', key: object._key, property: 'opacity', from: object.opacity, to: clamp(finite(trigger.opacity, 1), 0, 1), track: `opacity:${object._key}` }, duration, trigger.easing);
        break;
      case 'color':
        for (const target of this.colorTargets(trigger)) this.animate({ ...target, kind: 'color', from: color(this.owner(target)?.[target.property]), to: color(trigger.color) }, duration, trigger.easing);
        break;
      case 'pulse': {
        const total = duration || 1;
        const fadeIn = Math.max(0, finite(trigger.fadeIn, total / 4));
        const hold = Math.max(0, finite(trigger.hold, total / 2));
        const fadeOut = Math.max(0, finite(trigger.fadeOut, total / 4));
        for (const target of this.colorTargets(trigger)) this.animate({ ...target, kind: 'pulse', from: color(this.owner(target)?.[target.property]), to: color(trigger.color), fadeIn, hold, fadeOut }, fadeIn + hold + fadeOut, 'linear');
        break;
      }
      case 'toggle':
        for (const object of targets) {
          object.active = trigger.enabled !== undefined ? !!trigger.enabled : !object.active;
          object.visible = object.active;
        }
        break;
      case 'spawn':
        this.spawn(trigger.spawnGroup ?? trigger.targetGroup, event);
        break;
      case 'pickup': {
        const id = String(trigger.counterId ?? 1);
        const previous = finite(this.counters[id]);
        const amount = finite(trigger.count, 1);
        let next = previous;
        if (trigger.operation === 'set') next = amount;
        else if (trigger.operation === 'multiply') next = previous * amount;
        else if (trigger.operation === 'divide') next = amount !== 0 ? previous / amount : previous;
        else next = previous + amount;
        this.counters[id] = finite(next, previous);
        if (Number.isFinite(trigger.targetCount) && this.counters[id] >= trigger.targetCount) this.spawn(trigger.spawnGroup ?? trigger.targetGroup, event);
        break;
      }
      case 'follow': {
        const index = ['two', 'player2'].includes(trigger.followPlayer) ? 1 : 0;
        const player = this.players[index];
        const keys = targets.map((object) => object._key);
        // A new follow instruction replaces previous bindings for those same objects.
        const replaced = new Set(keys);
        this.follow = this.follow.map((binding) => ({ ...binding, keys: binding.keys.filter((key) => !replaced.has(key)) })).filter((binding) => binding.keys.length);
        this.follow.push({ keys, playerIndex: index, x: followWeight(trigger.followX), y: followWeight(trigger.followY), lastX: player ? finite(player.x) : null, lastY: player ? finite(player.y) : null, until: duration ? this.time + duration : null });
        break;
      }
      case 'camera':
        for (const [field, value] of Object.entries({ zoom: trigger.zoom, rotation: trigger.cameraRotation, offsetX: trigger.cameraX, offsetY: trigger.cameraY, staticX: trigger.staticX, staticY: trigger.staticY })) {
          if (!Number.isFinite(value)) continue;
          this.animate({ kind: 'number', scope: 'camera', property: field, from: finite(this.camera[field], value), to: field === 'zoom' ? clamp(value, 0.1, 5) : value, track: `camera:${field}` }, duration, trigger.easing);
        }
        break;
      case 'gravity': {
        const gravityValue = trigger.gravityValue ?? 'toggle';
        this.onEvent({ type: 'gravity', ...payload, gravityValue, value: gravityValue });
        break;
      }
      case 'sfx': {
        const soundId = trigger.soundId || 'jump';
        this.onEvent({ type: 'sfx', ...payload, soundId, channel: trigger.channel ?? trigger.soundChannel ?? soundId, volume: clamp(finite(trigger.volume, 1), 0, 1) });
        break;
      }
      case 'stop-sfx': this.onEvent({ type: 'stop-sfx', ...payload, soundId: trigger.soundId || null, channel: trigger.channel ?? trigger.soundChannel ?? trigger.soundId ?? null }); break;
      case 'end': this.onEvent({ type: 'end', ...payload }); break;
      default: break;
    }
  }

  applyAnimation(animation, progress) {
    const amount = ease(animation.easing, progress);
    if (animation.kind === 'move') {
      const delta = amount - animation.last;
      for (const key of animation.keys) {
        const object = this.byKey.get(key);
        if (object) { object.x = add(object.x, animation.x * delta); object.y = add(object.y, animation.y * delta); }
      }
    } else if (animation.kind === 'rotate') {
      const degrees = animation.degrees * (amount - animation.last);
      const radians = (degrees % 360) * Math.PI / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      for (const key of animation.keys) {
        const object = this.byKey.get(key);
        if (!object) continue;
        const halfW = finite(object.w, 32) / 2;
        const halfH = finite(object.h, 32) / 2;
        const x = object.x + halfW - animation.centerX;
        const y = object.y + halfH - animation.centerY;
        object.x = animation.centerX + x * cos - y * sin - halfW;
        object.y = animation.centerY + x * sin + y * cos - halfH;
        object.rotation = add(object.rotation, degrees);
      }
    } else {
      const owner = this.owner(animation);
      if (owner) {
        if (animation.kind === 'number') {
          let value = finite(animation.from * (1 - amount) + animation.to * amount, animation.to);
          if (animation.property === 'opacity') value = clamp(value, 0, 1);
          if (animation.scope === 'camera' && animation.property === 'zoom') value = clamp(value, 0.1, 5);
          owner[animation.property] = value;
        }
        else if (animation.kind === 'color') owner[animation.property] = mixColor(animation.from, animation.to, amount);
        else if (animation.kind === 'pulse') {
          const elapsed = (animation.end - animation.start) * progress;
          const strength = elapsed < animation.fadeIn ? elapsed / animation.fadeIn
            : elapsed < animation.fadeIn + animation.hold ? 1
            : animation.fadeOut > 0 ? 1 - (elapsed - animation.fadeIn - animation.hold) / animation.fadeOut : 0;
          owner[animation.property] = mixColor(animation.from, animation.to, clamp(strength, 0, 1));
        }
      }
    }
    animation.last = amount;
  }

  advance(time) {
    for (const animation of this.animations) {
      const progress = clamp((time - animation.start) / (animation.end - animation.start), 0, 1);
      this.applyAnimation(animation, progress);
    }
    this.animations = this.animations.filter((animation) => time < animation.end);
  }

  advanceFollow() {
    for (const binding of this.follow) {
      const player = this.players[binding.playerIndex];
      if (!player) continue;
      const x = finite(player.x);
      const y = finite(player.y);
      if (binding.lastX !== null && binding.lastY !== null) {
        for (const key of binding.keys) {
          const object = this.byKey.get(key);
          if (object) { object.x = add(object.x, (x - binding.lastX) * binding.x); object.y = add(object.y, (y - binding.lastY) * binding.y); }
        }
      }
      binding.lastX = x;
      binding.lastY = y;
    }
    this.follow = this.follow.filter((binding) => binding.until === null || this.time < binding.until);
  }

  snapshot() {
    return clone({ version: 1, time: this.time, objects: this.objects, camera: this.camera, backgroundColor: this.backgroundColor, groundColor: this.groundColor, counters: this.counters, activated: [...this.activated], touching: [...this.touching], queue: this.queue, animations: this.animations, follow: this.follow, sequence: this.sequence, initialScan: this.initialScan, limitHits: this.limitHits });
  }

  restore(snapshot) {
    if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.objects)) throw new Error('Invalid trigger runtime checkpoint.');
    const saved = clone(snapshot);
    this.time = saved.time;
    this.objects = saved.objects;
    this.camera = saved.camera;
    this.backgroundColor = saved.backgroundColor;
    this.groundColor = saved.groundColor;
    this.counters = saved.counters;
    this.activated = new Set(saved.activated);
    this.touching = new Set(saved.touching);
    this.queue = saved.queue;
    this.animations = saved.animations;
    this.follow = saved.follow;
    this.sequence = saved.sequence;
    this.initialScan = saved.initialScan;
    this.limitHits = saved.limitHits;
    this.players = [];
    this.eventBudget = MAX_EVENTS;
    this.draining = false;
    this.reindex();
  }
}
