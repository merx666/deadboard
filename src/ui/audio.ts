let ctx: AudioContext | null = null;
export let soundEnabled = true;

export function setSoundEnabled(v: boolean) {
  soundEnabled = v;
}

function getCtx(): AudioContext | null {
  if (!soundEnabled || typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function playTone(freq: number, durationMs = 70, type: OscillatorType = 'sine', gainVal = 0.04) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const now = c.currentTime;
  gain.gain.setValueAtTime(gainVal, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000);
}

export const sfxClick = () => playTone(620, 35, 'triangle', 0.03);
export const sfxSolder = () => playTone(280, 90, 'sawtooth', 0.02);
export const sfxCut = () => playTone(920, 45, 'square', 0.02);
export const sfxBeep = () => playTone(2048, 140, 'sine', 0.04);
export const sfxWin = () => {
  playTone(523.25, 110, 'triangle', 0.04);
  setTimeout(() => playTone(659.25, 110, 'triangle', 0.04), 90);
  setTimeout(() => playTone(783.99, 200, 'triangle', 0.05), 180);
};
export const sfxBlow = () => playTone(110, 220, 'sawtooth', 0.05);

/** Multimeter continuity beeper oscillator */
let continuityOsc: OscillatorNode | null = null;
let continuityGain: GainNode | null = null;

/** Authentic multimeter continuity beeper (2700 Hz piezo tone) */
export function setContinuityBeep(on: boolean) {
  const c = getCtx();
  if (!c || !soundEnabled) {
    if (continuityOsc) {
      try { continuityOsc.stop(); continuityOsc.disconnect(); } catch {}
      continuityOsc = null;
      continuityGain = null;
    }
    return;
  }
  if (on) {
    if (continuityOsc) return; // already beeping
    try {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2700, c.currentTime);
      gain.gain.setValueAtTime(0.04, c.currentTime);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      continuityOsc = osc;
      continuityGain = gain;
    } catch {}
  } else {
    if (!continuityOsc) return;
    try {
      continuityGain?.gain.setTargetAtTime(0.0001, c.currentTime, 0.01);
      setTimeout(() => {
        try { continuityOsc?.stop(); continuityOsc?.disconnect(); } catch {}
        continuityOsc = null;
        continuityGain = null;
      }, 30);
    } catch {
      continuityOsc = null;
      continuityGain = null;
    }
  }
}

/** Authentic bench power supply relay click */
export const sfxRelay = (on: boolean) => {
  if (on) {
    playTone(140, 20, 'square', 0.04);
    setTimeout(() => playTone(220, 25, 'triangle', 0.03), 15);
  } else {
    playTone(180, 20, 'square', 0.03);
    setTimeout(() => playTone(110, 25, 'triangle', 0.03), 15);
  }
};

/** Probe pad contact click */
export const sfxProbe = () => playTone(880, 15, 'triangle', 0.015);

