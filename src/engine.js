import { Runtime } from './runtime.js';
import { drawCubeIcon } from './icons.js';

export const GAME_MODES = ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider', 'swing'];
export const SPEED_TIERS = { slow: 220, normal: 310, fast: 380, faster: 460, fastest: 560 };

const WIDTH = 960;
const HEIGHT = 600;
const FLOOR = 480;
const CEILING = 80;
const FIXED_STEP = 1 / 120;
const GRAVITY = 1900;
const JUMP = 650;
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (value, target, amount) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);

function rotatePoint(x, y, cx, cy, degrees) {
  const angle = degrees * Math.PI / 180;
  return [cx + (x - cx) * Math.cos(angle) - (y - cy) * Math.sin(angle), cy + (x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle)];
}

function objectBox(object, fallback = 40) {
  return { x: object.x, y: object.y, w: object.w || fallback, h: object.h || fallback };
}

function rgba(hex, alpha) {
  const value = /^#[\da-f]{6}$/i.test(hex || '') ? hex : '#9060ff';
  return `rgba(${parseInt(value.slice(1, 3), 16)},${parseInt(value.slice(3, 5), 16)},${parseInt(value.slice(5, 7), 16)},${alpha})`;
}

function shade(hex, amount) {
  const value = /^#[\da-f]{6}$/i.test(hex || '') ? hex : '#2474de';
  return `rgb(${[1, 3, 5].map((index) => Math.round(parseInt(value.slice(index, index + 2), 16) * amount)).join(',')})`;
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function triangleHitsRect(points, rect) {
  const corners = [[rect.x, rect.y], [rect.x + rect.w, rect.y], [rect.x + rect.w, rect.y + rect.h], [rect.x, rect.y + rect.h]];
  const axes = [[1, 0], [0, 1]];
  for (let index = 0; index < points.length; index++) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    axes.push([-(b[1] - a[1]), b[0] - a[0]]);
  }
  for (const [ax, ay] of axes) {
    const triangle = points.map(([x, y]) => x * ax + y * ay);
    const box = corners.map(([x, y]) => x * ax + y * ay);
    if (Math.max(...triangle) <= Math.min(...box) || Math.max(...box) <= Math.min(...triangle)) return false;
  }
  return true;
}

function spikePoints(object) {
  const { x, y } = object;
  const w = object.w || 32;
  const h = object.h || 32;
  const points = object.value === 'down'
    ? [[x, y], [x + w, y], [x + w / 2, y + h]]
    : [[x, y + h], [x + w / 2, y], [x + w, y + h]];
  return object.rotation ? points.map(([px, py]) => rotatePoint(px, py, x + w / 2, y + h / 2, object.rotation)) : points;
}

/** A deterministic, entirely local runner. World coordinates are independent of canvas size. */
export class GameEngine {
  constructor({ canvas, audio, onUpdate = () => {}, onFinish = () => {}, onExit = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext?.('2d') || null;
    this.audio = audio;
    this.onUpdate = onUpdate;
    this.onFinish = onFinish;
    this.onExit = onExit;
    this.input = { held: false, left: false, right: false };
    this.state = { status: 'idle', progress: 0, bestProgress: 0, attempts: 0, mode: 'cube', practice: false, coins: 0, checkpointCount: 0, time: 0, playTime: 0, jumps: 0, deaths: 0, platformer: false };
    this.particles = [];
    this.trail = [];
    this.checkpoints = [];
    this.activated = new Set();
    this.collected = new Set();
    this.listeners = [];
    this.accumulator = 0;
    this.camera = 0;
    this.cameraY = 0;
    this.mirrored = false;
    this.nativeCheckpoint = null;
    this.frame = null;
    this.lastFrame = null;
    this.destroyed = false;
    this.pressed = false;
    this.pressBuffer = 0;
    this.canvasPointerId = null;
    this.notification = null;
    this.bindInput();
    this.resize();
    if (typeof ResizeObserver !== 'undefined' && canvas) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
    }
  }

  listen(target, name, callback, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(name, callback, options);
    this.listeners.push(() => target.removeEventListener(name, callback, options));
  }

