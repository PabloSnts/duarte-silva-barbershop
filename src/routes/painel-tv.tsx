import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BellRing, ChevronLeft, ChevronRight, Maximize, Plus, Scissors, UserX } from "lucide-react";
import { z } from "zod";
import { displayName, endOf, serviceNames, startOf, freeSlots, onTvEvent, onVacation, pairTv, setStatus, statusLabel, today, toMin, type TvEvent, useAutoCompleteBookings, useStore } from "@/lib/store";
import { statusStyle, useBookingDialogs } from "@/components/booking";

const tvStatusLabel = { ...statusLabel, confirmada: "Agendado" };
const tvStatusStyle = { ...statusStyle, confirmada: "bg-success/15 text-success border-success/30" };

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
const weekdays = [
  { id: 1, label: "Seg" }, { id: 2, label: "Ter" }, { id: 3, label: "Qua" },
  { id: 4, label: "Qui" }, { id: 5, label: "Sex" }, { id: 6, label: "Sáb" },
  { id: 0, label: "Dom" },
];

function Board() {
  const state = useStore((s) => s);
  useAutoCompleteBookings();
  const bookingDialogs = useBookingDialogs();
  const [now, setNow] = useState(new Date());
  const [note, setNote] = useState<TvEvent | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [mode, setMode] = useState<Mode>("dia");
  const [cur, setCur] = useState(() => new Date());
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [contentHeight, setContentHeight] = useState(520);
  const dateKey = (d: Date) => format(d, "yyyy-MM-dd");
  const activeWeekdays = weekdays.filter(({ id }) => state.settings.workDays.includes(id));
  const isWorkday = (d: Date) =>
    state.settings.workDays.includes(d.getDay()) && !onVacation(state, dateKey(d));

  // Pula folgas e férias na navegação diária, inclusive após mudanças no expediente.
  const nextWorkingDay = (date: Date, direction: number) => {
    if (!activeWeekdays.length) return date;
    let result = date;
    for (let i = 0; i < 3660; i++) {
      result = addDays(result, direction);
      if (isWorkday(result)) return result;
    }
    return date;
  };
  const move = (n: number) => setCur((c) =>
    mode === "dia" ? nextWorkingDay(c, n) : mode === "semana" ? addWeeks(c, n) : addMonths(c, n)
  );
  const goToToday = () => {
    const d = new Date();
    setCur(mode === "dia" && !isWorkday(d) ? nextWorkingDay(d, 1) : d);
  };
  useEffect(() => {
    if (state.loaded && mode === "dia" && activeWeekdays.length && !isWorkday(cur)) {
      setCur(nextWorkingDay(cur, 1));
    }
  }, [state.loaded, mode, cur, state.settings.workDays, state.settings.vacations]);

  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setContentHeight(entry.contentRect.height);
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [mode]);
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
  const weekStart = startOfWeek(cur, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(cur, { weekStartsOn: 1 }) })
    .filter(isWorkday);
  const monthDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cur), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(cur), { weekStartsOn: 1 }),
  });
  // Cada linha mantém as colunas de dias úteis alinhadas; férias viram células vazias.
  const monthWeeks = Array.from({ length: monthDays.length / 7 }, (_, i) =>
    monthDays.slice(i * 7, i * 7 + 7).filter((day) => state.settings.workDays.includes(day.getDay()))
  );
  // Limita os cartões ao espaço real da TV, sem scroll nem corte silencioso.
  const dayCapacity = Math.max(1, Math.floor((contentHeight - 40) / 66));
  const visibleDay = list.length > dayCapacity ? list.slice(0, Math.max(0, dayCapacity - 1)) : list;
  const dayRemaining = list.length - visibleDay.length;
  const weekCapacity = Math.max(1, Math.floor((contentHeight - 94) / 73));
  const maxWeekBookings = Math.max(0, weekCapacity - 1);
  const gridCols = { gridTemplateColumns: `repeat(${activeWeekdays.length}, minmax(0, 1fr))` };


  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background p-3 sm:p-4 lg:p-5 2xl:p-6">
      <header className="flex shrink-0 items-center justify-between gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <img
            src="/duarte-silva-logo.webp"
            alt="Logo Duarte & Silva Barbearia"
            width={190}
            height={81}
            className="h-10 w-24 shrink-0 object-contain sm:h-12 sm:w-28 xl:h-14 xl:w-36"
          />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold uppercase sm:text-2xl xl:text-3xl">{state.settings.shopName}</h1>
            <p className="truncate text-xs capitalize text-muted-foreground sm:text-sm">{format(now, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <p className="font-display text-3xl font-bold tabular-nums text-primary sm:text-4xl xl:text-5xl">{format(now, "HH:mm")}</p>
          <button type="button" onClick={() => document.documentElement.requestFullscreen?.()} className="rounded-lg p-2 text-muted-foreground hover:text-foreground" aria-label="Tela cheia">
            <Maximize className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2 sm:gap-3" role="group" aria-label="Filtros de data da TV">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5 sm:p-1">
          {(["dia", "semana", "mes"] as Mode[]).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 text-xs capitalize sm:px-3 sm:py-1.5 sm:text-sm ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {m === "mes" ? "Mês" : m}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Período anterior" onClick={() => move(-1)}
            disabled={mode === "dia" && !activeWeekdays.length}
            className="rounded-lg p-1.5 hover:bg-card disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={goToToday} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-card sm:text-sm">Hoje</button>
          <button type="button" aria-label="Próximo período" onClick={() => move(1)}
            disabled={mode === "dia" && !activeWeekdays.length}
            className="rounded-lg p-1.5 hover:bg-card disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <p className="min-w-0 truncate font-display text-base font-bold capitalize sm:text-xl" aria-live="polite">{selectedLabel}</p>
        <button type="button" onClick={bookingDialogs.create}
          className="ml-auto inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-primary-foreground shadow-gold transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-sm"
          aria-label="Nova reserva">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nova reserva
        </button>
      </div>

      {!activeWeekdays.length ? (
        <div className="mt-3 grid min-h-0 flex-1 place-items-center rounded-xl border border-border bg-card p-4 text-center text-muted-foreground">
          Nenhum dia de trabalho configurado. Defina seus dias em Expediente e férias.
        </div>
      ) : mode === "dia" ? (
        <div ref={contentRef} className="mt-3 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden sm:grid-cols-[minmax(0,1.6fr)_minmax(210px,1fr)]">
          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            <h2 className="mb-2 shrink-0 text-base font-bold uppercase text-muted-foreground sm:text-lg">Agenda do dia</h2>
            <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
              {list.length === 0 && <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Nenhum atendimento nesta data.</p>}
              {visibleDay.map((b) => (
                <div key={b.id}
                  className={`grid min-h-0 shrink-0 grid-cols-[56px_minmax(0,1fr)] items-center gap-2 rounded-xl border bg-card px-2 py-2 sm:grid-cols-[64px_minmax(0,1fr)] lg:grid-cols-[72px_minmax(0,1fr)_auto] ${b === current ? "border-primary shadow-gold" : "border-border"} ${b.status === "concluida" || b.status === "ausente" ? "opacity-60" : ""}`}>
                  <p className="font-display text-xl font-bold tabular-nums sm:text-2xl">{startOf(b)}</p>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold lg:text-base">{label(b)}</p>
                    <p className="truncate text-xs text-muted-foreground">{serviceNames(b, state.services)} · até {endOf(b, state.services)}</p>
                  </div>
                  <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-between gap-1.5 lg:col-span-1 lg:flex-nowrap lg:justify-end">
                    <span
                      title={tvStatusLabel[b.status]}
                      aria-label={tvStatusLabel[b.status]}
                      className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold lg:text-xs ${tvStatusStyle[b.status]}`}
                    >
                      {tvStatusLabel[b.status]}
                    </span>
                    {b.status !== "ausente" && b.status !== "cancelada" && (
                      <button type="button" onClick={() => setStatus(b.id, "ausente")}
                        aria-label={`Marcar ${b.client} como ausente`}
                        title="Marcar cliente como ausente"
                        className="inline-flex h-7 w-8 shrink-0 items-center justify-center rounded-lg border border-warning/50 bg-warning/10 text-warning transition-colors hover:bg-warning/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning">
                        <UserX className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {dayRemaining > 0 && (
                <p className="shrink-0 rounded-lg border border-border bg-card px-2 py-1.5 text-center text-xs text-muted-foreground">
                  + {dayRemaining} atendimento{dayRemaining === 1 ? "" : "s"} nesta data
                </p>
              )}
            </div>
          </section>

          <aside className="hidden min-h-0 min-w-0 flex-col gap-3 overflow-hidden sm:flex">
            <div className="min-h-0 shrink-0 rounded-xl border border-primary/30 bg-card p-3">
              <h2 className="text-lg font-bold uppercase text-primary">Próximos</h2>
              <div className="mt-2 grid gap-2">
                {nextOnes.length ? nextOnes.slice(0, 3).map((b) => (
                  <div key={b.id} className="flex min-w-0 items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{label(b)}</p>
                    <p className="shrink-0 font-display text-xl font-bold tabular-nums">{startOf(b)}</p>
                  </div>
                )) : <p className="text-sm text-muted-foreground">Sem próximos atendimentos</p>}
              </div>
            </div>
            {state.settings.showFreeOnTv && (
              <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-success/30 bg-card p-3">
                <h2 className="text-lg font-bold uppercase text-success">Horários livres</h2>
                <div className="mt-2 flex flex-wrap content-start gap-1.5 overflow-hidden">
                  {free.length ? free.slice(0, 8).map((f) => (
                    <span key={f} className="rounded-lg bg-free px-2 py-1 font-display text-lg font-bold text-success">{f}</span>
                  )) : <p className="text-sm text-muted-foreground">Sem horários livres</p>}
                </div>
              </div>
            )}
          </aside>
        </div>
      ) : mode === "semana" ? (
        <section ref={contentRef} className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
          {!weekDays.length ? (
            <p className="grid min-h-0 flex-1 place-items-center rounded-xl border border-border bg-card p-4 text-center text-muted-foreground">Sem expediente nesta semana.</p>
          ) : (
            <div className="grid min-h-0 flex-1 gap-2 overflow-hidden" style={{ gridTemplateColumns: `repeat(${weekDays.length}, minmax(0, 1fr))` }}>
              {weekDays.map((d) => {
                const bs = bookingsOn(d);
                const shown = bs.length > weekCapacity ? bs.slice(0, maxWeekBookings) : bs;
                const remaining = bs.length - shown.length;
                return (
                  <div key={dateKey(d)} className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card p-2 ${dateKey(d) === today() ? "border-primary" : "border-border"}`}>
                    <button type="button" onClick={() => { setCur(d); setMode("dia"); }}
                      className="mb-2 shrink-0 rounded-lg text-left hover:text-primary" aria-label={`Abrir agenda de ${format(d, "dd/MM/yyyy")}`}>
                      <p className="truncate text-xs capitalize text-muted-foreground sm:text-sm">{format(d, "EEEE", { locale: ptBR })}</p>
                      <p className="font-display text-2xl font-bold sm:text-3xl">{format(d, "d")}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{bs.length} reservas</p>
                    </button>
                    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                      {shown.map((b) => (
                        <div key={b.id} className={`min-w-0 shrink-0 rounded-md border px-1.5 py-1 ${b.status === "ausente" ? "border-warning/40 bg-warning/15" : "border-success/40 bg-success/15"}`}>
                          <p className="truncate text-xs font-bold text-foreground">{startOf(b)} · {name(b.client)}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{serviceNames(b, state.services)}</p>
                          <div className="mt-1 flex min-w-0 flex-wrap items-center justify-between gap-1">
                            <span
                              title={tvStatusLabel[b.status]}
                              aria-label={tvStatusLabel[b.status]}
                              className={`inline-flex items-center text-[10px] font-semibold ${b.status === "ausente" ? "text-warning" : "text-success"}`}
                            >
                              {tvStatusLabel[b.status]}
                            </span>
                            {b.status !== "ausente" && b.status !== "cancelada" && (
                              <button type="button" onClick={() => setStatus(b.id, "ausente")}
                                title={`Marcar ${b.client} como ausente`}
                                aria-label={`Marcar ${b.client} como ausente`}
                                className="inline-flex h-6 w-7 shrink-0 items-center justify-center rounded border border-warning/40 bg-warning/10 text-warning hover:bg-warning/20">
                                <UserX className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {remaining > 0 && <p className="truncate rounded-md bg-muted px-1.5 py-1 text-[11px] text-muted-foreground">+ {remaining} reservas</p>}
                      {!bs.length && <p className="text-xs text-muted-foreground">Sem reservas</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
            <div className="grid shrink-0 gap-1.5" style={gridCols}>
              {activeWeekdays.map((w) => <p key={w.id} className="truncate text-center text-xs font-semibold text-muted-foreground sm:text-sm">{w.label}</p>)}
            </div>
            <div className="grid min-h-0 flex-1 gap-1.5 overflow-hidden" style={{ gridTemplateRows: `repeat(${monthWeeks.length}, minmax(0, 1fr))` }}>
              {monthWeeks.map((week, i) => (
                <div key={i} className="grid min-h-0 gap-1.5" style={gridCols}>
                  {week.map((d) => {
                    const holiday = !isWorkday(d);
                    const n = bookingsOn(d).length;
                    return holiday ? (
                      <div key={dateKey(d)} aria-label={`Férias: ${format(d, "dd/MM/yyyy")}`} className="rounded-lg bg-muted/20" />
                    ) : (
                      <button key={dateKey(d)} type="button" onClick={() => { setCur(d); setMode("dia"); }}
                        aria-label={`Ver agenda de ${format(d, "dd/MM/yyyy")}, ${n} reservas`}
                        className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border p-1 text-left transition-colors hover:border-primary sm:p-2 ${dateKey(d) === today() ? "border-primary" : "border-border"} ${isSameMonth(d, cur) ? "bg-card" : "opacity-40"}`}>
                        <p className="font-display text-lg font-bold sm:text-xl xl:text-2xl">{format(d, "d")}</p>
                        {n > 0 && <>
                          <span className="mt-0.5 h-1 w-full max-w-24 shrink-0 rounded-full bg-primary" />
                          <p className="mt-0.5 truncate text-[10px] text-primary sm:text-xs">{n} reservas</p>
                        </>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="mt-2 shrink-0 text-xs text-muted-foreground">
        Última atualização: {state.updatedAt ? format(state.updatedAt, "HH:mm:ss") : "—"}
      </footer>

      {bookingDialogs.node}

      {note && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div className={`flex max-w-full items-center gap-3 rounded-xl border-2 bg-popover px-4 py-3 shadow-gold ${note.kind === "cancelada" ? "border-destructive" : "border-primary"}`}>
            <BellRing className={`h-8 w-8 shrink-0 ${note.kind === "cancelada" ? "text-destructive" : "text-primary"}`} />
            <div className="min-w-0">
              <p className="truncate font-display text-2xl font-bold uppercase">{noteTitle}</p>
              <p className="truncate text-sm text-muted-foreground">
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
