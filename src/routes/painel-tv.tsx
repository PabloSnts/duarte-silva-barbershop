import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BellRing, ChevronLeft, ChevronRight, Maximize, Scissors } from "lucide-react";
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

type Mode = "dia" | "semana" | "mes";

function Board() {
  const state = useStore((s) => s);
  const [now, setNow] = useState(new Date());
  const [note, setNote] = useState<TvEvent | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [mode, setMode] = useState<Mode>("dia");
  const [cur, setCur] = useState(() => new Date());
  const dateKey = (d: Date) => format(d, "yyyy-MM-dd");
  const move = (n: number) => setCur((c) =>
    mode === "dia" ? addDays(c, n) : mode === "semana" ? addWeeks(c, n) : addMonths(c, n)
  );
  const selectedLabel =
    mode === "dia"
      ? format(cur, "EEEE, d 'de' MMMM", { locale: ptBR })
      : mode === "semana"
        ? `${format(startOfWeek(cur, { weekStartsOn: 1 }), "d MMM", { locale: ptBR })} – ${format(endOfWeek(cur, { weekStartsOn: 1 }), "d MMM", { locale: ptBR })}`
        : format(cur, "MMMM yyyy", { locale: ptBR });


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

  const t = dateKey(cur);
  const isToday = t === today();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const list = state.bookings.filter((b) => b.date === t && b.status !== "cancelada").sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = list.filter((b) => b.status === "confirmada" && (!isToday || toMin(endOf(b, state.services)) > nowMin));
  const current = isToday ? upcoming.find((b) => toMin(startOf(b)) <= nowMin) : undefined;
  const nextOnes = upcoming.filter((b) => b !== current).slice(0, 3);
  const free = state.settings.showFreeOnTv ? freeSlots(state, t).filter((x) => !isToday || toMin(x) > nowMin).slice(0, 8) : [];
  const bookingsOn = (d: Date) => state.bookings.filter((b) => b.date === dateKey(d) && b.status !== "cancelada").sort((a, b) => a.start.localeCompare(b.start));
  const name = (n: string) => displayName(n, state.settings.tvClientInfo);
  const label = (b: (typeof list)[number]) => (state.settings.tvClientInfo === "none" ? serviceNames(b, state.services) : `${name(b.client)} - ${serviceNames(b, state.services)}`);
  const noteTitle = note?.kind === "nova" ? "Nova reserva confirmada!" : note?.kind === "cancelada" ? "Reserva cancelada" : "Reserva alterada";

  return (
    <div className="flex min-h-screen flex-col bg-background p-4 sm:p-8 xl:h-screen xl:overflow-hidden xl:p-12">
      <header className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-5">
          <div className="grid h-16 w-16 place-items-center rounded-xl bg-gold text-primary-foreground"><Scissors className="h-8 w-8" /></div>
          <div>
            <h1 className="text-3xl font-bold uppercase sm:text-5xl">{state.settings.shopName}</h1>
            <p className="text-xl capitalize text-muted-foreground">{format(now, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <p className="font-display text-5xl font-bold tabular-nums text-primary sm:text-7xl">{format(now, "HH:mm")}</p>
          <button onClick={() => document.documentElement.requestFullscreen?.()} className="rounded-lg p-2 text-muted-foreground/40 hover:text-muted-foreground" aria-label="Tela cheia">
            <Maximize className="h-6 w-6" />
          </button>
        </div>
      </header>

      <div className="mt-7 flex flex-wrap items-center gap-3" role="group" aria-label="Filtros de data da TV">
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          {(["dia", "semana", "mes"] as Mode[]).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`rounded-md px-3 py-1.5 text-sm capitalize ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {m === "mes" ? "Mês" : m}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Período anterior" onClick={() => move(-1)} className="rounded-lg p-2 hover:bg-card"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => setCur(new Date())} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-card">Hoje</button>
          <button type="button" aria-label="Próximo período" onClick={() => move(1)} className="rounded-lg p-2 hover:bg-card"><ChevronRight className="h-5 w-5" /></button>
        </div>
        <p className="font-display text-xl font-bold capitalize sm:text-2xl" aria-live="polite">{selectedLabel}</p>
      </div>

      {mode === "dia" ? (
      <div className="mt-6 grid min-h-0 flex-1 gap-8 overflow-y-auto lg:grid-cols-[1.4fr_1fr]">
        <section className="flex min-h-0 flex-col">
          <h2 className="mb-4 text-3xl font-bold uppercase text-muted-foreground">Agenda do dia</h2>
          <div className="grid min-h-0 content-start gap-3 overflow-y-auto">
            {list.length === 0 && <p className="text-3xl text-muted-foreground">Nenhum atendimento agendado nesta data.</p>}
            {list.slice(0, 9).map((b) => (
              <div key={b.id} className={`grid grid-cols-[85px_minmax(0,1fr)] items-center gap-3 rounded-2xl border bg-card px-4 py-3 xl:grid-cols-[150px_minmax(0,1fr)_auto] xl:gap-6 xl:px-6 xl:py-4 ${b === current ? "border-primary shadow-gold" : "border-border"} ${b.status === "concluida" || b.status === "ausente" ? "opacity-50" : ""}`}>
                <p className="font-display text-3xl font-bold tabular-nums xl:text-5xl">{startOf(b)}</p>
                <div className="min-w-0">
                  <p className="truncate text-xl font-semibold xl:text-3xl">{label(b)}</p>
                  <p className="truncate text-sm text-muted-foreground xl:text-xl">{serviceNames(b, state.services)} · até {endOf(b, state.services)}</p>
                </div>
                <span className={`col-span-2 justify-self-start rounded-full border px-4 py-1.5 text-sm font-semibold xl:col-span-1 xl:text-lg ${statusStyle[b.status]}`}>{b === current ? "Em atendimento" : statusLabel[b.status]}</span>
              </div>
            ))}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-5 overflow-y-auto">
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

      ) : mode === "semana" ? (
        <section className="mt-6 min-h-0 flex-1 overflow-auto">
          <div className="grid gap-3 md:grid-cols-7">
            {eachDayOfInterval({ start: startOfWeek(cur, { weekStartsOn: 1 }), end: endOfWeek(cur, { weekStartsOn: 1 }) }).map((d) => {
              const bookings = bookingsOn(d);
              return (
                <div key={dateKey(d)} className={`min-w-0 rounded-2xl border bg-card p-3 ${dateKey(d) === today() ? "border-primary" : "border-border"}`}>
                  <button type="button" onClick={() => { setCur(d); setMode("dia"); }} className="mb-4 w-full rounded-lg text-left hover:text-primary" aria-label={`Abrir agenda de ${format(d, "dd/MM/yyyy")}`}>
                    <p className="text-base capitalize text-muted-foreground">{format(d, "EEEE", { locale: ptBR })}</p>
                    <p className="font-display text-4xl font-bold">{format(d, "d")}</p>
                    <p className="text-sm text-muted-foreground">{bookings.length} reservas</p>
                  </button>
                  <div className="grid gap-2">
                    {bookings.map((b) => (
                      <div key={b.id} className={`min-w-0 rounded-lg border p-2 ${statusStyle[b.status]}`}>
                        <p className="font-display text-xl font-bold">{startOf(b)}</p>
                        <p className="truncate text-sm font-semibold text-foreground">{label(b)}</p>
                        <p className="truncate text-xs text-muted-foreground">{statusLabel[b.status]}</p>
                      </div>
                    ))}
                    {!bookings.length && <p className="text-sm text-muted-foreground">Sem reservas</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="mt-6 min-h-0 flex-1 overflow-auto">
          <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((w) => <p key={w} className="pb-1 text-center text-xs font-semibold text-muted-foreground sm:text-base">{w}</p>)}
            {eachDayOfInterval({ start: startOfWeek(startOfMonth(cur), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(cur), { weekStartsOn: 1 }) }).map((d) => {
              const n = bookingsOn(d).length;
              return (
                <button key={dateKey(d)} type="button" onClick={() => { setCur(d); setMode("dia"); }} aria-label={`Ver agenda de ${format(d, "dd/MM/yyyy")}, ${n} reservas`}
                  className={`min-h-16 rounded-xl border p-2 text-left transition-colors hover:border-primary sm:min-h-24 sm:p-4 ${dateKey(d) === today() ? "border-primary" : "border-border"} ${isSameMonth(d, cur) ? "bg-card" : "opacity-40"}`}>
                  <p className="font-display text-xl font-bold sm:text-3xl">{format(d, "d")}</p>
                  {n > 0 && <><span className="mt-1 block h-1.5 max-w-32 rounded-full bg-primary" /><p className="mt-1 text-[10px] text-primary sm:text-sm">{n} reservas</p></>}
                </button>
              );
            })}
          </div>
        </section>
      )}

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
