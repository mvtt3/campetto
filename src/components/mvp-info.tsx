"use client";

/**
 * Come si diventa MVP, in breve e a colpo d'occhio: dentro la "i" accanto all'MVP
 * (Home, Classifica, dettaglio della partita). Non conta solo segnare.
 */

const MONTH = [
  { label: "Vittorie", pct: 35, hint: "vincere conta più di tutto", color: "bg-volt" },
  { label: "Statistiche", pct: 30, hint: "punti, rimbalzi, assist, rubate, stoppate", color: "bg-ball" },
  { label: "Impatto", pct: 20, hint: "quanto la squadra va meglio con te", color: "bg-court" },
  { label: "Presenza", pct: 15, hint: "quante volte vieni", color: "bg-ok" },
];

/** L'MVP del mese (e della classifica MVP). */
export function MvpMonthInfo({ minGames = 3 }: { minGames?: number }) {
  return (
    <span className="block text-left">
      <span className="block text-center font-bold">Non è chi segna di più: è chi fa vincere</span>
      <span className="mt-2 flex flex-col gap-1.5">
        {MONTH.map((r) => (
          <span key={r.label} className="block">
            <span className="flex items-baseline justify-between gap-2 text-[12.5px]">
              <span className="font-bold">{r.label}</span>
              <span className="tnum font-bold">{r.pct}%</span>
            </span>
            <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-raised">
              <span className={`block h-full rounded-full ${r.color}`} style={{ width: `${(r.pct / 35) * 100}%` }} />
            </span>
            <span className="block text-[11.5px] leading-tight text-muted">{r.hint}</span>
          </span>
        ))}
      </span>
      <span className="mt-2 block text-center text-[11.5px] text-muted">
        Servono almeno {minGames} partite. Senza tabellino contano vittorie, impatto e presenza
      </span>
    </span>
  );
}

/** L'MVP della partita. */
export function MvpMatchInfo() {
  return (
    <span className="block">
      <span className="block font-bold">Il migliore della squadra che vince</span>
      <span className="mt-1 block text-[12.5px]">
        Conta quanto hai dato alla vittoria: punti, rimbalzi, assist, rubate e stoppate. Tiri sbagliati e palle perse tolgono qualcosa
      </span>
      <span className="mt-1.5 block text-[11.5px] text-muted">La percentuale è la sua parte di punti, rimbalzi, assist, rubate e stoppate della squadra. Serve il tabellino</span>
    </span>
  );
}
