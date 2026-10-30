import { Suspense } from "react";
import { AdvancedPage } from "./advanced-page";

export default function Page() {
  return (
    <Suspense>
      <AdvancedPage />
    </Suspense>
  );
}
