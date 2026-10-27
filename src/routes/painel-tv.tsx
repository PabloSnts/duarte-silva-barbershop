import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BellRing, Maximize, Scissors } from "lucide-react";
import { z } from "zod";
import { displayName, endOf, serviceNames, startOf, freeSlots, onTvEvent, pairTv, statusLabel, today, toMin, type TvEvent, useStore } from "@/lib/store";
import { statusStyle } from "@/components/booking";

export const Route = createFileRoute("/painel-tv")({
  validateSearch: z.object({ code: z.string().max(12).optional(), local: z.number().optional() }),
  head: () => ({
    meta: [
      { title: "Painel da TV — Barbearia" },
      { name: "description", content: "Agenda do dia em tela cheia para a TV da barbearia." },
      { property: "og:title", content: "Painel da TV — Barbearia" },
      { property: "og:description", content: "Agenda do dia exibida na televisão." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TvDisplay,
});

function TvDisplay() {
  const search = Route.useSearch();
  const state = useStore((s) => s);
  const [paired, setPaired] = useState(false);
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!state.loaded || paired) return;
    if (search.local || state.tv.connected) setPaired(true);
    else if (search.code && pairTv(search.code)) setPaired(true);
  }, [state.loaded, state.tv.connected, search, paired]);

  useEffect(() => {
    if (paired && state.loaded && !state.tv.connected && !search.local) setPaired(false);
  }, [state.tv.connected, state.loaded, paired, search.local]);

  if (!paired) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-8">
        <div className="w-full max-w-lg text-center">
          <Scissors className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-4 text-5xl font-bold uppercase">Conectar esta TV</h1>
          <p className="mt-2 text-lg text-muted-foreground">Digite o código exibido em “Visualização na TV” no painel do barbeiro.</p>
          <form
            className="mt-8 flex gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (pairTv(input)) setPaired(true);
              else setErr("Código inválido ou expirado");
            }}
          >
            <input
              value={input}
              maxLength={6}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              className="min-w-0 flex-1 rounded-xl border border-input bg-card px-4 py-4 text-center font-display text-4xl tracking-[0.3em] outline-none focus:border-primary"
              placeholder="------"
            />
            <button className="rounded-xl bg-gold px-6 font-semibold text-primary-foreground">Conectar</button>
          </form>
          {err && <p className="mt-3 text-destructive">{err}</p>}
        </div>
      </div>
    );
  }
  return <Board />;
}

