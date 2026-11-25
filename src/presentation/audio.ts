export class SoundManager {
  private ctx: AudioContext | null = null;
  private _muted = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        if (!this._muted) {
          this.ensureContext();
        }
      };
      window.addEventListener('pointerdown', unlock, { passive: true, once: true });
      window.addEventListener('touchstart', unlock, { passive: true, once: true });
      window.addEventListener('keydown', unlock, { passive: true, once: true });
    }
  }

  get muted(): boolean {
    return this._muted;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    return this._muted;
  }

  suspendForBackground(): void {
    if (this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend();
    }
  }

  resumeFromBackground(): void {
    if (!this._muted && this.ctx) {
      const state = this.ctx.state as string;
      if (state === 'suspended' || state === 'interrupted') {
        void this.ctx.resume();
      }
    }
  }

  private ensureContext(): AudioContext | null {
    if (this._muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    const state = this.ctx.state as string;
    if (state === 'suspended' || state === 'interrupted') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private tone(freq: number, duration: number, type: OscillatorType, volume = 0.08, delay = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playClick(): void {
    this.tone(520, 0.06, 'triangle', 0.06);
  }

  playSpin(): void {
    this.tone(240, 0.08, 'sine', 0.06, 0);
    this.tone(360, 0.1, 'triangle', 0.05, 0.05);
  }

  playReelStop(colIndex: number): void {
    this.tone(140 + colIndex * 18, 0.08, 'sine', 0.08);
  }

  playWin(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.tone(f, 0.22, 'triangle', 0.08, i * 0.06);
    });
  }

  playBonusTrigger(): void {
    [440, 554.37, 659.25, 880, 1108.73].forEach((f, i) => {
      this.tone(f, 0.3, 'sawtooth', 0.06, i * 0.08);
    });
  }
}
