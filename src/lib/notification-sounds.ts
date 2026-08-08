// Built-in notification tones generated with the Web Audio API (no audio files).

type Note = { freq: number; start: number; dur: number; gain?: number; type?: OscillatorType };

export type ToneId =
  | "chime"
  | "double_beep"
  | "ding"
  | "alert"
  | "soft_pop"
  | "rising_trill"
  | "siren"
  | "klaxon"
  | "buzzer"
  | "loud_bell"
  | "air_horn"
  | "urgent_alarm";

export const TONES: Array<{ id: ToneId; label: string; notes: Note[] }> = [
  {
    id: "chime",
    label: "Chime",
    notes: [
      { freq: 880, start: 0, dur: 0.35 },
      { freq: 1320, start: 0.12, dur: 0.45 },
    ],
  },
  {
    id: "double_beep",
    label: "Double beep",
    notes: [
      { freq: 1046, start: 0, dur: 0.12, type: "square", gain: 0.18 },
      { freq: 1046, start: 0.18, dur: 0.12, type: "square", gain: 0.18 },
    ],
  },
  {
    id: "ding",
    label: "Ding",
    notes: [{ freq: 1568, start: 0, dur: 0.6 }],
  },
  {
    id: "alert",
    label: "Alert (triple)",
    notes: [
      { freq: 784, start: 0, dur: 0.14, type: "triangle", gain: 0.22 },
      { freq: 988, start: 0.2, dur: 0.14, type: "triangle", gain: 0.22 },
      { freq: 1175, start: 0.4, dur: 0.22, type: "triangle", gain: 0.22 },
    ],
  },
  {
    id: "soft_pop",
    label: "Soft pop",
    notes: [{ freq: 523, start: 0, dur: 0.18, type: "sine", gain: 0.25 }],
  },
  {
    id: "rising_trill",
    label: "Rising trill",
    notes: [
      { freq: 659, start: 0, dur: 0.1 },
      { freq: 784, start: 0.09, dur: 0.1 },
      { freq: 988, start: 0.18, dur: 0.1 },
      { freq: 1318, start: 0.27, dur: 0.3 },
    ],
  },
  {
    id: "siren",
    label: "Siren (loud)",
    notes: [
      { freq: 700, start: 0, dur: 0.3, type: "sawtooth", gain: 0.5 },
      { freq: 1100, start: 0.3, dur: 0.3, type: "sawtooth", gain: 0.5 },
      { freq: 700, start: 0.6, dur: 0.3, type: "sawtooth", gain: 0.5 },
      { freq: 1100, start: 0.9, dur: 0.35, type: "sawtooth", gain: 0.5 },
    ],
  },
  {
    id: "klaxon",
    label: "Klaxon (loud)",
    notes: [
      { freq: 420, start: 0, dur: 0.28, type: "square", gain: 0.5 },
      { freq: 560, start: 0.32, dur: 0.28, type: "square", gain: 0.5 },
      { freq: 420, start: 0.64, dur: 0.35, type: "square", gain: 0.5 },
    ],
  },
  {
    id: "buzzer",
    label: "Buzzer (loud)",
    notes: [
      { freq: 180, start: 0, dur: 0.5, type: "sawtooth", gain: 0.5 },
      { freq: 240, start: 0, dur: 0.5, type: "square", gain: 0.35 },
    ],
  },
  {
    id: "loud_bell",
    label: "Loud bell (repeating)",
    notes: [
      { freq: 1568, start: 0, dur: 0.4, gain: 0.5 },
      { freq: 2093, start: 0.02, dur: 0.35, gain: 0.35 },
      { freq: 1568, start: 0.45, dur: 0.4, gain: 0.5 },
      { freq: 2093, start: 0.47, dur: 0.35, gain: 0.35 },
      { freq: 1568, start: 0.9, dur: 0.5, gain: 0.5 },
    ],
  },
  {
    id: "air_horn",
    label: "Air horn (very loud)",
    notes: [
      { freq: 330, start: 0, dur: 0.8, type: "sawtooth", gain: 0.5 },
      { freq: 495, start: 0, dur: 0.8, type: "square", gain: 0.4 },
      { freq: 660, start: 0.05, dur: 0.7, type: "sawtooth", gain: 0.3 },
    ],
  },
  {
    id: "urgent_alarm",
    label: "Urgent alarm (loud)",
    notes: [
      { freq: 1000, start: 0, dur: 0.15, type: "square", gain: 0.5 },
      { freq: 1400, start: 0.18, dur: 0.15, type: "square", gain: 0.5 },
      { freq: 1000, start: 0.36, dur: 0.15, type: "square", gain: 0.5 },
      { freq: 1400, start: 0.54, dur: 0.15, type: "square", gain: 0.5 },
      { freq: 1800, start: 0.72, dur: 0.3, type: "square", gain: 0.5 },
    ],
  },
];

export const TONE_IDS = TONES.map((t) => t.id);
export function toneLabel(id: string): string {
  return TONES.find((t) => t.id === id)?.label || id;
}

let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  return ctx;
}

/** Browsers block audio until a user gesture; unlock on the first interaction. */
export function installAudioUnlock() {
  if (typeof window === "undefined" || unlocked) return;
  const unlock = () => {
    unlocked = true;
    const c = getCtx();
    if (c && c.state === "suspended") void c.resume();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

export function isAudioUnlocked() {
  return unlocked;
}

/** Play a built-in tone once. Silently no-ops before the first user gesture. */
export function playTone(id: string, opts: { force?: boolean } = {}) {
  const tone = TONES.find((t) => t.id === id);
  if (!tone) return;
  if (!unlocked && !opts.force) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const t0 = c.currentTime + 0.01;
  for (const n of tone.notes) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = n.type || "sine";
    osc.frequency.value = n.freq;
    const peak = n.gain ?? 0.2;
    const start = t0 + n.start;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + n.dur + 0.02);
  }
}