"use client";

/**
 * Come si diventa MVP, in breve e a colpo d'occhio: dentro la "i" accanto all'MVP
 * (Home, Classifica, dettaglio della partita). Non conta solo segnare.
 */

const MONTH = [
  {
    label: "Statistiche",
    pct: 45,
    hint: "i punti che segni, poi rimbalzi, assist, rubate e stoppate",
    color: "bg-ball",
  },
  {
    label: "Vittorie",
    pct: 30,
    hint: "quante partite vinci",
    color: "bg-volt",
  },
  { label: "Presenza", pct: 15, hint: "quante partite giochi", color: "bg-ok" },
  {
    label: "Impatto",
    pct: 10,
    hint: "quanto la tua squadra va meglio quando giochi",
    color: "bg-court",
  },
];

/** L'MVP del mese (e della classifica MVP). */
export function MvpMonthInfo({ minGames = 3 }: { minGames?: number }) {
  return (
    <span className="block text-left">
      <span className="block text-center font-bold">
        Conta come giochi, e conta vincere
      </span>
      <span className="mt-2 flex flex-col gap-1.5">
        {MONTH.map((r) => (
          <span key={r.label} className="block">
            <span className="flex items-baseline justify-between gap-2 text-[12.5px]">
              <span className="font-bold">{r.label}</span>
              <span className="tnum font-bold">{r.pct}%</span>
            </span>
            <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-raised">
              <span
                className={`block h-full rounded-full ${r.color}`}
                style={{ width: `${(r.pct / 45) * 100}%` }}
              />
            </span>
            <span className="block text-[11.5px] leading-tight text-muted">
              {r.hint}
            </span>
          </span>
        ))}
      </span>
      <span className="mt-2 block text-center text-[11.5px] text-muted">
        Servono almeno {minGames} partite nel mese. Nelle partite senza
        tabellino contano vittorie, impatto e presenza
      </span>
    </span>
  );
}

/** L'MVP della partita. */
export function MvpMatchInfo() {
  return (
    <span className="block">
      <span className="block font-bold">
        Il migliore della squadra che ha vinto
      </span>
      <span className="mt-1 block text-[12.5px]">
        Conta quanto ha dato alla vittoria: punti, rimbalzi, assist, rubate e
        stoppate. Tiri sbagliati e palle perse tolgono qualcosa
      </span>
      <span className="mt-1.5 block text-[11.5px] text-muted">
        La percentuale dice quanta parte del gioco della squadra è passata da
        lui. Serve il tabellino
      </span>
    </span>
  );
}
