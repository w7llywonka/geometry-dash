/**
 * Original, asset-free Web Audio soundtrack and effects. Call unlock() during
 * a pointer/key gesture; startMusic() may be called before it and will begin
 * once the browser grants audio. Unsupported or blocked audio stays silent.
 */
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
    this.musicNodes = new Set();
    this.sfxNodes = new Set();
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
    for (const key of ['music', 'sfx']) if (typeof settings[key] === 'boolean') this.settings[key] = settings[key];
    if (typeof settings.volume === 'number' && Number.isFinite(settings.volume)) this.settings.volume = Math.max(0, Math.min(1, settings.volume));
    if (this.master && this.context?.state !== 'closed') {
      this.master.gain.setTargetAtTime(this.volume(), this.context.currentTime, 0.02);
    }
    if (!this.settings.music) this.haltMusic();
    else if (!previousMusic && this.musicRequested) this.beginMusic();
    if (!this.settings.sfx) this.stopNodes(this.sfxNodes);
  }

  startMusic(bpm = 140) {
    this.musicRequested = true;
    const nextBpm = typeof bpm === 'number' && Number.isFinite(bpm) ? Math.max(60, Math.min(220, bpm)) : 140;
    if (nextBpm !== this.bpm) this.haltMusic();
    this.bpm = nextBpm;
    this.beginMusic();
  }

  beginMusic() {
    if (this.destroyed || this.timer !== null || !this.musicRequested || !this.settings.music || this.context?.state !== 'running') return;
    this.step = 0;
    this.nextStep = this.context.currentTime + 0.04;
    this.scheduleMusic();
    this.timer = globalThis.setInterval(() => this.scheduleMusic(), 25);
  }

  scheduleMusic() {
    if (!this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    // Skip ahead after a background tab stalls, rather than scheduling a burst.
    if (this.nextStep < now - 0.1) this.nextStep = now + 0.02;
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
    }
    nodes.clear();
  }

  note(midi) { return 440 * 2 ** ((midi - 69) / 12); }

  track(source, nodes, attachments = []) {
    nodes.add(source);
    source.onended = () => {
      nodes.delete(source);
      source.disconnect();
      for (const node of attachments) node.disconnect();
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

  jump() {
    if (!this.canPlaySfx()) return;
    this.tone(360, this.context.currentTime, 0.07, 'sine', 0.2, this.sfxBus, this.sfxNodes, 700);
  }

  die() {
    if (!this.canPlaySfx()) return;
    const when = this.context.currentTime;
    this.tone(140, when, 0.28, 'sawtooth', 0.13, this.sfxBus, this.sfxNodes, 35);
    this.noiseHit(when, 0.2, 0.22, 'lowpass', 2200, this.sfxBus, this.sfxNodes);
  }

  coin() {
    if (!this.canPlaySfx()) return;
    const when = this.context.currentTime;
    this.tone(this.note(88), when, 0.12, 'sine', 0.24, this.sfxBus, this.sfxNodes);
    this.tone(this.note(95), when + 0.07, 0.23, 'sine', 0.24, this.sfxBus, this.sfxNodes);
  }

  complete() {
    if (!this.canPlaySfx()) return;
    const when = this.context.currentTime;
    for (const [index, pitch] of [69, 72, 76, 81].entries()) {
      this.tone(this.note(pitch), when + index * 0.12, index === 3 ? 0.75 : 0.3, 'triangle', 0.25, this.sfxBus, this.sfxNodes);
    }
  }

  destroy() {
    this.destroyed = true;
    this.stopMusic();
    this.stopNodes(this.sfxNodes);
    try { this.master?.disconnect(); } catch { /* Context may already be closed. */ }
    if (this.context?.state !== 'closed') this.context?.close().catch(() => {});
    this.context = null;
    this.noise = null;
  }
}

export default AudioManager;