  bindInput() {
    if (typeof window === 'undefined') return;
    const movementKeys = ['Space', 'ArrowUp', 'KeyW', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'];
    this.listen(window, 'keydown', (event) => {
      if (this.destroyed || this.state.status === 'idle') return;
      if (document.querySelector?.('dialog[open]')) return;
      if (event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
      if (movementKeys.includes(event.code)) event.preventDefault();
      if (['Space', 'ArrowUp', 'KeyW'].includes(event.code) && !event.repeat) this.press();
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') this.input.left = true;
      if (event.code === 'ArrowRight' || event.code === 'KeyD') this.input.right = true;
      if (event.repeat) return;
      if (event.code === 'KeyP') this.state.status === 'paused' ? this.resume() : this.pause();
      if (event.code === 'KeyR') this.restart();
      if (event.code === 'KeyC' && this.state.practice) this.checkpoint();
      if (event.code === 'KeyX' && this.state.practice) this.removeCheckpoint();
      if (event.code === 'Escape') {
        event.preventDefault();
        if (this.state.status === 'paused' || this.state.status === 'complete') this.onExit();
        else this.pause();
      }
    });
    this.listen(window, 'keyup', (event) => {
      if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) this.release();
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') this.input.left = false;
      if (event.code === 'ArrowRight' || event.code === 'KeyD') this.input.right = false;
    });
    this.listen(this.canvas, 'pointerdown', (event) => {
      if (event.button > 0) return;
      if (this.canvasPointerId !== null && this.canvasPointerId !== event.pointerId) return;
      event.preventDefault();
      this.canvasPointerId = event.pointerId;
      this.canvas.focus?.({ preventScroll: true });
      this.press();
    });
    const releaseCanvasPointer = (event) => {
      if (this.canvasPointerId === null || event.pointerId !== this.canvasPointerId) return;
      this.canvasPointerId = null;
      this.release();
    };
    this.listen(window, 'pointerup', releaseCanvasPointer);
    this.listen(window, 'pointercancel', releaseCanvasPointer);
    this.listen(window, 'blur', () => {
      this.canvasPointerId = null;
      this.release();
      this.input.left = false;
      this.input.right = false;
      this.pause();
    });
    this.listen(document, 'visibilitychange', () => {
      if (document.hidden) this.pause();
    });
    this.listen(window, 'resize', () => this.resize());
    if (this.canvas) {
      this.canvas.tabIndex = 0;
      this.canvas.style.touchAction = 'none';
    }
  }

  resize() {
    if (!this.canvas || !this.ctx) return;
    const ratio = clamp(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 1, 2);
    if (this.canvas.width !== WIDTH * ratio || this.canvas.height !== HEIGHT * ratio) {
      this.canvas.width = WIDTH * ratio;
      this.canvas.height = HEIGHT * ratio;
    }
    this.dpr = ratio;
    this.render();
  }

  get objects() { return this.runtime?.objects || this.level?.objects || []; }

  start(level, { practice = false, platformer = !!level?.platformer, cosmetics = {}, settings = {}, testMode = false, startPositionId = null } = {}) {
    if (!level || !Number.isFinite(level.length) || level.length <= 0) throw new Error('A level needs a positive length.');
    this.destroyed = false;
    this.level = { ...level, objects: (level.objects || []).map((object, index) => ({ ...object, _key: object.id ?? index })) };
    this.runtime = new Runtime({ objects: this.level.objects, onEvent: (event) => this.runtimeEvent(event) });
    this.testMode = !!testMode;
    this.startPositionId = this.testMode ? startPositionId : null;
    this.cosmetics = { primary: '#b8ff65', secondary: '#9b7bff', icon: 0, trail: 'spark', ...cosmetics };
    this.settings = { music: true, sfx: true, reducedMotion: false, autoCheckpoint: true, ...settings };
    this.audio?.setSettings?.(this.settings);
    this.state = { status: 'playing', progress: 0, bestProgress: 0, attempts: 1, mode: 'cube', practice: !!practice, coins: 0, checkpointCount: 0, nativeCheckpointCount: 0, time: 0, playTime: 0, jumps: 0, deaths: 0, platformer: !!platformer, testMode: this.testMode, dual: false, mini: false, speed: level.speed || 310, gravity: 1, direction: 1, mirrored: false, jetpack: false, player: null };
    this.checkpoints = [];
    this.nativeCheckpoint = null;
    this.finishReported = false;
    this.accumulator = 0;
    this.lastFrame = null;
    this.emitTimer = 0;
    this.resetAttempt(false);
    this.audio?.startMusic?.(level.bpm || 128);
    this.emit();
    this.ensureLoop();
    this.render();
    return this;
  }

  makePlayer() {
    return { x: 80, y: FLOOR - 16, prevX: 80, prevY: FLOOR - 16, vx: 0, vy: 0, speed: this.level?.speed || 310, gravity: 1, gravityScale: 1, direction: 1, mode: 'cube', mini: false, grounded: true, rotation: 0, robotHold: 0, cooldown: 0, dash: null, surfaceId: null };
  }

  resetAttempt(useCheckpoint = true) {
    this.runtime?.reset();
    if (this.runtime) {
      this.runtime.backgroundColor = this.level.backgroundColor || this.level.color || '#2474de';
      this.runtime.groundColor = this.level.groundColor || this.level.color || '#2474de';
    }
    this.player = this.makePlayer();
    this.player2 = null;
    this.speed = this.level.speed || 310;
    this.dual = false;
    this.mirrored = false;
    this.activated.clear();
    this.collected.clear();
    this.trail = [];
    this.particles = [];
    this.attemptTime = 0;
    this.pressBuffer = 0;
    this.pressed = false;
    this.deathTimer = 0;
    this.autoCheckpointTimer = 0;
    this.respawnTime = 0;
    const start = this.testMode && this.objects.find((object) => object.type === 'startpos' && object.id === this.startPositionId);
    if (start) {
      this.player.x = start.x;
      this.player.y = start.y ?? FLOOR - 16;
      this.player.prevX = this.player.x;
      this.player.prevY = this.player.y;
      this.player.mode = GAME_MODES.includes(start.mode || start.value) ? (start.mode || start.value) : 'cube';
      this.player.mini = !!start.mini;
      this.player.gravity = start.gravity === -1 || start.gravity === 'reverse' ? -1 : 1;
      this.player.direction = start.direction === -1 || start.direction === 'left' ? -1 : 1;
      this.player.grounded = this.player.y >= FLOOR - (this.player.mini ? 10 : 16) || this.player.y <= CEILING + (this.player.mini ? 10 : 16);
      this.speed = Number(start.speed) || SPEED_TIERS[start.speed] || this.speed;
      this.player.speed = this.speed;
      if (start.dual) this.setDual(true);
    }
    const checkpoint = useCheckpoint && (this.state.practice ? this.checkpoints.at(-1) : this.state.platformer ? this.nativeCheckpoint : null);
    if (checkpoint) {
      this.player = { ...checkpoint.player };
      this.player.prevX = this.player.x;
      this.player.prevY = this.player.y;
      this.player2 = checkpoint.player2 ? { ...checkpoint.player2 } : null;
      this.speed = checkpoint.speed;
      this.dual = checkpoint.dual;
      this.activated = new Set(checkpoint.activated);
      this.collected = new Set(checkpoint.collected);
      this.attemptTime = checkpoint.attemptTime;
      this.mirrored = checkpoint.mirrored || false;
      this.runtime?.restore(checkpoint.runtime);
      if (checkpoint.audio) this.audio?.restore?.(checkpoint.audio);
      this.notification = { text: 'CHECKPOINT RESTORED', time: 1.15 };
    }
    this.camera = Math.max(0, this.player.x - 230);
    this.cameraY = 0;
    this.state.status = 'playing';
    this.syncState();
    if (useCheckpoint) this.audio?.startMusic?.(this.level.bpm || 128, { restart: !checkpoint });
  }

  press() {
    if (this.state.status !== 'playing') return;
    this.input.held = true;
    this.pressed = true;
    this.pressBuffer = 0.14;
  }

  release() {
    this.input.held = false;
  }

  pause() {
    if (this.state.status !== 'playing' && this.state.status !== 'dead') return;
    this.prePauseStatus = this.state.status;
    this.state.status = 'paused';
    this.release();
    this.audio?.stopMusic?.();
    this.emit();
    this.render();
  }

  resume() {
    if (this.state.status !== 'paused') return;
    this.state.status = this.prePauseStatus === 'dead' ? 'dead' : 'playing';
    this.lastFrame = null;
    this.accumulator = 0;
    this.audio?.startMusic?.(this.level.bpm || 128, { restart: false });
    this.emit();
    this.ensureLoop();
  }

  restart() {
    if (!this.level || this.state.status === 'idle') return;
    this.state.attempts++;
    this.finishReported = false;
    this.resetAttempt(true);
    this.audio?.startMusic?.(this.level.bpm || 128, { restart: !(this.state.practice ? this.checkpoints.length : this.state.platformer && this.nativeCheckpoint) });
    this.emit();
    this.ensureLoop();
  }

  setPractice(enabled) {
    this.state.practice = !!enabled;
    this.checkpoints = [];
    this.nativeCheckpoint = null;
    this.state.checkpointCount = 0;
    this.state.attempts++;
    this.finishReported = false;
    this.resetAttempt(false);
    this.notification = { text: enabled ? 'PRACTICE MODE · C TO CHECKPOINT' : 'NORMAL MODE', time: 2 };
    this.audio?.startMusic?.(this.level.bpm || 128);
    this.emit();
    this.ensureLoop();
  }

  checkpoint(automatic = false) {
    if (!this.state.practice || this.state.status !== 'playing') return false;
    const last = this.checkpoints.at(-1);
    if (last && Math.abs(last.player.x - this.player.x) < 16 && Math.abs(last.player.y - this.player.y) < 16) return false;
    this.checkpoints.push(this.checkpointSnapshot());
    if (this.checkpoints.length > 60) this.checkpoints.shift();
    this.state.checkpointCount = this.checkpoints.length;
    this.autoCheckpointTimer = 0;
    if (!automatic) this.notification = { text: 'CHECKPOINT SAVED', time: 1.25 };
    this.emit();
    return true;
  }

  checkpointSnapshot() {
    return {
      player: structuredClone(this.player), player2: this.player2 ? structuredClone(this.player2) : null,
      speed: this.speed, dual: this.dual, mirrored: this.mirrored,
      activated: [...this.activated], collected: [...this.collected], attemptTime: this.attemptTime,
      runtime: this.runtime?.snapshot(), audio: this.audio?.snapshot?.(),
    };
  }

  nativeCheckpointAt(object) {
    if (!this.state.platformer || this.state.practice || this.activated.has(`checkpoint:${object._key}`)) return;
    this.activated.add(`checkpoint:${object._key}`);
    this.state.nativeCheckpointCount++;
    this.nativeCheckpoint = this.checkpointSnapshot();
    this.notification = { text: 'CHECKPOINT REACHED', time: 1.5 };
    this.burst(object.x + (object.w || 32) / 2, object.y, '#6dffcf', 16);
    this.emit();
  }

  routedPlayers(object, collisionPlayer = this.player) {
    const players = this.dual && this.player2 ? [this.player, this.player2] : [this.player];
    const target = object.targetPlayer ?? object.player;
    if (target === 'both' || target === 'all') return players;
    if (target === 'one' || target === 'player1' || target === 1 || target === '1') return [this.player];
    if (target === 'two' || target === 'player2' || target === 2 || target === '2') return this.player2 ? [this.player2] : [];
    return [collisionPlayer];
  }

  runtimeEvent(event) {
    if (!event || !this.player) return;
    if (event.type === 'sfx') this.audio?.playSfx?.(event.soundId, { volume: event.volume, channel: event.channel ?? event.soundChannel ?? event.soundId });
    else if (event.type === 'stop-sfx' || event.type === 'stopSfx') this.audio?.stopSfx?.(event.channel ?? event.soundChannel ?? event.soundId);
    else if (event.type === 'end' || event.type === 'finish') this.complete();
    else if (event.type === 'gravity') {
      const players = this.routedPlayers(event, event.playerIndex === 1 ? this.player2 || this.player : this.player);
      const value = event.gravityValue;
      for (const player of players) {
        if (value === 'normal') player.gravity = 1;
        else if (value === 'reverse') player.gravity = -1;
        else if (value === 'toggle') player.gravity *= -1;
        else if (Number.isFinite(Number(value))) {
          player.gravity = Number(value) < 0 ? -1 : 1;
          player.gravityScale = Math.abs(Number(value));
        }
        player.grounded = false;
      }
    } else if (event.type === 'teleport') {
      for (const player of this.routedPlayers(event)) this.teleportPlayer(player, event);
    } else if (event.type === 'direction') {
      for (const player of this.routedPlayers(event)) player.direction = event.direction === -1 || event.direction === 'left' ? -1 : 1;
    }
  }

  setDual(enabled) {
    if (enabled && !this.dual) this.player2 = {
      ...structuredClone(this.player), y: FLOOR + CEILING - this.player.y,
      prevY: FLOOR + CEILING - this.player.y, gravity: -this.player.gravity, vy: -this.player.vy,
    };
    if (!enabled) this.player2 = null;
    this.dual = enabled;
  }

  removeCheckpoint() {
    if (!this.state.practice || !this.checkpoints.length) return false;
    this.checkpoints.pop();
    this.state.checkpointCount = this.checkpoints.length;
    this.notification = { text: 'CHECKPOINT REMOVED', time: 1.25 };
    this.emit();
    return true;
  }

  ensureLoop() {
    if (this.frame !== null || this.destroyed || typeof requestAnimationFrame === 'undefined') return;
    const tick = (now) => {
      this.frame = null;
      if (this.destroyed) return;
      const delta = this.lastFrame === null ? 0 : Math.min((now - this.lastFrame) / 1000, 0.1);
      this.lastFrame = now;
      this.step(delta);
      this.render();
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  /** Advances exact 120 Hz ticks. Useful for reproducible headless gameplay checks. */
  step(deltaSeconds) {
    if (!this.level || this.destroyed || !Number.isFinite(deltaSeconds) || deltaSeconds < 0) return;
    if (this.state.status === 'paused' || this.state.status === 'idle') {
      this.accumulator = 0;
      return;
    }
    this.accumulator += Math.min(deltaSeconds, 2);
    while (this.accumulator + 1e-9 >= FIXED_STEP) {
      this.accumulator -= FIXED_STEP;
      if (this.state.status === 'playing') this.updatePhysics(FIXED_STEP);
      else if (this.state.status === 'dead') {
        this.deathTimer -= FIXED_STEP;
        if (this.deathTimer <= 0) {
          this.state.attempts++;
          this.resetAttempt(true);
          this.emit();
        }
      }
      this.updateParticles(FIXED_STEP);
      if (this.notification) {
        this.notification.time -= FIXED_STEP;
        if (this.notification.time <= 0) this.notification = null;
      }
      this.emitTimer += FIXED_STEP;
      if (this.emitTimer >= 0.08) {
        this.emitTimer = 0;
        this.emit();
      }
    }
  }

  updatePhysics(dt = FIXED_STEP) {
    if (this.state.status !== 'playing') return;
    this.state.time += dt;
    this.state.playTime += dt;
    this.attemptTime += dt;
    this.respawnTime += dt;
    this.autoCheckpointTimer += dt;
    const wantsJump = this.pressed || this.pressBuffer > 0;
    this.pressBuffer = Math.max(0, this.pressBuffer - dt);
    const players = this.dual && this.player2 ? [this.player, this.player2] : [this.player];
    const oldPositions = new Map(this.objects.map((object) => [object._key, [object.x, object.y]]));
    this.runtime?.step(dt, { players });
    if (this.state.status !== 'playing') return;
    for (const player of players) {
      if (player.grounded && player.surfaceId !== null) {
        const surface = this.objects.find((object) => object._key === player.surfaceId && object.active !== false);
        const previous = oldPositions.get(player.surfaceId);
        if (surface && previous) { player.x += surface.x - previous[0]; player.y += surface.y - previous[1]; }
      }
      this.activatePortals(player);
    }
    const activePlayers = this.dual && this.player2 ? [this.player, this.player2] : [this.player];
    let jumped = false;
    for (const player of activePlayers) {
      if (this.state.status !== 'playing') break;
      jumped = this.movePlayer(player, dt, wantsJump) || jumped;
    }
    if (jumped) {
      this.state.jumps++;
      this.audio?.jump?.();
      this.pressBuffer = 0;
    }
    this.pressed = false;
    if (this.state.status !== 'playing') return;
    this.collectCoins();
    const camera = this.runtime?.camera || {};
    this.camera = camera.staticX !== null && camera.staticX !== undefined ? Number(camera.staticX) - WIDTH / 2 : Math.max(0, this.player.x - (this.state.platformer ? 350 : 230));
    this.camera += Number(camera.offsetX) || 0;
    this.cameraY = (camera.staticY !== null && camera.staticY !== undefined ? Number(camera.staticY) - HEIGHT / 2 : 0) + (Number(camera.offsetY) || 0);
    this.syncState();
    if (this.state.practice && this.settings.autoCheckpoint && this.autoCheckpointTimer >= 2.5 && this.safeCheckpoint()) this.checkpoint(true);
    if (this.player.x >= this.level.length) this.complete();
    if (!this.settings.reducedMotion && this.cosmetics.trail !== 'none' && this.state.time % 0.025 < dt) {
      for (const player of activePlayers) this.trail.push({ x: player.x, y: player.y, size: player.mini ? 10 : 16, life: 0.34, mode: player.mode, secondary: player === this.player2 });
      if (this.trail.length > 45) this.trail.splice(0, this.trail.length - 45);
    }
  }

  movePlayer(player, dt, wantsJump) {
    player.prevX = player.x;
    player.prevY = player.y;
    player.cooldown = Math.max(0, player.cooldown - dt);
    const half = player.mini ? 10 : 16;
    const mode = player.mode;
    const speed = Number(player.speed) || this.speed;
    for (const object of this.objects) {
      if (object.once !== false || !['orb', 'pad'].includes(object.type)) continue;
      const key = `${object.type}:${object._key}:${player === this.player2 ? 2 : 1}`;
      const touching = object.type === 'orb'
        ? Math.hypot(player.x - object.x, player.y - object.y) < (object.w || 36) / 2 + half + 12
        : overlap({ x: player.x - half - 4, y: player.y - half - 4, w: half * 2 + 8, h: half * 2 + 8 }, { x: object.x, y: object.y - 7, w: object.w || 36, h: object.h || 16 });
      if (!touching) this.activated.delete(key);
    }
    let jumped = false;
    let orb = null;
    if (wantsJump) {
      orb = this.objects.find((object) => object.active !== false && object.type === 'orb' && this.routedPlayers(object, player).includes(player) && Math.hypot(player.x - object.x, player.y - object.y) < (object.w || 36) * 0.5 + half + 8 && !this.activated.has(`orb:${object._key}:${player === this.player2 ? 2 : 1}`));
    }
    if (orb) {
      for (const current of this.routedPlayers(orb, player)) {
        this.applyEffect(current, orb, false);
        this.activated.add(`orb:${orb._key}:${current === this.player2 ? 2 : 1}`);
      }
      this.burst(orb.x, orb.y, this.impulseColor(orb.value), 12);
      jumped = true;
    }
    const jumpScale = player.mini ? 0.82 : 1;
    if (!orb && ['cube', 'robot'].includes(mode) && player.grounded && (wantsJump || this.input.held)) {
      player.vy = -(mode === 'robot' ? 490 : JUMP) * jumpScale * player.gravity;
      player.grounded = false;
      player.robotHold = mode === 'robot' ? 0.22 : 0;
      jumped = true;
    } else if (!orb && mode === 'ball' && wantsJump && player.grounded && player.cooldown <= 0) {
      player.gravity *= -1;
      player.vy = player.gravity * 130;
      player.grounded = false;
      player.cooldown = 0.15;
      jumped = true;
    } else if (!orb && mode === 'ufo' && wantsJump && player.cooldown <= 0) {
      player.vy = -470 * jumpScale * player.gravity;
      player.grounded = false;
      player.cooldown = 0.1;
      jumped = true;
    } else if (!orb && mode === 'spider' && wantsJump && player.grounded && player.cooldown <= 0) {
      player.gravity *= -1;
      const previousY = player.y;
      player.y = this.spiderDestination(player);
      player.prevY = player.y;
      player.vy = 0;
      player.grounded = true;
      player.cooldown = 0.12;
      this.burst(player.x, previousY, this.cosmetics.secondary, 8);
      this.burst(player.x, player.y, this.cosmetics.primary, 8);
      this.spiderBeam = { x: player.x, y1: previousY, y2: player.y, life: 0.14 };
      jumped = true;
    } else if (!orb && mode === 'swing' && wantsJump && player.cooldown <= 0) {
      player.gravity *= -1;
      player.cooldown = 0.1;
      jumped = true;
    }

    if (mode === 'wave') {
      player.vy = (this.input.held ? -1 : 1) * speed * (player.mini ? 1.5 : 1) * player.gravity;
    } else if (mode === 'ship') {
      player.vy += (this.input.held ? -1500 : 1120) * player.gravity * (player.gravityScale ?? 1) * dt;
      player.vy = clamp(player.vy, -440, 440);
    } else if (mode === 'swing') {
      player.vy += 1000 * player.gravity * (player.gravityScale ?? 1) * dt;
      player.vy = clamp(player.vy, -470, 470);
    } else {
      let acceleration = mode === 'ufo' ? 1450 : GRAVITY;
      if (mode === 'robot' && player.robotHold > 0 && this.input.held && player.vy * player.gravity < 0) {
        acceleration = -480;
        player.robotHold -= dt;
      } else if (mode === 'robot') player.robotHold = 0;
      player.vy += acceleration * player.gravity * (player.gravityScale ?? 1) * dt;
      player.vy = clamp(player.vy, -1050, 1050);
    }
    if (this.state.platformer) {
      const direction = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
      const maximum = Number(this.level.platformerSpeed) || speed;
      const acceleration = direction ? (player.grounded ? 2600 : 1900) : (player.grounded ? 3200 : 900);
      player.vx = approach(player.vx, direction * maximum, acceleration * dt);
      if (direction) player.facing = direction;
    } else player.vx = speed * (player.direction || 1);
    if (player.dash) {
      if ((this.input.held || player.dash.remaining > 0) && (player.dash.maximum === null || player.dash.maximum > 0)) {
        const dash = player.dash;
        player.vx = Math.cos(dash.angle) * dash.speed;
        player.vy = Math.sin(dash.angle) * dash.speed;
        dash.remaining -= dt;
        if (dash.maximum !== null) dash.maximum -= dt;
      } else { player.dash = null; player.vy = 0; }
    }
    player.x = Math.max(half, player.x + player.vx * dt);
    player.y += player.vy * dt;
    player.grounded = false;
    player.surfaceId = null;
    if (player.y + half >= FLOOR) {
      player.y = FLOOR - half;
      if (player.vy > 0) player.vy = 0;
      player.grounded = player.gravity === 1;
    }
    if (player.y - half <= CEILING) {
      player.y = CEILING + half;
      if (player.vy < 0) player.vy = 0;
      player.grounded = player.gravity === -1;
    }

    for (const object of this.objects) {
      if (object.active === false) continue;
      const radius = object.type === 'saw' ? Number(object.radius) || (object.w || 48) / 2 : 0;
      if (object.x - radius > player.x + half + 8 || object.x + (radius || object.w || 40) < player.x - half - 8) continue;
      const box = { x: player.x - half, y: player.y - half, w: half * 2, h: half * 2 };
      if (object.type === 'spike') {
        const hurtbox = { x: box.x + 3, y: box.y + 3, w: box.w - 6, h: box.h - 6 };
        if (triangleHitsRect(spikePoints(object), hurtbox)) {
          this.die(player);
          return jumped;
        }
      } else if (object.type === 'saw') {
        const radius = Number(object.radius) || (object.w || 48) / 2;
        const nearestX = clamp(object.x, box.x + 3, box.x + box.w - 3);
        const nearestY = clamp(object.y, box.y + 3, box.y + box.h - 3);
        if (Math.hypot(object.x - nearestX, object.y - nearestY) < radius * 0.85) { this.die(player); return jumped; }
      } else if (object.type === 'slope') {
        if (this.collideSlope(player, object, half)) { this.die(player); return jumped; }
      } else if (object.type === 'checkpoint') {
        if (overlap(box, objectBox(object, 32))) this.nativeCheckpointAt(object);
      } else if (object.type === 'block') {
        const block = { x: object.x, y: object.y, w: object.w || 40, h: object.h || 40 };
        if (!overlap(box, block)) continue;
        const wasAbove = player.prevY + half <= block.y + 2;
        const wasBelow = player.prevY - half >= block.y + block.h - 2;
        if (!['ship', 'wave', 'swing'].includes(mode) && wasAbove && player.vy >= 0) {
          player.y = block.y - half;
          player.vy = 0;
          player.grounded = player.gravity === 1;
          player.surfaceId = player.grounded ? object._key : null;
        } else if (!['ship', 'wave', 'swing'].includes(mode) && wasBelow && player.vy <= 0) {
          player.y = block.y + block.h + half;
          player.vy = 0;
          player.grounded = player.gravity === -1;
          player.surfaceId = player.grounded ? object._key : null;
        } else if (this.state.platformer && player.prevX + half <= block.x + 3) {
          player.x = block.x - half;
          player.vx = 0;
        } else if (this.state.platformer && player.prevX - half >= block.x + block.w - 3) {
          player.x = block.x + block.w + half;
          player.vx = 0;
        } else {
          this.die(player);
          return jumped;
        }
      } else if (object.type === 'pad') {
        const key = `pad:${object._key}:${player === this.player2 ? 2 : 1}`;
        const pad = { x: object.x, y: object.y - 7, w: object.w || 36, h: object.h || 16 };
        if (!this.activated.has(key) && this.routedPlayers(object, player).includes(player) && overlap(box, pad)) {
          for (const current of this.routedPlayers(object, player)) {
            this.activated.add(`pad:${object._key}:${current === this.player2 ? 2 : 1}`);
            this.applyEffect(current, object, true);
          }
          this.burst(object.x + pad.w / 2, object.y, this.impulseColor(object.value), 12);
          jumped = true;
        }
      }
    }
    if (!this.settings.reducedMotion) {
      if (mode === 'cube' || mode === 'robot') {
        if (!player.grounded) player.rotation += (player.vx < 0 ? -1 : 1) * 5.2 * dt * player.gravity;
        else player.rotation = lerp(player.rotation, Math.round(player.rotation / (Math.PI / 2)) * Math.PI / 2, 0.28);
      } else if (mode === 'ball') player.rotation += player.vx / 34 * dt;
      else if (mode === 'ship' || mode === 'wave') player.rotation = Math.atan2(player.vy, Math.max(1, Math.abs(player.vx))) * 0.55;
      else if (mode === 'swing') player.rotation = Math.sin(this.state.time * 3) * 0.16;
      else player.rotation = 0;
    }
    return jumped;
  }

  spiderDestination(player) {
    const half = player.mini ? 10 : 16;
    let destination = player.gravity === 1 ? FLOOR - half : CEILING + half;
    for (const object of this.objects) {
      if (object.active === false || !['block', 'slope'].includes(object.type) || player.x + half <= object.x || player.x - half >= object.x + (object.w || 40)) continue;
      if (player.gravity === 1 && object.y >= player.y + half) destination = Math.min(destination, object.y - half);
      if (player.gravity === -1 && object.y + (object.h || 40) <= player.y - half) destination = Math.max(destination, object.y + (object.h || 40) + half);
    }
    return destination;
  }

  impulseColor(value) {
    return { pink: '#ff64c4', red: '#ff6a66', blue: '#5ee6ff', green: '#aaff6e', black: '#e8e8ff', dash: '#aaff6e', 'gravity-dash': '#ff64c4', spider: '#b391ff', teleport: '#5ee6ff', trigger: '#e8e8ff' }[value] || '#ffe266';
  }

  collideSlope(player, object, half) {
    const { x, y, w, h } = objectBox(object, 96);
    const points = object.value === 'down' ? [[x, y], [x + w, y + h], [x, y + h]] : [[x, y + h], [x + w, y], [x + w, y + h]];
    const box = { x: player.x - half, y: player.y - half, w: half * 2, h: half * 2 };
    if (player.x + half < x || player.x - half > x + w || !triangleHitsRect(points, box)) return false;
    const surface = (px) => y + h * (object.value === 'down' ? clamp((px - x) / w, 0, 1) : 1 - clamp((px - x) / w, 0, 1));
    const top = surface(player.x);
    if (!['ship', 'wave', 'swing'].includes(player.mode) && player.gravity === 1 && player.vy >= 0 && player.prevY + half <= surface(player.prevX) + 10) {
      player.y = top - half;
      player.vy = 0;
      player.grounded = true;
      player.surfaceId = object._key;
      return false;
    }
    if (player.gravity === -1 && player.prevY - half >= y + h - 3 && player.vy <= 0) {
      player.y = y + h + half; player.vy = 0; player.grounded = true; player.surfaceId = object._key;
      return false;
    }
    if (this.state.platformer && !['ship', 'wave', 'swing'].includes(player.mode)) {
      player.x = player.prevX;
      player.vx = 0;
      return false;
    }
    return true;
  }

  applyEffect(player, object, pad = false) {
    const value = object.value || 'yellow';
    if (value === 'dash' || value === 'gravity-dash') {
      if (value === 'gravity-dash') player.gravity *= -1;
      const duration = Number(object.dashDuration ?? object.duration);
      player.dash = { angle: (Number(object.angle) || 0) * Math.PI / 180, speed: Number(object.dashSpeed) || (player.speed || this.speed) * 1.8, remaining: pad ? duration || 0.25 : 0, maximum: Number.isFinite(duration) && duration > 0 ? duration : pad ? 0.25 : null };
      player.grounded = false;
    } else if (value === 'spider') {
      const from = player.y;
      player.gravity *= -1;
      player.y = this.spiderDestination(player); player.prevY = player.y; player.vy = 0; player.grounded = true;
      this.spiderBeam = { x: player.x, y1: from, y2: player.y, life: 0.14 };
    } else if (value === 'teleport') this.teleportPlayer(player, object);
    else if (value === 'trigger') this.runtime?.activate({ ...object, type: 'trigger', value: object.action || object.trigger || 'spawn', action: object.action || object.trigger || 'spawn' }, { player, players: this.dual && this.player2 ? [this.player, this.player2] : [this.player] });
    else this.applyImpulse(player, value, pad);
  }

  teleportPlayer(player, object) {
    let target = object.targetId !== undefined ? this.objects.find((candidate) => candidate.id === object.targetId || String(candidate._key) === String(object.targetId)) : null;
    if (!target && object.targetGroup !== undefined) target = this.objects.find((candidate) => (candidate.groups || []).map(String).includes(String(object.targetGroup)) && candidate._key !== object._key);
    const centered = target && ['orb', 'coin', 'saw', 'startpos'].includes(target.type);
    const targetX = Number.isFinite(Number(object.targetX)) ? Number(object.targetX) : target ? target.x + (centered ? 0 : (target.w || 32) / 2) : null;
    const targetY = Number.isFinite(Number(object.targetY)) ? Number(object.targetY) : target ? target.y + (centered ? 0 : (target.h || 32) / 2) : null;
    if (targetX === null && targetY === null) return false;
    const half = player.mini ? 10 : 16;
    const before = { x: player.x, y: player.y };
    if (targetX !== null) player.x = Math.max(half, targetX);
    if (targetY !== null) player.y = clamp(targetY, CEILING + half, FLOOR - half);
    player.prevX = player.x; player.prevY = player.y;
    if (object.preserveVelocity !== true) { player.vx = 0; player.vy = 0; }
    player.grounded = false;
    player.dash = null;
    if (target?.type === 'portal') this.activated.add(`portal:${target._key}:${player === this.player2 ? 2 : 1}`);
    this.burst(before.x, before.y, '#61e8ff', 12);
    this.burst(player.x, player.y, '#61e8ff', 12);
    return true;
  }

  applyImpulse(player, value, pad) {
    const scale = player.mini ? 0.82 : 1;
    const flipsGravity = value === 'blue' || value === 'green';
    if (flipsGravity) player.gravity *= -1;
    const impulse = { yellow: pad ? 720 : 650, pink: pad ? 560 : 480, red: pad ? 920 : 820, blue: 600, green: 850, black: -850 }[value] || (pad ? 720 : 650);
    player.vy = impulse * player.gravity * scale * (flipsGravity ? 1 : -1);
    player.grounded = false;
  }

  activatePortals(player) {
    const half = player.mini ? 10 : 16;
    for (const object of this.objects) {
      const key = `portal:${object._key}:${player === this.player2 ? 2 : 1}`;
      if (object.active === false || object.type !== 'portal') continue;
      const routed = this.routedPlayers(object, player);
      if (!routed.includes(player)) continue;
      const width = object.w || 32;
      const y = object.y ?? 120;
      const touching = (current) => {
        const radius = current.mini ? 10 : 16;
        return current.x + radius >= object.x && current.x - radius <= object.x + width && current.y + radius >= y - 24 && current.y - radius <= y + (object.h || 320) + 24;
      };
      if (!touching(player)) {
        if (object.once === false) {
          this.activated.delete(key);
          if (![this.player, this.player2].filter(Boolean).some(touching)) this.activated.delete(`pair:${object._key}`);
        }
        continue;
      }
      if (this.activated.has(key)) continue;
      // The visible ring sits above the floor; its field includes a small generous fringe.
      for (const current of routed) this.activated.add(`portal:${object._key}:${current === this.player2 ? 2 : 1}`);
      const value = String(object.value || 'cube');
      if (value === 'dual' || value.startsWith('dual:')) {
        // Pair-changing effects run once globally, even when both icons enter together.
        if (this.activated.has(`pair:${object._key}`)) continue;
        this.activated.add(`pair:${object._key}`);
        this.setDual(value === 'dual' ? !this.dual : value === 'dual:on');
      } else if (value.startsWith('mirror:')) {
        this.mirrored = value === 'mirror:on';
      } else {
        for (const current of routed) {
          if (GAME_MODES.includes(value) || value === 'jetpack') {
            current.mode = value === 'jetpack' ? 'ship' : value;
            current.jetpack = this.state.platformer && current.mode === 'ship';
            current.vy = 0;
            current.rotation = 0;
            current.cooldown = 0.12;
            if (['ship', 'wave', 'swing'].includes(value)) {
              current.y = clamp(current.y, CEILING + 56, FLOOR - 56);
              current.grounded = false;
            }
          } else if (value === 'mini' || value === 'normal') {
            const oldHalf = current.mini ? 10 : 16;
            current.mini = value === 'mini';
            const newHalf = current.mini ? 10 : 16;
            if (current.grounded) current.y += (oldHalf - newHalf) * current.gravity;
          } else if (value === 'gravity' || value.startsWith('gravity:')) {
            const gravity = value.split(':')[1] || 'toggle';
            current.gravity = gravity === 'normal' ? 1 : gravity === 'reverse' ? -1 : -current.gravity;
            current.grounded = false;
            current.vy *= 0.5;
          } else if (value.startsWith('direction:')) {
            const direction = value.split(':')[1];
            current.direction = direction === 'left' ? -1 : direction === 'right' ? 1 : -(current.direction || 1);
          } else if (value === 'teleport') {
            this.teleportPlayer(current, object);
          }
        }
        if (value.startsWith('speed:')) {
          const requested = SPEED_TIERS[value.slice(6)] || Number(value.slice(6));
          if (Number.isFinite(requested) && requested > 0) {
            for (const current of routed) current.speed = clamp(requested, 100, 900);
            this.speed = this.player.speed;
          }
        }
      }
      this.burst(object.x + width / 2, player.y, this.portalColor(value), 16);
      this.notification = { text: value.startsWith('speed:') ? 'SPEED CHANGE' : value === 'dual' ? (this.dual ? 'DUAL MODE' : 'SINGLE MODE') : value === 'gravity' ? 'GRAVITY FLIPPED' : value.toUpperCase(), time: 0.85 };
    }
  }

  collectCoins() {
    for (const object of this.objects) {
      if (object.active === false || object.type !== 'coin' || this.collected.has(object._key)) continue;
      for (const player of this.dual && this.player2 ? [this.player, this.player2] : [this.player]) {
        if (Math.hypot(player.x - object.x, player.y - object.y) < (player.mini ? 10 : 16) + (object.w || 28) / 2) {
          this.collected.add(object._key);
          this.audio?.coin?.();
          this.burst(object.x, object.y, '#ffe266', 18);
          break;
        }
      }
    }
  }

  safeCheckpoint() {
    const players = this.dual && this.player2 ? [this.player, this.player2] : [this.player];
    for (const player of players) {
      if (!player.grounded && Math.abs(player.vy) > 150) return false;
      for (const object of this.objects) {
        if (object.active === false || !['spike', 'block', 'slope', 'saw'].includes(object.type)) continue;
        if (object.x > player.x - 24 && object.x < player.x + 120 && Math.abs(object.y - player.y) < 95) return false;
      }
    }
    return true;
  }

  syncState() {
    this.state.progress = clamp((this.player.x / this.level.length) * 100, 0, 100);
    this.state.bestProgress = Math.max(this.state.bestProgress, this.state.progress);
    this.state.mode = this.player.mode;
    this.state.coins = this.collected.size;
    this.state.coinIds = [...this.collected];
    this.state.checkpointCount = this.checkpoints.length;
    this.state.dual = this.dual;
    this.state.mini = this.player.mini;
    this.state.gravity = this.player.gravity;
    this.state.speed = this.speed;
    this.state.direction = this.player.direction || 1;
    this.state.mirrored = this.mirrored;
    this.state.jetpack = this.state.platformer && this.player.mode === 'ship';
    this.state.counters = this.runtime?.counters instanceof Map ? Object.fromEntries(this.runtime.counters) : { ...(this.runtime?.counters || {}) };
    this.state.player = this.player;
    this.state.player2 = this.player2;
  }

  die(player) {
    if (this.state.status !== 'playing') return;
    this.syncState();
    this.state.status = 'dead';
    this.state.deaths++;
    this.deathTimer = this.settings.reducedMotion ? 0.35 : 0.58;
    this.burst(player.x, player.y, this.cosmetics.primary, 32);
    this.audio?.die?.();
    // A freshly restored checkpoint inside a hazard cannot trap practice in a death loop.
    if (this.state.practice && this.respawnTime < 0.28 && this.checkpoints.length) {
      this.checkpoints.pop();
      this.state.checkpointCount = this.checkpoints.length;
    }
    this.emit();
  }

  complete() {
    if (this.state.status !== 'playing') return;
    this.state.status = 'complete';
    this.state.progress = 100;
    this.state.bestProgress = 100;
    this.release();
    this.audio?.stopMusic?.();
    this.audio?.complete?.();
    this.burst(this.player.x, this.player.y, this.cosmetics.primary, 65);
    this.emit();
    if (!this.finishReported) {
      this.finishReported = true;
      this.onFinish({ complete: true, practice: this.state.practice, testMode: this.testMode, progress: 100, attempts: this.state.attempts, coins: this.state.coins, coinIds: [...this.collected], time: this.state.time, playTime: this.state.playTime, jumps: this.state.jumps, deaths: this.state.deaths, levelId: this.level.id, platformer: this.state.platformer });
    }
  }

  emit() {
    this.onUpdate({ ...this.state, levelId: this.level?.id });
  }

  burst(x, y, color, count) {
    if (this.settings?.reducedMotion) return;
    for (let index = 0; index < count; index++) {
      const angle = Math.random() * TAU;
      const speed = 50 + Math.random() * 210;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color, life: 0.35 + Math.random() * 0.5, maxLife: 0.85, size: 2 + Math.random() * 5 });
    }
    if (this.particles.length > 180) this.particles.splice(0, this.particles.length - 180);
  }

  updateParticles(dt) {
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 340 * dt;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
    for (const point of this.trail) point.life -= dt;
    this.trail = this.trail.filter((point) => point.life > 0);
    if (this.spiderBeam) {
      this.spiderBeam.life -= dt;
      if (this.spiderBeam.life <= 0) this.spiderBeam = null;
    }
  }

  portalColor(value) {
    return { cube: '#b8ff65', ship: '#ff75d5', jetpack: '#ff75d5', ball: '#ffad67', ufo: '#ffe266', wave: '#61e8ff', robot: '#b391ff', spider: '#ff6aab', swing: '#6dffcf', mini: '#ff75d5', normal: '#b8ff65', gravity: '#ffe266', dual: '#ffad67' }[value] || (String(value).startsWith('gravity:') ? '#ffe266' : String(value).startsWith('dual:') ? '#ffad67' : '#61e8ff');
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr || 1, 0, 0, this.dpr || 1, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    this.drawBackground(ctx);
    if (!this.level) return;
    ctx.save();
    if (this.mirrored) { ctx.translate(WIDTH, 0); ctx.scale(-1, 1); }
    const camera = this.runtime?.camera || {};
    const zoom = clamp(Number(camera.zoom) || 1, 0.2, 3);
    ctx.translate(WIDTH / 2, HEIGHT / 2);
    ctx.rotate((Number(camera.rotation) || 0) * Math.PI / 180);
    ctx.scale(zoom, zoom);
    ctx.translate(-WIDTH / 2 - this.camera, -HEIGHT / 2 - this.cameraY);
    this.drawWorldGround(ctx);
    for (const checkpoint of this.checkpoints) {
      if (checkpoint.player.x < this.camera - 30 || checkpoint.player.x > this.camera + WIDTH + 30) continue;
      ctx.strokeStyle = 'rgba(114,255,181,.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(checkpoint.player.x, CEILING + 10);
      ctx.lineTo(checkpoint.player.x, FLOOR);
      ctx.stroke();
      ctx.setLineDash([]);
      this.path(ctx, [[checkpoint.player.x, CEILING + 12], [checkpoint.player.x + 16, CEILING + 20], [checkpoint.player.x, CEILING + 28]], '#79ffb5');
    }
    this.drawFinish(ctx);
    for (const object of [...this.objects].sort((a, b) => (Number(a.z) || 0) - (Number(b.z) || 0))) {
      const radius = object.type === 'saw' ? Number(object.radius) || (object.w || 48) / 2 : 0;
      if (object.x - radius > this.camera + WIDTH / zoom + WIDTH || object.x + (radius || object.w || 60) < this.camera - WIDTH / zoom) continue;
      this.drawObject(ctx, object);
    }
    for (let index = 0; index < this.trail.length; index++) {
      const point = this.trail[index];
      ctx.globalAlpha = point.life / 0.34 * 0.3;
      const color = this.cosmetics.trail === 'rainbow' ? `hsl(${(this.state.time * 120 + index * 10) % 360},90%,70%)` : point.mode === 'wave' ? '#61e8ff' : point.secondary ? this.cosmetics.secondary : this.cosmetics.primary;
      ctx.fillStyle = color;
      const size = point.size * (point.life / 0.34);
      if (this.cosmetics.trail === 'line' || point.mode === 'wave') {
        const previous = this.trail.slice(0, index).findLast((candidate) => candidate.secondary === point.secondary);
        if (previous) {
          ctx.strokeStyle = color;
          ctx.lineWidth = point.mode === 'wave' ? 4 : 3;
          ctx.beginPath();
          ctx.moveTo(previous.x, previous.y);
          ctx.lineTo(point.x, point.y);
          ctx.stroke();
        }
      } else if (this.cosmetics.trail === 'pulse') {
        ctx.beginPath();
        ctx.arc(point.x, point.y, size * 0.5, 0, TAU);
        ctx.fill();
      } else ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    if (this.spiderBeam) {
      ctx.strokeStyle = rgba(this.cosmetics.primary, this.spiderBeam.life / 0.14);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(this.spiderBeam.x, this.spiderBeam.y1);
      ctx.lineTo(this.spiderBeam.x, this.spiderBeam.y2);
      ctx.stroke();
    }
    if (this.state.status !== 'dead') {
      this.drawPlayer(ctx, this.player, false);
      if (this.dual && this.player2) this.drawPlayer(ctx, this.player2, true);
    }
    for (const particle of this.particles) {
      ctx.globalAlpha = clamp(particle.life / 0.5, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    this.drawHUD(ctx);
  }

  drawBackground(ctx) {
    const color = this.runtime?.backgroundColor || this.level?.color || '#2474de';
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, shade(color, 0.64));
    gradient.addColorStop(0.64, color);
    gradient.addColorStop(1, shade(color, 0.8));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const glow = ctx.createRadialGradient(560, 200, 30, 560, 200, 520);
    glow.addColorStop(0, rgba(color, 0.15));
    glow.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const camera = this.camera || 0;
    // Inset rectangular scenery slides more slowly than the foreground.
    for (let layer = 0; layer < 2; layer++) {
      const scale = layer ? 0.22 : 0.1;
      const offset = (camera * scale) % 230;
      ctx.strokeStyle = rgba('#000000', layer ? 0.17 : 0.12);
      ctx.lineWidth = 2;
      for (let index = -1; index < 6; index++) {
        const x = index * 230 - offset;
        const y = 132 + ((index + 20) % 3) * 58 + layer * 26;
        const size = layer ? 98 : 168;
        ctx.fillStyle = rgba('#000000', layer ? 0.07 : 0.035);
        ctx.fillRect(x, y - 40, size, size * 0.9);
        ctx.strokeRect(x, y - 40, size, size * 0.9);
        ctx.strokeRect(x + 9, y - 31, size - 18, size * 0.9 - 18);
      }
    }
  }

  drawWorldGround(ctx) {
    const color = this.runtime?.groundColor || this.level?.color || '#8467e9';
    const left = this.camera - WIDTH * 3;
    const width = WIDTH * 7;
    ctx.fillStyle = shade(color, 0.45);
    ctx.fillRect(left, FLOOR, width, HEIGHT + 1800);
    ctx.strokeStyle = rgba('#ffffff', 0.2);
    ctx.lineWidth = 2;
    for (let x = Math.floor(left / 64) * 64; x < left + width; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, FLOOR);
      ctx.lineTo(x, HEIGHT + 900);
      ctx.stroke();
    }
    for (const y of [FLOOR + 60, FLOOR + 120, FLOOR + 180]) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + width, y);
      ctx.stroke();
    }
    ctx.fillStyle = rgba(color, 0.14);
    ctx.fillRect(left, FLOOR + 2, width, 8);
    ctx.fillStyle = '#f0f8ff';
    ctx.fillRect(left, FLOOR, width, 3);
    if (this.player && (this.player.gravity < 0 || ['ship', 'wave', 'ball', 'spider', 'swing'].includes(this.player.mode) || this.dual)) {
      ctx.fillStyle = rgba(color, 0.13);
      ctx.fillRect(left, CEILING - 9, width, 9);
      ctx.fillStyle = '#6c7fa8';
      ctx.fillRect(left, CEILING - 2, width, 2);
    }
  }