function Board() {
  const state = useStore((s) => s);
  const [now, setNow] = useState(new Date());
  const [note, setNote] = useState<TvEvent | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(
    () =>
      onTvEvent((e) => {
        setNote(e);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setNote(null), 7000);
        if (state.settings.sound) {
          try {
            const ctx = new AudioContext();
            const o = ctx.createOscillator();
            o.frequency.value = 880;
            o.connect(ctx.destination);
            o.start();
            o.stop(ctx.currentTime + 0.25);
          } catch {
            /* autoplay blocked */
          }
        }
      }),
    [state.settings.sound],
  );

  const t = today();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const list = state.bookings.filter((b) => b.date === t && b.status !== "cancelada").sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = list.filter((b) => b.status === "confirmada" && toMin(endOf(b, state.services)) > nowMin);
  const current = upcoming.find((b) => toMin(startOf(b)) <= nowMin);
  const nextOnes = upcoming.filter((b) => b !== current).slice(0, 3);
  const free = state.settings.showFreeOnTv ? freeSlots(state, t).filter((x) => toMin(x) > nowMin).slice(0, 8) : [];
  const svc = (id: string) => state.services.find((s) => s.id === id)?.name ?? "";
  const name = (n: string) => displayName(n, state.settings.tvClientInfo);
  const label = (b: (typeof list)[number]) => (state.settings.tvClientInfo === "none" ? serviceNames(b, state.services) : `${name(b.client)} - ${serviceNames(b, state.services)}`);
  const noteTitle = note?.kind === "nova" ? "Nova reserva confirmada!" : note?.kind === "cancelada" ? "Reserva cancelada" : "Reserva alterada";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background p-8 xl:p-12">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="grid h-16 w-16 place-items-center rounded-xl bg-gold text-primary-foreground"><Scissors className="h-8 w-8" /></div>
          <div>
            <h1 className="text-5xl font-bold uppercase">{state.settings.shopName}</h1>
            <p className="text-xl capitalize text-muted-foreground">{format(now, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <p className="font-display text-7xl font-bold tabular-nums text-primary">{format(now, "HH:mm")}</p>
          <button onClick={() => document.documentElement.requestFullscreen?.()} className="rounded-lg p-2 text-muted-foreground/40 hover:text-muted-foreground" aria-label="Tela cheia">
            <Maximize className="h-6 w-6" />
          </button>
        </div>
      </header>

      <div className="mt-10 grid min-h-0 flex-1 grid-cols-[1.4fr_1fr] gap-8">
        <section className="flex min-h-0 flex-col">
          <h2 className="mb-4 text-3xl font-bold uppercase text-muted-foreground">Agenda de hoje</h2>
          <div className="grid min-h-0 gap-3 overflow-hidden">
            {list.length === 0 && <p className="text-3xl text-muted-foreground">Nenhum atendimento agendado hoje.</p>}
            {list.slice(0, 9).map((b) => (
              <div key={b.id} className={`grid grid-cols-[150px_minmax(0,1fr)_auto] items-center gap-6 rounded-2xl border bg-card px-6 py-4 ${b === current ? "border-primary shadow-gold" : "border-border"} ${b.status === "concluida" || b.status === "ausente" ? "opacity-50" : ""}`}>
                <p className="font-display text-5xl font-bold tabular-nums">{startOf(b)}</p>
                <div className="min-w-0">
                  <p className="truncate text-3xl font-semibold">{label(b)}</p>
                  <p className="truncate text-xl text-muted-foreground">{serviceNames(b, state.services)} · até {endOf(b, state.services)}</p>
                </div>
                <span className={`rounded-full border px-4 py-1.5 text-lg font-semibold ${statusStyle[b.status]}`}>{b === current ? "Em atendimento" : statusLabel[b.status]}</span>
              </div>
            ))}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-8">
          <div className="rounded-2xl border border-primary/30 bg-card p-6">
            <h2 className="text-2xl font-bold uppercase text-primary">Próximos</h2>
            <div className="mt-4 grid gap-4">
              {nextOnes.length ? nextOnes.map((b) => (
                <div key={b.id} className="flex items-baseline justify-between gap-4">
                  <p className="truncate text-3xl font-semibold">{label(b)}</p>
                  <p className="font-display text-4xl font-bold tabular-nums">{startOf(b)}</p>
                </div>
              )) : <p className="text-2xl text-muted-foreground">Sem próximos atendimentos</p>}
            </div>
          </div>
          {state.settings.showFreeOnTv && (
            <div className="rounded-2xl border border-success/30 bg-card p-6">
              <h2 className="text-2xl font-bold uppercase text-success">Horários livres</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                {free.length ? free.map((f) => <span key={f} className="rounded-xl bg-free px-4 py-2 font-display text-3xl font-bold text-success">{f}</span>) : <p className="text-2xl text-muted-foreground">Agenda cheia</p>}
              </div>
            </div>
          )}
        </aside>
      </div>

      <footer className="mt-6 text-lg text-muted-foreground">Última atualização: {state.updatedAt ? format(state.updatedAt, "HH:mm:ss") : "—"}</footer>

      {note && (
        <div className="pointer-events-none fixed inset-x-0 top-10 z-50 flex justify-center">
          <div className={`animate-toast-in flex items-center gap-6 rounded-3xl border-2 bg-popover px-10 py-6 shadow-gold ${note.kind === "cancelada" ? "border-destructive" : "border-primary"}`}>
            <BellRing className={`h-14 w-14 ${note.kind === "cancelada" ? "text-destructive" : "text-primary"}`} />
            <div>
              <p className="font-display text-5xl font-bold uppercase">{noteTitle}</p>
              <p className="text-2xl text-muted-foreground">
                {note.booking.date.split("-").reverse().slice(0, 2).join("/")} às {note.booking.start} · {serviceNames(note.booking, state.services)}
                {state.settings.tvClientInfo !== "none" && ` · ${name(note.booking.client)}`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
