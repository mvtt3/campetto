import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy · Campetto" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="29 ottobre 2026">
      <h2>Chi gestisce l&apos;app</h2>
      <p>
        Campetto è un&apos;app gratuita e non commerciale, usata da un gruppo di amici per registrare le partite di basket
        al campetto. La gestisce Matteo Pepe, che puoi contattare per qualsiasi richiesta sui tuoi dati.
      </p>
      <h2>Quali dati usiamo</h2>
      <p>
        Quando entri con Google riceviamo nome, email e foto del tuo account Google. Nell&apos;app salviamo il tuo profilo
        giocatore (nome, ruolo, soprannome, numero di maglia, foto se la carichi), le partite a cui partecipi con le relative
        statistiche, le tue risposte alle proposte di partita e, se le attivi, l&apos;indirizzo tecnico per inviarti le
        notifiche.
      </p>
      <h2>Perché</h2>
      <p>
        Solo per far funzionare l&apos;app: mostrare partite, statistiche e classifiche al gruppo e avvisarti delle partite in
        programma. Non vendiamo né cediamo dati a nessuno e non usiamo pubblicità o tracciamenti.
      </p>
      <h2>Chi li vede</h2>
      <p>
        Solo i giocatori del gruppo che hanno fatto l&apos;accesso. I dati sono conservati su Supabase (server in Europa) e
        l&apos;app è ospitata su Vercel.
      </p>
      <h2>I tuoi diritti</h2>
      <p>
        Puoi chiedere in qualsiasi momento di vedere, correggere o cancellare i tuoi dati, oppure di uscire dal gruppo. Le
        notifiche si spengono dalle impostazioni del profilo.
      </p>
    </LegalPage>
  );
}
