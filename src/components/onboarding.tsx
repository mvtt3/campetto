"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { AvatarPicker } from "@/components/avatar-picker";
import { Mascot } from "@/components/mascot";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/basics";
import { useToast } from "@/components/ui/toast";
import { useData } from "@/lib/data/provider";
import { compressAvatar } from "@/lib/theme";
import { NAME_MAX, nameError, type Player } from "@/lib/types";
import { say } from "@/lib/voice";

/**
 * Primo accesso: ognuno sceglie come apparire nell'app (nome e figurina o foto).
 * Il nome vero resta solo all'amministratore, per abbinare le statistiche.
 */
export function Onboarding({ me }: { me: Player }) {
  const { data, backend, mutate } = useData();
  const toast = useToast();
  const [step, setStep] = useState<0 | 1>(0);
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(me.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const error = nameError(name, data.players, me.id);
  const clean = name.trim().replace(/\s+/g, " ");

  const finish = async () => {
    setBusy(true);
    try {
      await backend.updateMe({ nickname: clean, avatarUrl: avatar });
      mutate((d) => ({ ...d, players: d.players.map((p) => (p.id === me.id ? { ...p, nickname: clean, avatarUrl: avatar } : p)) }));
    } catch (e) {
      const msg = (e as Error).message;
      toast(say(e), "error");
      if (/duplicate|unique|players_nickname/i.test(msg)) setStep(0);
      setBusy(false);
    }
  };

  const preview: Player = { ...me, nickname: clean || null, avatarUrl: avatar };

  return (
    <main className="halftone relative flex h-dvh flex-col overflow-hidden bg-volt text-[#1d1a16]">
      <div className="safe-top safe-bottom relative mx-auto flex w-full max-w-lg flex-1 flex-col px-6 pb-6">
        <div className="flex h-12 items-center">
          {step === 1 && (
            <button onClick={() => setStep(0)} aria-label="Indietro" className="press -ml-2 grid h-11 w-11 place-items-center rounded-full">
              <ArrowLeft size={22} />
            </button>
          )}
          <p className="ml-auto rounded-full border-2 border-[#1d1a16] bg-[#fffaf0] px-3 py-1 text-[13px] font-bold">{step + 1} di 2</p>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {step === 0 ? (
            <motion.div
              key="nome"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.22 }}
              className="flex flex-1 flex-col"
            >
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <Mascot pose="ciao" size={128} className="short:hidden" />
                <h1 className="display mt-3 text-[38px] leading-[0.98] short:text-[32px]">Come ti chiamano al campetto?</h1>
                <p className="mx-auto mt-3 max-w-[32ch] text-[15px] font-medium text-[#3d342a]">È il nome che vedranno tutti nell&apos;app. Puoi cambiarlo quando vuoi.</p>
                <form
                  className="mt-6 w-full"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setTouched(true);
                    if (!error) setStep(1);
                  }}
                >
                  <input
                    autoFocus
                    aria-label="Il tuo nome nell'app"
                    value={name}
                    maxLength={NAME_MAX}
                    autoCapitalize="words"
                    autoComplete="nickname"
                    enterKeyHint="next"
                    placeholder="Es. Pluto"
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => name && setTouched(true)}
                    className="sticker display h-16 w-full rounded-[20px] bg-[#fffaf0] px-5 text-center text-[26px] text-[#1d1a16] outline-none placeholder:text-[#1d1a16]/30"
                  />
                  <p className="mt-2 h-5 text-[13.5px] font-semibold" role="status">
                    {touched && error ? <span className="text-[#b5281a]">{error}</span> : <span className="text-[#3d342a]/70">{clean.length}/{NAME_MAX}</span>}
                  </p>
                </form>
              </div>
              <Button
                variant="court"
                size="lg"
                block
                disabled={!!error}
                onClick={() => {
                  setTouched(true);
                  if (!error) setStep(1);
                }}
              >
                Avanti
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="foto"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.22 }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex items-center gap-4">
                <span className="drop-shadow-[3px_3px_0_#1d1a16]">
                  <Avatar player={preview} size={72} href={false} ring="none" />
                </span>
                <div className="min-w-0">
                  <h1 className="display text-[30px] leading-none short:text-[26px]">Scegli la figurina</h1>
                  <p className="mt-1 truncate text-[15px] font-bold">{clean}</p>
                </div>
              </div>
              <div className="card mt-4 min-h-0 flex-1 overflow-y-auto p-4 text-text">
                <AvatarPicker
                  value={avatar}
                  uploading={uploading}
                  onPreset={setAvatar}
                  onFile={async (f) => {
                    setUploading(true);
                    try {
                      setAvatar(await backend.uploadAvatar(await compressAvatar(f)));
                    } catch (e) {
                      toast(say(e), "error");
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
              </div>
              <Button variant="court" size="lg" block className="mt-4" disabled={busy || uploading} onClick={finish}>
                {busy ? "Un attimo…" : avatar ? "Entra in campo" : "Entra con le iniziali"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
