/**
 * I sensori di movimento del telefono, ridotti a due gesti che non si confondono:
 * - inclinare (ruotare, su e giù, in diagonale): un movimento lento che sposta la carta;
 * - scuotere: colpi rapidi avanti e indietro, che fanno barcollare il personaggio.
 * Qui c'è solo la logica, senza DOM: si prova con i test.
 */

export interface Tilt {
  /** Da -1 (a sinistra) a 1 (a destra). */
  x: number;
  /** Da -1 (verso di te) a 1 (lontano da te). */
  y: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * L'inclinazione rispetto a come tieni il telefono di solito: il riferimento si
 * riallinea piano piano, così fermo in qualsiasi posizione la carta torna dritta
 * e si muove solo quando cambi inclinazione.
 */
export function createTiltTracker({
  range = 18,
  settleMs = 1600,
}: { range?: number; settleMs?: number } = {}) {
  let base: { beta: number; gamma: number } | null = null;
  let last = 0;
  return {
    feed(beta: number, gamma: number, t: number): Tilt {
      if (!base || t - last > 1000) base = { beta, gamma };
      const dt = Math.max(0, t - last);
      last = t;
      const k = 1 - Math.exp(-dt / settleMs);
      base.beta += (beta - base.beta) * k;
      base.gamma += (gamma - base.gamma) * k;
      return {
        x: clamp((gamma - base.gamma) / range, -1, 1),
        y: clamp((beta - base.beta) / range, -1, 1),
      };
    },
    reset() {
      base = null;
    },
  };
}

/**
 * L'inclinazione ricavata dalla gravità, per i telefoni senza giroscopio (come il
 * Galaxy A05s), dove Chrome non manda "deviceorientation": stessi angoli e stessi
 * versi di beta (avanti-indietro) e gamma (destra-sinistra).
 */
export function gravityAngles(g: { x: number; y: number; z: number }): {
  beta: number;
  gamma: number;
} {
  const deg = 180 / Math.PI;
  return {
    beta: Math.atan2(g.y, g.z) * deg,
    gamma: Math.atan2(-g.x, Math.hypot(g.y, g.z)) * deg,
  };
}

/**
 * Lo scossone: almeno tre colpi forti in meno di un secondo, con la direzione che
 * cambia. La gravità si toglie da sola, così inclinare o camminare non conta.
 */
export function createShakeDetector({
  threshold = 11,
  hits = 3,
  windowMs = 1000,
  cooldownMs = 1400,
}: {
  threshold?: number;
  hits?: number;
  windowMs?: number;
  cooldownMs?: number;
} = {}) {
  // Valori più bassi di così li fa anche chi cammina col telefono in mano.
  let g: [number, number, number] | null = null;
  let peaks: { t: number; sign: number }[] = [];
  let quietUntil = 0;
  return {
    /**
     * Un campione dell'accelerometro. `linear` è senza gravità (quando il telefono
     * lo dà); altrimenti si passa quella con la gravità e la si toglie qui.
     * Restituisce la forza dello scossone (da 0.6 a 1.4) oppure null.
     */
    feed(
      a: { x: number; y: number; z: number },
      t: number,
      linear = false,
    ): number | null {
      let x = a.x,
        y = a.y,
        z = a.z;
      if (!linear) {
        if (!g) g = [x, y, z];
        g = [g[0] * 0.9 + x * 0.1, g[1] * 0.9 + y * 0.1, g[2] * 0.9 + z * 0.1];
        x -= g[0];
        y -= g[1];
        z -= g[2];
      }
      const m = Math.hypot(x, y, z);
      if (t < quietUntil || m < threshold) return null;
      // Il segno dell'asse più forte (anche verso lo schermo): un colpo vale solo se va
      // dall'altra parte del precedente.
      const axis = [x, y, z].reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a));
      const sign = Math.sign(axis) || 1;
      peaks = peaks.filter((p) => t - p.t < windowMs);
      const prev = peaks[peaks.length - 1];
      if (prev && (prev.sign === sign || t - prev.t < 60)) return null;
      peaks.push({ t, sign });
      if (peaks.length < hits) return null;
      peaks = [];
      quietUntil = t + cooldownMs;
      return clamp(m / 22, 0.6, 1.4);
    },
  };
}
