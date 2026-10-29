/**
 * I suoni dell'app: brevi, morbidi e sintetizzati al volo (nessun file da scaricare).
 * Si possono spegnere dalle impostazioni; non interrompono la musica del telefono.
 */

export type SoundName =
  | "tap"
  | "select"
  | "toggleOn"
  | "toggleOff"
  | "success"
  | "error"
  | "whistle"
  | "swish"
  | "rim"
  | "board"
  | "bounce"
  | "win"
  | "loss"
  | "unlock"
  | "tick"
  | "whoosh"
  | "shuffle"
  | "refresh";

const KEY = "campetto:suoni";
const listeners = new Set<(on: boolean) => void>();

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* il telefono non salva: vale solo per ora */
  }
  for (const l of listeners) l(on);
}

export function onSoundChange(fn: (on: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
/** Dove suona il suono corrente: un volume a parte per ognuno, poi il banco. */
let bus: AudioNode | null = null;
let wet: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function engine(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    // Su iPhone: suoni "ambiente", si mescolano alla musica e rispettano il silenzioso.
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "ambient";
  } catch {
    /* non supportato */
  }
  try {
    ctx = new AC({ latencyHint: "interactive" });
  } catch {
    return null;
  }
  wire(ctx);
  return ctx;
}

/** Il banco del suono: compressore, volume generale, un filo di riverbero e il rumore. */
function wire(c: BaseAudioContext) {
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master = c.createGain();
  master.gain.value = 1;
  master.connect(comp).connect(c.destination);
  // Un filo di riverbero, generato: dà aria ai suoni senza file.
  const conv = c.createConvolver();
  const len = Math.floor(c.sampleRate * 1.1);
  const ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  conv.buffer = ir;
  wet = c.createGain();
  wet.gain.value = 0.18;
  wet.connect(conv).connect(master);
  noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
}

/** Da chiamare all'avvio: il primo tocco sblocca l'audio (regola dei browser). */
export function primeAudio() {
  if (typeof window === "undefined") return;
  const unlock = () => {
    const c = engine();
    if (c && c.state !== "running") void c.resume().catch(() => undefined);
  };
  window.addEventListener("pointerdown", unlock, { capture: true, passive: true });
  window.addEventListener("keydown", unlock, { capture: true });
  // Nella app installata il browser di solito permette l'audio anche prima del tocco.
  unlock();
}

interface Tone {
  f: number;
  to?: number;
  type?: OscillatorType;
  at?: number;
  dur: number;
  gain: number;
  attack?: number;
  reverb?: number;
}

function tone(c: BaseAudioContext, t0: number, { f, to, type = "sine", at = 0, dur, gain, attack = 0.004, reverb = 0.2 }: Tone) {
  const o = c.createOscillator();
  const g = c.createGain();
  const t = t0 + at;
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8);
  // Parte da zero anche prima di t: il primo campione non deve scattare.
  g.gain.value = 0.0001;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(bus ?? master!);
  if (reverb && wet) {
    const s = c.createGain();
    s.gain.value = reverb;
    g.connect(s).connect(wet);
  }
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Nota "a marimba": la fondamentale più due armoniche che si spengono prima. */
function mallet(c: BaseAudioContext, t0: number, f: number, at: number, gain: number, dur = 0.42, reverb = 0.25) {
  tone(c, t0, { f, at, dur, gain, attack: 0.003, reverb });
  tone(c, t0, { f: f * 4, at, dur: dur * 0.3, gain: gain * 0.25, attack: 0.002, reverb });
  tone(c, t0, { f: f * 2.01, at, dur: dur * 0.5, gain: gain * 0.18, attack: 0.002, reverb });
}

interface Noise {
  at?: number;
  dur: number;
  gain: number;
  filter: BiquadFilterType;
  f: number;
  to?: number;
  q?: number;
  attack?: number;
  reverb?: number;
}

function noise(c: BaseAudioContext, t0: number, { at = 0, dur, gain, filter, f, to, q = 1, attack = 0.005, reverb = 0.1 }: Noise) {
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const bq = c.createBiquadFilter();
  bq.type = filter;
  bq.Q.value = q;
  const t = t0 + at;
  bq.frequency.setValueAtTime(f, t);
  if (to) bq.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain();
  // Parte da zero anche prima di t: il primo campione non deve scattare.
  g.gain.value = 0.0001;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  // Prima il volume, poi il filtro: niente scatti quando il rumore parte.
  src.connect(g).connect(bq).connect(bus ?? master!);
  if (reverb && wet) {
    const s = c.createGain();
    s.gain.value = reverb;
    g.connect(s).connect(wet);
  }
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

const RECIPES: Record<SoundName, (c: BaseAudioContext, t: number) => void> = {
  // Un "tic" morbido per i tasti importanti.
  tap: (c, t) => {
    tone(c, t, { f: 1500, to: 1100, dur: 0.05, gain: 0.11, attack: 0.002, reverb: 0.05 });
    noise(c, t, { dur: 0.012, gain: 0.025, filter: "highpass", f: 4000, attack: 0.001, reverb: 0 });
  },
  // Una bollicina che sale: hai scelto qualcosa.
  select: (c, t) => tone(c, t, { f: 520, to: 980, dur: 0.11, gain: 0.16, attack: 0.004 }),
  toggleOn: (c, t) => {
    tone(c, t, { f: 760, dur: 0.05, gain: 0.1, reverb: 0.05 });
    tone(c, t, { f: 1140, at: 0.06, dur: 0.07, gain: 0.1, reverb: 0.1 });
  },
  toggleOff: (c, t) => {
    tone(c, t, { f: 1000, dur: 0.05, gain: 0.08, reverb: 0.05 });
    tone(c, t, { f: 680, at: 0.06, dur: 0.07, gain: 0.08, reverb: 0.05 });
  },
  // Due note che salgono: fatto.
  success: (c, t) => {
    mallet(c, t, 1046.5, 0, 0.13, 0.32);
    mallet(c, t, 1568, 0.075, 0.12, 0.45);
  },
  // Due note che scendono, piano: qualcosa non va.
  error: (c, t) => {
    mallet(c, t, 392, 0, 0.13, 0.22, 0.12);
    mallet(c, t, 311, 0.1, 0.13, 0.32, 0.15);
  },
  // Il fischio dell'arbitro, leggero: il trillo viene dalla pallina dentro il fischietto.
  whistle: (c, t) => {
    const o = c.createOscillator();
    const lfo = c.createOscillator();
    const depth = c.createGain();
    const g = c.createGain();
    const trem = c.createGain();
    o.frequency.value = 2650;
    lfo.frequency.value = 31;
    depth.gain.value = 110;
    lfo.connect(depth).connect(o.frequency);
    const amp = c.createGain();
    amp.gain.value = 0.35;
    lfo.connect(amp).connect(trem.gain);
    trem.gain.value = 0.65;
    // Parte da zero anche prima di t: il primo campione non deve scattare.
  g.gain.value = 0.0001;
  g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.03);
    g.gain.setValueAtTime(0.07, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(trem).connect(g).connect(bus ?? master!);
    const s = c.createGain();
    s.gain.value = 0.2;
    g.connect(s).connect(wet!);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.46);
    lfo.stop(t + 0.46);
    noise(c, t, { dur: 0.4, gain: 0.02, filter: "bandpass", f: 2650, q: 6, attack: 0.03 });
  },
  // La retina: un fruscio che sale.
  swish: (c, t) => {
    noise(c, t, { dur: 0.32, gain: 0.16, filter: "bandpass", f: 2200, to: 6500, q: 1.1, attack: 0.012, reverb: 0.15 });
    noise(c, t, { at: 0.04, dur: 0.22, gain: 0.05, filter: "highpass", f: 6000, attack: 0.02, reverb: 0 });
  },
  // Il ferro: un "ding" metallico con armoniche storte.
  rim: (c, t) => {
    [
      [520, 0.09],
      [1243, 0.05],
      [1997, 0.035],
      [2931, 0.02],
    ].forEach(([f, g]) => tone(c, t, { f, dur: 0.6, gain: g, attack: 0.002, reverb: 0.25 }));
    noise(c, t, { dur: 0.02, gain: 0.05, filter: "highpass", f: 2000, attack: 0.001, reverb: 0 });
  },
  // Il tabellone: un colpo sordo.
  board: (c, t) => {
    tone(c, t, { f: 170, to: 80, dur: 0.16, gain: 0.22, attack: 0.002, reverb: 0.1 });
    noise(c, t, { dur: 0.04, gain: 0.06, filter: "lowpass", f: 1200, attack: 0.001, reverb: 0 });
  },
  // Il pallone sul cemento.
  bounce: (c, t) => {
    tone(c, t, { f: 110, to: 52, dur: 0.12, gain: 0.26, attack: 0.002, reverb: 0.05 });
    noise(c, t, { dur: 0.03, gain: 0.05, filter: "lowpass", f: 700, attack: 0.001, reverb: 0 });
  },
  // Vittoria: un arpeggio allegro che finisce in alto con un luccichio.
  win: (c, t) => {
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => mallet(c, t, f, i * 0.085, 0.12, i === 3 ? 0.8 : 0.35, 0.3));
    tone(c, t, { f: 2093, at: 0.34, dur: 0.5, gain: 0.03, reverb: 0.5 });
    tone(c, t, { f: 2637, at: 0.4, dur: 0.5, gain: 0.025, reverb: 0.5 });
  },
  // Sconfitta: tre note che scendono, gentili.
  loss: (c, t) => {
    [392, 329.6, 261.6].forEach((f, i) => mallet(c, t, f, i * 0.16, 0.11, i === 2 ? 0.7 : 0.32, 0.35));
  },
  // Sblocco: una pioggia di campanelle che sale.
  unlock: (c, t) => {
    [1046.5, 1318.5, 1568, 2093, 2349, 2637].forEach((f, i) => mallet(c, t, f, i * 0.055, 0.06, 0.5, 0.45));
    noise(c, t, { dur: 0.45, gain: 0.03, filter: "bandpass", f: 3000, to: 8000, q: 0.8, attack: 0.1, reverb: 0.3 });
  },
  // Lo scatto del personaggio quando si ferma.
  tick: (c, t) => tone(c, t, { f: 2300, dur: 0.03, gain: 0.05, attack: 0.001, reverb: 0 }),
  whoosh: (c, t) => noise(c, t, { dur: 0.28, gain: 0.05, filter: "bandpass", f: 500, to: 1800, q: 0.9, attack: 0.05, reverb: 0.05 }),
  // Le squadre si mescolano: un mazzo di carte.
  shuffle: (c, t) => {
    for (let i = 0; i < 6; i++) noise(c, t, { at: i * 0.035 + (i % 2) * 0.006, dur: 0.024, gain: 0.04, filter: "bandpass", f: 3600 + i * 180, q: 0.8, attack: 0.004, reverb: 0 });
  },
  refresh: (c, t) => {
    tone(c, t, { f: 620, to: 1040, dur: 0.1, gain: 0.1 });
    tone(c, t, { f: 1560, at: 0.09, dur: 0.06, gain: 0.05 });
  },
};

