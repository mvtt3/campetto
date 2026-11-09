/** La versione pubblicata adesso: l'app la confronta con la sua per aggiornarsi da sola. */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { v: process.env.NEXT_PUBLIC_BUILD ?? "dev" },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