  path(ctx, points, fill, stroke = '#0b1024', width = 2) {
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }

  drawObject(ctx, object) {
    if (object.active === false || object.visible === false) return;
    if (['trigger', 'startpos'].includes(object.type) && !this.testMode) return;
    ctx.save();
    ctx.globalAlpha *= clamp(object.opacity === undefined ? 1 : Number(object.opacity), 0, 1);
    if (object.rotation) {
      const centered = ['coin', 'orb', 'saw', 'startpos'].includes(object.type);
      const cx = object.x + (centered ? 0 : (object.w || 40) / 2);
      const cy = object.y + (centered ? 0 : (object.h || 40) / 2);
      ctx.translate(cx, cy); ctx.rotate(Number(object.rotation) * Math.PI / 180); ctx.translate(-cx, -cy);
    }
    this.drawObjectShape(ctx, { ...object, rotation: 0 });
    ctx.restore();
  }

  drawObjectShape(ctx, object) {
    const x = object.x;
    const y = object.y;
    if (object.type === 'spike') {
      const points = spikePoints(object);
      this.path(ctx, points, object.color || '#080e17', '#f5fdff', 2.5);
      const center = [points.reduce((sum, point) => sum + point[0], 0) / 3, points.reduce((sum, point) => sum + point[1], 0) / 3];
      const inner = points.map(([px, py]) => [lerp(px, center[0], 0.34), lerp(py, center[1], 0.34)]);
      this.path(ctx, inner, null, rgba('#ffffff', 0.3), 1);
    } else if (object.type === 'block') {
      const w = object.w || 40;
      const h = object.h || 40;
      ctx.fillStyle = object.color || '#080e17';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#f5fdff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.strokeStyle = 'rgba(133,157,204,.22)';
      ctx.strokeRect(x + 6, y + 6, Math.max(1, w - 12), Math.max(1, h - 12));
      ctx.fillStyle = rgba(this.level.color, 0.3);
      ctx.fillRect(x + 3, y + 3, Math.max(1, w - 6), 3);
      if (w >= 60 && h >= 50) {
        for (let ix = x + 34; ix < x + w - 10; ix += 36) {
          ctx.beginPath();
          ctx.moveTo(ix, y + 8);
          ctx.lineTo(ix, y + h - 8);
          ctx.stroke();
        }
      }
    } else if (object.type === 'slope') {
      const w = object.w || 96; const h = object.h || 96;
      const points = object.value === 'down' ? [[x, y], [x + w, y + h], [x, y + h]] : [[x, y + h], [x + w, y], [x + w, y + h]];
      this.path(ctx, points, object.color || '#080e17', '#f5fdff', 2);
      ctx.strokeStyle = rgba(this.level.color, 0.65); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]); ctx.lineTo(points[1][0], points[1][1]); ctx.stroke();
    } else if (object.type === 'saw') {
      const radius = Number(object.radius) || (object.w || 48) / 2;
      ctx.save(); ctx.translate(x, y); ctx.rotate(this.settings.reducedMotion ? 0 : this.state.time * 2);
      const points = Array.from({ length: 32 }, (_, index) => {
        const angle = index / 32 * TAU; const r = radius * (index % 2 ? 0.74 : 1);
        return [Math.cos(angle) * r, Math.sin(angle) * r];
      });
      this.path(ctx, points, object.color || '#e8efff', '#9caed6', 2);
      ctx.fillStyle = '#23375a'; ctx.beginPath(); ctx.arc(0, 0, radius * 0.45, 0, TAU); ctx.fill();
      ctx.fillStyle = object.color || '#ff6a91'; ctx.beginPath(); ctx.arc(0, 0, radius * 0.16, 0, TAU); ctx.fill();
      ctx.restore();
    } else if (object.type === 'checkpoint') {
      const reached = this.activated.has(`checkpoint:${object._key}`);
      const color = object.color || (reached ? '#b8ff65' : '#61e8ff');
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + 8, y + (object.h || 80)); ctx.lineTo(x + 8, y); ctx.stroke();
      this.path(ctx, [[x + 8, y], [x + 38, y + 12], [x + 8, y + 26]], color, '#102440', 2);
      ctx.fillStyle = rgba(color, 0.12); ctx.fillRect(x, y, object.w || 32, object.h || 80);
    } else if (object.type === 'startpos') {
      ctx.strokeStyle = '#79ffb5'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeRect(x - 17, y - 17, 34, 34); ctx.setLineDash([]);
      ctx.fillStyle = '#79ffb5'; ctx.font = '700 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('TEST START', x, y - 26);
    } else if (object.type === 'trigger') {
      const color = object.color || '#b391ff';
      this.path(ctx, [[x, y + 16], [x + 16, y], [x + 32, y + 16], [x + 16, y + 32]], rgba(color, 0.15), color, 1);
      ctx.fillStyle = color; ctx.font = '600 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(object.action || object.value || 'TRIGGER').toUpperCase(), x + 16, y + 46);
    } else if (object.type === 'text') {
      ctx.fillStyle = object.color || '#d7e5ff'; ctx.textAlign = 'left'; ctx.font = `700 ${clamp(Number(object.fontSize) || 24, 8, 128)}px system-ui, sans-serif`;
      ctx.fillText(String(object.text || object.value || ''), x, y + (Number(object.fontSize) || 24));
    } else if (object.type === 'decoration') {
      const w = object.w || 48; const h = object.h || 48; const color = object.color || this.level.color || '#9060ff';
      const shape = object.shape || object.value || 'diamond';
      if (shape === 'circle') { ctx.fillStyle = rgba(color, 0.25); ctx.strokeStyle = color; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
      else if (shape === 'line') { ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke(); }
      else if (shape === 'block' || shape === 'square') { ctx.fillStyle = rgba(color, 0.25); ctx.fillRect(x, y, w, h); ctx.strokeStyle = color; ctx.strokeRect(x, y, w, h); }
      else this.path(ctx, [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]], rgba(color, 0.25), color, 1);
    } else if (object.type === 'coin') {
      if (this.collected.has(object._key)) return;
      const radius = (object.w || 28) / 2;
      ctx.save();
      ctx.translate(x, y);
      ctx.shadowColor = '#ffd34d';
      ctx.shadowBlur = this.settings.reducedMotion ? 0 : 12;
      ctx.fillStyle = '#f8cc4c';
      ctx.strokeStyle = '#fff0a4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#a97924';
      ctx.beginPath();
      ctx.arc(0, 0, radius - 4, 0, TAU);
      ctx.stroke();
      this.path(ctx, [[0, -7], [2.5, -2], [8, -1], [4, 3], [5, 8], [0, 5], [-5, 8], [-4, 3], [-8, -1], [-2.5, -2]], '#fff0ac', null);
      ctx.restore();
    } else if (object.type === 'pad') {
      const w = object.w || 36;
      const color = object.color || this.impulseColor(object.value);
      ctx.fillStyle = rgba(color, 0.2);
      ctx.fillRect(x - 3, y - 14, w + 6, 14);
      ctx.fillStyle = color;
      ctx.fillRect(x, y - 4, w, 6);
      this.path(ctx, [[x + 6, y - 8], [x + w / 2, y - 18], [x + w - 6, y - 8]], null, color, 2);
    } else if (object.type === 'orb') {
      const color = object.color || this.impulseColor(object.value);
      const radius = (object.w || 36) / 2;
      const pulse = this.settings.reducedMotion ? 0 : Math.sin(this.state.time * 7) * 3;
      ctx.fillStyle = rgba(color, 0.13);
      ctx.beginPath();
      ctx.arc(x, y, radius + 7 + pulse, 0, TAU);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.strokeStyle = '#f0f4ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.72, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = rgba(color, 0.7);
      ctx.beginPath();
      ctx.arc(x, y, radius + 3, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = rgba('#ffffff', 0.55);
      ctx.beginPath();
      ctx.arc(x - 3, y - 4, 3, 0, TAU);
      ctx.fill();
      const symbol = { dash: '➜', 'gravity-dash': '⇄', spider: '↕', teleport: '◎', trigger: '◆' }[object.value];
      if (symbol) {
        ctx.save(); ctx.translate(x, y); ctx.rotate((Number(object.angle) || 0) * Math.PI / 180);
        ctx.fillStyle = '#101522'; ctx.font = `900 ${Math.round(radius * 1.1)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(symbol, 0, 0); ctx.restore();
      }
    } else if (object.type === 'portal') {
      const color = object.color || this.portalColor(object.value);
      const w = object.w || 32;
      const h = object.h || 320;
      const top = object.y ?? 120;
      const active = this.activated.has(`portal:${object._key}:1`) || this.activated.has(`portal:${object._key}:2`);
      ctx.save();
      ctx.globalAlpha = active ? 0.5 : 1;
      ctx.fillStyle = rgba(color, 0.08);
      ctx.fillRect(x, top, w, h);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, top + h / 2, w / 2 + 4, h / 2, 0, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = rgba(color, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, top + h / 2, w / 2 + 11, h / 2 + 5, 0, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = color;
      const glyph = { cube: '■', ship: '➤', jetpack: '↑', ball: '◉', ufo: '⌒', wave: '▷', robot: '⊓', spider: '⋈', swing: '↕', mini: '◦', normal: '●', teleport: '◎' }[object.value] || (String(object.value).startsWith('gravity') ? '⇅' : String(object.value).startsWith('dual') ? 'Ⅱ' : String(object.value).startsWith('mirror') ? '⇄' : '»');
      ctx.fillStyle = '#101522'; ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x + w / 2, top + h / 2, 12, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.font = '900 13px system-ui, sans-serif'; ctx.fillText(glyph, x + w / 2, top + h / 2 + 4);
      for (let index = 0; index < 8; index++) {
        const pointY = top + 20 + ((index * 39 + this.state.time * 30) % Math.max(1, h - 35));
        ctx.fillRect(x + w / 2 - 2, pointY, 4, 4);
      }
      ctx.textAlign = 'center';
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.fillText(String(object.value || 'cube').startsWith('speed:') ? 'SPEED' : String(object.value || 'cube').toUpperCase(), x + w / 2, top - 13);
      ctx.restore();
    }
  }

  drawPlayer(ctx, player, secondary) {
    if (!player) return;
    const primary = secondary ? this.cosmetics.secondary : this.cosmetics.primary;
    const secondaryColor = secondary ? this.cosmetics.primary : this.cosmetics.secondary;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.rotation);
    if (player.mini) ctx.scale(0.625, 0.625);
    if (player.gravity < 0 && !['cube', 'ball', 'wave'].includes(player.mode)) ctx.scale(1, -1);
    ctx.lineJoin = 'round';
    const dark = '#10172e';
    const light = '#f0ffe1';
    const eyes = (y = -3) => {
      ctx.fillStyle = dark;
      ctx.fillRect(-8, y, 5, 5);
      ctx.fillRect(3, y, 5, 5);
      ctx.fillStyle = light;
      ctx.fillRect(-7, y, 2, 2);
      ctx.fillRect(4, y, 2, 2);
    };
    if (player.mode === 'cube') {
      drawCubeIcon(ctx, this.cosmetics.icon, primary, secondaryColor, 32);
    } else if (player.mode === 'ship') {
      if (this.state.platformer) {
        ctx.fillStyle = secondaryColor; ctx.strokeStyle = dark; ctx.lineWidth = 2;
        ctx.fillRect(-18, -4, 8, 18); ctx.strokeRect(-18, -4, 8, 18);
        drawCubeIcon(ctx, this.cosmetics.icon, primary, secondaryColor, 25);
        ctx.strokeStyle = '#c7eeff'; ctx.beginPath(); ctx.arc(0, -4, 16, Math.PI, TAU); ctx.stroke();
        if (this.input.held) this.path(ctx, [[-18, 13], [-14, 26 + Math.sin(this.state.time * 30) * 4], [-10, 13]], '#ffe266', null);
      } else {
      this.path(ctx, [[-20, 6], [-10, -10], [10, -10], [22, 4], [7, 13], [-13, 13]], primary, dark, 3);
      this.path(ctx, [[-7, -8], [7, -8], [12, 0], [-9, 0]], secondaryColor, dark, 2);
      ctx.fillStyle = light;
      ctx.fillRect(-3, -6, 5, 4);
      if (this.input.held) this.path(ctx, [[-18, 2], [-31 - Math.sin(this.state.time * 30) * 5, 6], [-18, 10]], '#ffe266', null);
      }
    } else if (player.mode === 'ball') {
      const points = [];
      for (let index = 0; index < 24; index++) {
        const radius = index % 2 ? 13 : 18;
        points.push([Math.cos(index / 24 * TAU) * radius, Math.sin(index / 24 * TAU) * radius]);
      }
      this.path(ctx, points, primary, dark, 2);
      ctx.fillStyle = secondaryColor;
      ctx.strokeStyle = dark;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = light;
      ctx.fillRect(-3, -3, 6, 6);
    } else if (player.mode === 'ufo') {
      ctx.fillStyle = secondaryColor;
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, -4, 12, 12, 0, Math.PI, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.ellipse(0, 3, 22, 8, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      eyes(-10);
      ctx.fillStyle = light;
      for (const x of [-12, 0, 12]) {
        ctx.beginPath();
        ctx.arc(x, 4, 2, 0, TAU);
        ctx.fill();
      }
    } else if (player.mode === 'wave') {
      this.path(ctx, [[-16, -13], [20, 0], [-16, 13], [-8, 0]], primary, dark, 3);
      this.path(ctx, [[-8, -6], [7, 0], [-8, 6], [-3, 0]], secondaryColor, null);
    } else if (player.mode === 'robot') {
      this.path(ctx, [[-13, -16], [9, -16], [16, -6], [12, 7], [-12, 7]], primary, dark, 3);
      eyes(-9);
      const stride = player.grounded ? Math.sin(this.state.time * 17) * 4 : 2;
      this.path(ctx, [[-9, 5], [-3, 5], [-3 - stride, 16], [-14 - stride, 16]], secondaryColor, dark, 2);
      this.path(ctx, [[4, 5], [11, 5], [14 + stride, 16], [4 + stride, 16]], primary, dark, 2);
      ctx.fillStyle = dark;
      ctx.fillRect(8, -13, 9, 6);
    } else if (player.mode === 'spider') {
      const leg = player.grounded ? Math.sin(this.state.time * 19) * 3 : 0;
      for (const side of [-1, 1]) {
        this.path(ctx, [[side * 5, -3], [side * 18, 5 + leg], [side * 20, 15], [side * 13, 15], [side * 9, 5]], secondaryColor, dark, 2);
      }
      this.path(ctx, [[-11, -15], [11, -15], [14, -4], [8, 7], [-8, 7], [-14, -4]], primary, dark, 3);
      eyes(-10);
    } else if (player.mode === 'swing') {
      ctx.fillStyle = primary;
      ctx.strokeStyle = dark;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, TAU);
      ctx.fill();
      ctx.stroke();
      this.path(ctx, [[-17, -6], [-24, -11], [-21, 4], [-16, 6]], secondaryColor, dark, 2);
      this.path(ctx, [[17, -6], [24, -11], [21, 4], [16, 6]], secondaryColor, dark, 2);
      eyes(-5);
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(-5, 6, 10, 3);
      this.path(ctx, [[-5, 14], [0, 23], [5, 14]], '#ffe266', null);
    }
    ctx.restore();
  }

  drawFinish(ctx) {
    const x = this.level.length;
    if (x < this.camera - 100 || x > this.camera + WIDTH + 100) return;
    ctx.fillStyle = 'rgba(184,255,101,.07)';
    ctx.fillRect(x - 6, CEILING, 54, FLOOR - CEILING);
    ctx.strokeStyle = '#b8ff65';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, CEILING);
    ctx.lineTo(x, FLOOR);
    ctx.stroke();
    for (let row = 0; row < 20; row++) {
      for (let col = 0; col < 2; col++) {
        ctx.fillStyle = (row + col) % 2 ? '#17243e' : '#dce7ff';
        ctx.fillRect(x + 10 + col * 10, CEILING + row * 20, 10, 20);
      }
    }
    ctx.fillStyle = '#b8ff65';
    ctx.textAlign = 'center';
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.fillText('FINISH', x + 18, CEILING - 18);
  }

  drawHUD(ctx) {
    if (!this.settings.externalHud) {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(228,236,255,.42)';
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.fillText(`ATTEMPT ${this.state.attempts}${this.state.practice ? ' · PRACTICE' : ''}`, 28, 35);
      ctx.textAlign = 'right';
      ctx.fillText(`${this.state.dual ? 'DUAL · ' : ''}${this.state.mini ? 'MINI ' : ''}${this.state.mode.toUpperCase()}`, WIDTH - 28, 35);
    }
    if (!this.settings.externalHud && this.state.platformer && this.attemptTime < 4 && this.player.x < 130) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(228,236,255,.7)';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillText('A / D TO MOVE · SPACE TO JUMP', WIDTH / 2, FLOOR + 48);
    }
    if (this.notification && this.state.status === 'playing') {
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(230,242,255,${Math.min(1, this.notification.time * 2) * 0.8})`;
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.fillText(this.notification.text, WIDTH / 2, 72);
    }
    if (this.state.status === 'dead') {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#eff3ff';
      ctx.font = '900 26px system-ui, sans-serif';
      ctx.fillText(`${Math.floor(this.state.progress)}%`, WIDTH / 2, 230);
      ctx.fillStyle = '#aebbd6';
      ctx.font = '500 12px system-ui, sans-serif';
      ctx.fillText(this.state.practice && this.checkpoints.length ? 'Returning to checkpoint…' : 'One more try.', WIDTH / 2, 258);
    }
    if (this.state.status === 'paused') {
      ctx.fillStyle = 'rgba(6,11,26,.65)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f1f5ff';
      ctx.font = '900 40px system-ui, sans-serif';
      ctx.fillText('PAUSED', WIDTH / 2, 257);
      ctx.fillStyle = '#b2bed9';
      ctx.font = '500 14px system-ui, sans-serif';
      ctx.fillText('P to resume · R to restart · Esc to leave', WIDTH / 2, 288);
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.frame !== null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.frame);
    this.frame = null;
    this.resizeObserver?.disconnect();
    this.listeners.forEach((remove) => remove());
    this.listeners = [];
    this.audio?.stopMusic?.();
    this.canvasPointerId = null;
    this.release();
    this.state.status = 'idle';
  }
}
