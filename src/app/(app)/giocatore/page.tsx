import { Suspense } from "react";
import { PlayerPage } from "./player-page";

export default function Page() {
  return (
    <Suspense>
      <PlayerPage />
    </Suspense>
  );
}
