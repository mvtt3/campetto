import { Suspense } from "react";
import { PlayerBadgesPage } from "./player-badges";

export default function Page() {
  return (
    <Suspense>
      <PlayerBadgesPage />
    </Suspense>
  );
}
