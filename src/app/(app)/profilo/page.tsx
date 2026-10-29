"use client";

import { useState } from "react";
import { FullStats } from "@/components/profile/full-stats";
import { ProfileHeader } from "@/components/profile/profile-header";
import { RelationsList } from "@/components/profile/relations-list";
import { TrendChart } from "@/components/profile/trend-chart";
import { Form, KeyRings } from "@/components/profile/key-stats";
import { Segmented } from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useData } from "@/lib/data/provider";

type Tab = "panoramica" | "numeri";

export default function MyProfilePage() {
  const { me } = useData();
  const [tab, setTab] = useState<Tab>("panoramica");
  if (!me) return null;

  return (
    <>
      <div className="safe-top shrink-0 px-5 pt-4">
        <ProfileHeader player={me} self />
        <Segmented
          className="mt-3"
          value={tab}
          onChange={setTab}
          options={[
            { value: "panoramica", label: "Panoramica" },
            { value: "numeri", label: "Tutti i numeri" },
          ]}
        />
      </div>

      {tab === "panoramica" ? (
        <PullToRefresh scroll={false} className="px-5 pb-2 pt-3">
          <div className="flex h-full flex-col gap-3 short:gap-2">
            <KeyRings playerId={me.id} />
            <Form playerId={me.id} />
            <div className="card min-h-0 flex-1 p-4 short:hidden">
              <TrendChart playerId={me.id} />
            </div>
          </div>
        </PullToRefresh>
      ) : (
        <PullToRefresh className="px-5 pb-4 pt-3">
          <div className="card mb-4 h-52 p-4">
            <TrendChart playerId={me.id} />
          </div>
          <FullStats playerId={me.id} />
          <div className="mt-5">
            <RelationsList playerId={me.id} />
          </div>
        </PullToRefresh>
      )}
    </>
  );
}
