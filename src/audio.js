/**
 * Original, asset-free Web Audio soundtrack and effects. Call unlock() during
 * a pointer/key gesture; startMusic() may be called before it and will begin
 * once the browser grants audio. Unsupported or blocked audio stays silent.
 */
export const SFX_IDS = ['pulse', 'jump', 'coin', 'alarm', 'complete', 'die'];
const SFX_DURATIONS = { pulse: 0.55, jump: 0.07, coin: 0.3, alarm: 1.2, complete: 1.11, die: 0.28 };
const finite = (value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export class AudioManager {
  constructor(settings = {}) {
    this.settings = { music: true, sfx: true, volume: 0.5, ...settings };
    this.context = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.timer = null;
    this.bpm = 140;
    this.step = 0;
    this.nextStep = 0;
    this.musicRequested = false;
    this.musicElapsed = 0;
    this.musicStartedAt = 0;
    this.musicNodes = new Set();
    this.sfxNodes = new Set();
    this.channels = new Map();
    this.destroyed = false;
    this.supported = Boolean(globalThis.AudioContext || globalThis.webkitAudioContext);
    this.noise = null;
  }

  async unlock() {
    if (this.destroyed || !this.supported) return false;
    try {
      if (!this.context) {
        const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.musicBus = this.context.createGain();
        this.sfxBus = this.context.createGain();
        this.musicBus.gain.value = 0.4;
        this.sfxBus.gain.value = 0.6;
        this.master.gain.value = this.volume();
        this.musicBus.connect(this.master);
        this.sfxBus.connect(this.master);
        this.master.connect(this.context.destination);
        this.makeNoise();
      }
      if (this.context.state === 'suspended') await this.context.resume();
      if (this.context.state !== 'running') return false;
      if (this.musicRequested && this.settings.music) this.beginMusic();
      this.restoreChannels();
      return true;
    } catch {
      return false;
    }
  }

  volume() {
    const value = this.settings.volume;
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
  }

  setSettings(settings = {}) {
    const previousMusic = this.settings.music;
    const previousSfx = this.settings.sfx;
    for (const key of ['music', 'sfx']) if (typeof settings[key] === 'boolean') this.settings[key] = settings[key];
    if (typeof settings.volume === 'number' && Number.isFinite(settings.volume)) this.settings.volume = Math.max(0, Math.min(1, settings.volume));
    if (this.master && this.context?.state !== 'closed') {
      this.master.gain.setTargetAtTime(this.volume(), this.context.currentTime, 0.02);
    }
    if (!this.settings.music) this.haltMusic();
    else if (!previousMusic && this.musicRequested) this.beginMusic();
    if (!this.settings.sfx) this.stopSfx();
    else if (!previousSfx) this.restoreChannels();
  }

  clock() {
    return (globalThis.performance?.now?.() ?? Date.now()) / 1000;
  }

  elapsed() {
    return this.musicElapsed + (this.musicRequested ? Math.max(0, this.clock() - this.musicStartedAt) : 0);
  }

  /** restart:false resumes a paused phase; step/elapsed override that phase. */
  startMusic(bpm = 140, options = {}) {
    const nextBpm = typeof bpm === 'number' && Number.isFinite(bpm) ? Math.max(60, Math.min(220, bpm)) : 140;
    const previousElapsed = this.elapsed();
    const restart = options.restart !== false;
    if (restart || nextBpm !== this.bpm || options.step !== undefined || options.elapsed !== undefined) this.haltMusic();
    this.bpm = nextBpm;
    this.musicElapsed = options.elapsed !== undefined ? finite(options.elapsed)
      : options.step !== undefined ? finite(options.step, 0, 0, 127) * 60 / this.bpm / 4
        : restart ? 0 : previousElapsed;
    this.musicStartedAt = this.clock();
    this.musicRequested = true;
    this.beginMusic();
  }

  beginMusic() {
    if (this.destroyed || this.timer !== null || !this.musicRequested || !this.settings.music || this.context?.state !== 'running') return;
    const interval = 60 / this.bpm / 4;
    const elapsed = this.elapsed();
    const absoluteStep = elapsed < 0.005 ? 0 : Math.ceil(elapsed / interval);
    this.step = absoluteStep % 128;
    this.nextStep = this.context.currentTime + Math.max(0.01, absoluteStep * interval - elapsed);
    this.scheduleMusic();
    this.timer = globalThis.setInterval(() => this.scheduleMusic(), 25);
  }

  scheduleMusic() {
    if (!this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    // Skip ahead after a background tab stalls, rather than scheduling a burst.
    if (this.nextStep < now - 0.1) {
      const interval = 60 / this.bpm / 4;
      const elapsed = this.elapsed();
      const absoluteStep = Math.ceil(elapsed / interval);
      this.step = absoluteStep % 128;
      this.nextStep = now + Math.max(0.01, absoluteStep * interval - elapsed);
    }
    while (this.nextStep < now + 0.12) {
      this.musicStep(this.step, this.nextStep);
      this.nextStep += 60 / this.bpm / 4;
      this.step = (this.step + 1) % 128;
    }
  }

  musicStep(step, when) {
    const beat = step % 16;
    const bar = Math.floor(step / 16);
    const roots = [45, 45, 48, 48, 43, 43, 41, 43];
    const root = roots[bar];
    if (beat % 4 === 0) this.kick(when);
    if (beat === 4 || beat === 12) this.noiseHit(when, 0.12, 0.2, 'bandpass', 1800, this.musicBus, this.musicNodes);
    if (beat % 2 === 0) this.noiseHit(when, 0.03, beat % 4 ? 0.06 : 0.09, 'highpass', 7500, this.musicBus, this.musicNodes);
    if (beat % 2 === 0) {
      const bassNote = root + (beat === 10 || beat === 14 ? 12 : 0);
      this.tone(this.note(bassNote), when, 60 / this.bpm / 2 * 0.72, 'triangle', 0.28, this.musicBus, this.musicNodes);
    }
    // A custom repeating minor-key motif, composed for this browser game.
    const melody = [12, null, 19, 15, null, 12, 22, null, 19, null, 15, 14, null, 19, 24, 22];
    const pitch = melody[beat];
    if (pitch !== null) this.tone(this.note(root + pitch + 12), when, 60 / this.bpm / 4 * 1.15, 'sine', 0.13, this.musicBus, this.musicNodes);
    if (beat === 0) {
      for (const pitch of [0, 7, 12]) this.tone(this.note(root + pitch + 12), when, 60 / this.bpm * 3.3, 'sine', 0.025, this.musicBus, this.musicNodes);
    }
  }

  stopMusic() {
    this.musicElapsed = this.elapsed();
    this.musicRequested = false;
    this.haltMusic();
  }

  haltMusic() {
    if (this.timer !== null) globalThis.clearInterval(this.timer);
    this.timer = null;
    this.stopNodes(this.musicNodes);
  }

  stopNodes(nodes) {
    for (const node of nodes) {
      try { node.stop(); } catch { /* Already stopped. */ }
      if (nodes !== this.musicNodes) this.sfxNodes.delete(node);
    }
    nodes.clear();
  }

  note(midi) { return 440 * 2 ** ((midi - 69) / 12); }

  track(source, nodes, attachments = []) {
    nodes.add(source);
    if (nodes !== this.musicNodes) this.sfxNodes.add(source);
    source.onended = () => {
      nodes.delete(source);
      this.sfxNodes.delete(source);
      source.disconnect();
      for (const node of attachments) node.disconnect();
      for (const [channel, state] of this.channels) if (state.nodes === nodes && nodes.size === 0) this.channels.delete(channel);
    };
  }

  tone(frequency, when, duration, type, volume, bus, nodes, endFrequency = null) {
    if (!this.context || !bus || nodes.size > 120) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, when + duration);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), when + Math.min(0.008, duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain);
    gain.connect(bus);
    this.track(oscillator, nodes, [gain]);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.01);
  }

  kick(when) {
    this.tone(150, when, 0.19, 'sine', 0.8, this.musicBus, this.musicNodes, 38);
  }

  makeNoise() {
    const length = Math.floor(this.context.sampleRate * 0.5);
    this.noise = this.context.createBuffer(1, length, this.context.sampleRate);
    const samples = this.noise.getChannelData(0);
    let seed = 8191;
    for (let i = 0; i < length; i++) {
      seed = (seed * 16807) % 2147483647;
      samples[i] = seed / 1073741823.5 - 1;
    }
  }

  noiseHit(when, duration, volume, filterType, frequency, bus, nodes) {
    if (!this.context || !this.noise || !bus || nodes.size > 120) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noise;
    filter.type = filterType;
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    this.track(source, nodes, [filter, gain]);
    source.start(when);
    source.stop(when + duration);
  }

  canPlaySfx() {
    return !this.destroyed && this.settings.sfx && this.context?.state === 'running';
  }

  /** A channel holds one sound at a time. Unknown sound IDs fail silently. */
  playSfx(soundId, { volume = 1, channel = 'default' } = {}) {
    if (!SFX_IDS.includes(soundId) || !this.canPlaySfx()) return false;
    const key = String(channel).slice(0, 100);
    this.stopSfx(key);
    const state = { soundId, volume: finite(volume, 1, 0, 1), startedAt: this.clock(), nodes: new Set(), pending: false };
    this.channels.set(key, state);
    this.renderSfx(state);
    return true;
  }

  renderSfx(state, elapsed = 0) {
    if (!this.canPlaySfx() || state.volume <= 0) return;
    const when = this.context.currentTime;
    // Restored notes keep their remaining envelope and frequency glide. An
    // oscillator's waveform phase cannot be serialized, so restored attack
    // transients are approximate rather than claiming sample-exact playback.
    const tone = (pitch, offset, duration, type, volume, endPitch = null) => {
      const position = Math.max(0, elapsed - offset);
      if (position >= duration) return;
      const frequency = endPitch ? pitch * (endPitch / pitch) ** (position / duration) : pitch;
      const envelope = position ? (0.0001 / Math.max(volume, 0.0002)) ** (position / duration) : 1;
      this.tone(frequency, when + Math.max(0, offset - elapsed), duration - position, type, Math.max(0.0002, volume * state.volume * envelope), this.sfxBus, state.nodes, endPitch);
    };
    const noise = (offset, duration, volume, type, frequency) => {
      const position = Math.max(0, elapsed - offset);
      if (position >= duration) return;
      this.noiseHit(when + Math.max(0, offset - elapsed), duration - position, volume * state.volume * (0.0001 / volume) ** (position / duration), type, frequency, this.sfxBus, state.nodes);
    };
    switch (state.soundId) {
      case 'jump': tone(360, 0, 0.07, 'sine', 0.2, 700); break;
      case 'die':
        tone(140, 0, 0.28, 'sawtooth', 0.13, 35);
        noise(0, 0.2, 0.22, 'lowpass', 2200);
        break;
      case 'coin':
        tone(this.note(88), 0, 0.12, 'sine', 0.24);
        tone(this.note(95), 0.07, 0.23, 'sine', 0.24);
        break;
      case 'complete':
        for (const [index, pitch] of [69, 72, 76, 81].entries()) tone(this.note(pitch), index * 0.12, index === 3 ? 0.75 : 0.3, 'triangle', 0.25);
        break;
      case 'pulse':
        tone(this.note(57), 0, 0.3, 'sine', 0.3, this.note(45));
        tone(this.note(81), 0.1, 0.45, 'triangle', 0.1);
        break;
      case 'alarm':
        for (let index = 0; index < 4; index++) tone(this.note(index % 2 ? 83 : 76), index * 0.25, 0.45, 'triangle', 0.16);
        break;
    }
  }

  /** Omit channel to stop all sounds; a sound ID also matches its channels. */
  stopSfx(channel) {
    if (channel === undefined || channel === null || channel === '') {
      this.stopNodes(this.sfxNodes);
      for (const state of this.channels.values()) state.nodes.clear();
      this.channels.clear();
      return;
    }
    const key = String(channel);
    for (const [name, state] of this.channels) {
      if (name === key || state.soundId === key) {
        this.stopNodes(state.nodes);
        this.channels.delete(name);
      }
    }
  }

  restoreChannels() {
    if (!this.canPlaySfx()) return;
    for (const [channel, state] of this.channels) {
      if (!state.pending) continue;
      const elapsed = Math.max(0, this.clock() - state.startedAt);
      if (elapsed >= SFX_DURATIONS[state.soundId]) this.channels.delete(channel);
      else {
        state.pending = false;
        this.renderSfx(state, elapsed);
      }
    }
  }

  snapshot() {
    const elapsed = this.elapsed();
    const channels = [];
    for (const [channel, state] of this.channels) {
      const soundElapsed = Math.max(0, this.clock() - state.startedAt);
      if (soundElapsed < SFX_DURATIONS[state.soundId]) channels.push({ channel, soundId: state.soundId, volume: state.volume, elapsed: soundElapsed });
    }
    return { version: 1, bpm: this.bpm, step: Math.floor(elapsed / (60 / this.bpm / 4)) % 128, elapsed, musicRequested: this.musicRequested, channels };
  }

  restore(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) || this.destroyed) return false;
    this.haltMusic();
    this.stopSfx();
    this.bpm = finite(snapshot.bpm, 140, 60, 220);
    this.musicElapsed = snapshot.elapsed === undefined ? finite(snapshot.step, 0, 0, 127) * 60 / this.bpm / 4 : finite(snapshot.elapsed);
    this.musicStartedAt = this.clock();
    this.musicRequested = snapshot.musicRequested === true;
    if (Array.isArray(snapshot.channels)) {
      for (const item of snapshot.channels.slice(0, 32)) {
        if (!item || !SFX_IDS.includes(item.soundId)) continue;
        const elapsed = finite(item.elapsed);
        if (elapsed >= SFX_DURATIONS[item.soundId]) continue;
        const channel = String(item.channel ?? item.soundId).slice(0, 100);
        this.channels.set(channel, { soundId: item.soundId, volume: finite(item.volume, 1, 0, 1), startedAt: this.clock() - elapsed, nodes: new Set(), pending: true });
      }
    }
    if (this.musicRequested && this.settings.music) this.beginMusic();
    this.restoreChannels();
    return true;
  }

  jump() { return this.playSfx('jump', { channel: 'player-jump' }); }
  die() { return this.playSfx('die', { channel: 'player-die' }); }
  coin() { return this.playSfx('coin', { channel: 'player-coin' }); }
  complete() { return this.playSfx('complete', { channel: 'player-complete' }); }

  destroy() {
    this.destroyed = true;
    this.stopMusic();
    this.stopSfx();
    try { this.master?.disconnect(); } catch { /* Context may already be closed. */ }
    if (this.context?.state !== 'closed') this.context?.close().catch(() => {});
    this.context = null;
    this.noise = null;
  }
}

export default AudioManager;