/** Il volume di ogni suono: i tocchi appena sopra un sussurro, le feste un po' di più. */
const LEVEL: Record<SoundName, number> = {
  tap: 3.5,
  select: 3.4,
  toggleOn: 1.7,
  toggleOff: 2,
  success: 1.75,
  error: 1.4,
  whistle: 2.3,
  swish: 4,
  rim: 2.5,
  board: 4.3,
  bounce: 3.6,
  win: 2,
  loss: 1.7,
  unlock: 2.3,
  tick: 4.7,
  whoosh: 8,
  shuffle: 6,
  refresh: 2.7,
};

function run(c: BaseAudioContext, name: SoundName, t: number) {
  const level = c.createGain();
  level.gain.value = LEVEL[name];
  level.connect(master!);
  bus = level;
  try {
    RECIPES[name](c, t);
  } finally {
    bus = null;
  }
}

/** Suona, se i suoni sono accesi e il browser lo permette. Non aspetta mai. */
export function play(name: SoundName) {
  if (!soundOn()) return;
  const c = engine();
  if (!c) return;
  const go = () => {
    try {
      run(c, name, c.currentTime + 0.005);
    } catch {
      /* un suono perso non deve mai rompere l'app */
    }
  };
  if (c.state === "running") return go();
  // Al primo tocco l'audio si sveglia in un attimo; se non si sveglia subito, il suono si salta.
  const asked = performance.now();
  void c
    .resume()
    .then(() => {
      if (performance.now() - asked < 160) go();
    })
    .catch(() => undefined);
}

/** Per l'apertura: suona a un tempo preciso da adesso (in secondi). */
export function playAt(name: SoundName, delay: number) {
  if (!soundOn()) return;
  const c = engine();
  if (!c || c.state !== "running") return;
  try {
    run(c, name, c.currentTime + delay);
  } catch {
    /* ignora */
  }
}

/**
 * Per i controlli: disegna un suono senza suonarlo e ne restituisce il campione.
 * Il motore dal vivo non viene toccato.
 */
export async function renderSound(name: SoundName, seconds = 1.6): Promise<Float32Array> {
  const keep = { master, wet, noiseBuf };
  const off = new OfflineAudioContext(1, Math.floor(44100 * seconds), 44100);
  wire(off);
  run(off, name, 0.01);
  const buf = await off.startRendering();
  ({ master, wet, noiseBuf } = keep);
  return buf.getChannelData(0);
}

/** Per i test: l'audio è pronto e acceso? */
export function audioState(): string {
  return ctx?.state ?? "none";
}
