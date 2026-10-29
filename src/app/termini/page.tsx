import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Termini · Campetto" };

export default function TermsPage() {
  return (
    <LegalPage title="Termini" updated="29 ottobre 2026">
      <h2>Uso dell&apos;app</h2>
      <p>
        Campetto è un&apos;app privata per un gruppo di amici. Si accede solo su invito e serve a registrare partite,
        statistiche e presenze al campetto. È gratuita e fornita così com&apos;è, senza garanzie.
      </p>
      <h2>Comportamento</h2>
      <p>
        Inserisci risultati e statistiche onestamente. L&apos;amministratore può correggere o eliminare partite sbagliate e
        rimuovere chi usa l&apos;app in modo scorretto.
      </p>
      <h2>Contenuti</h2>
      <p>
        Le foto che carichi devono essere tue o avere il permesso di chi ci compare. I video delle partite restano sul tuo
        telefono: l&apos;app non li carica da nessuna parte.
      </p>
    </LegalPage>
  );
}
