import { shopNow } from "@/lib/domain";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookingActions, StatusBadge, statusStyle, useBookingDialogs } from "@/components/booking";
import { AdjustPanel } from "@/components/adjust";
import { type BookingStatus, daySlots, endOf, isAvailable, serviceNames, startOf, statusLabel, toMin, useStore } from "@/lib/store";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Barbearia" },
      { name: "description", content: "Agenda do barbeiro por dia, semana e mês com horários livres e ocupados." },
      { property: "og:title", content: "Agenda — Barbearia" },
      { property: "og:description", content: "Visualize a agenda por dia, semana ou mês." },
    ],
  }),
  component: Agenda,
});

type Mode = "dia" | "semana" | "mes";

function Agenda() {
  const state = useStore((s) => s);
  const d = useBookingDialogs();
  const [mode, setMode] = useState<Mode>("dia");
  const [cur, setCur] = useState(() => shopNow());
  const [filter, setFilter] = useState<"todas" | BookingStatus>("todas");
  const key = (x: Date) => format(x, "yyyy-MM-dd");
  const of = (date: string) =>
    state.bookings.filter((b) => b.date === date && (filter === "todas" || b.status === filter)).sort((a, b) => a.start.localeCompare(b.start));

  const move = (n: number) => setCur((c) => (mode === "dia" ? addDays(c, n) : mode === "semana" ? addWeeks(c, n) : addMonths(c, n)));
  const label =
    mode === "dia"
      ? format(cur, "EEEE, d 'de' MMMM", { locale: ptBR })
      : mode === "semana"
        ? `${format(startOfWeek(cur, { weekStartsOn: 1 }), "d MMM", { locale: ptBR })} – ${format(endOfWeek(cur, { weekStartsOn: 1 }), "d MMM", { locale: ptBR })}`
        : format(cur, "MMMM yyyy", { locale: ptBR });

  return (
    <AppShell title="Agenda" actions={<Button onClick={d.create} className="bg-gold"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Nova reserva</span></Button>}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          {(["dia", "semana", "mes"] as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-md px-3 py-1.5 text-sm capitalize ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {m === "mes" ? "Mês" : m}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => move(-1)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCur(shopNow())}>Hoje</Button>
          <Button size="icon" variant="ghost" onClick={() => move(1)} aria-label="Próximo"><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <p className="font-display text-xl font-bold capitalize">{label}</p>
        <div className="ml-auto w-40">
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas situações</SelectItem>
              {(Object.keys(statusLabel) as BookingStatus[]).map((s) => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {mode === "dia" && <AdjustPanel date={key(cur)} />}
      {mode === "dia" && (
        <div className="grid gap-2">
          {daySlots(state, key(cur)).length === 0 && <p className="text-muted-foreground">Barbearia fechada neste dia.</p>}
          {daySlots(state, key(cur)).map((t) => {
            const bs = of(key(cur)).filter((b) => b.start === t);
            const covered = state.bookings.some((b) => b.date === key(cur) && b.status !== "cancelada" && toMin(startOf(b)) < toMin(t) && toMin(endOf(b, state.services)) > toMin(t) && b.start !== t);
            const free = !bs.length && !covered && isAvailable(state, key(cur), t, state.services.find((s) => s.active !== false)?.id ?? "corte");
            return (
              <div key={t} className="grid grid-cols-[56px_minmax(0,1fr)] gap-3">
                <p className="pt-3 text-sm font-semibold text-muted-foreground">{t}</p>
                <div className="grid gap-2">
                  {bs.map((b) => (
                    <div key={b.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3 ${statusStyle[b.status]}`}>
                      <button className="min-w-0 text-left" onClick={() => d.details(b)}>
                        <p className="truncate font-semibold text-foreground">{b.client}</p>
                        <p className="truncate text-xs text-muted-foreground">{startOf(b)}–{endOf(b, state.services)}{b.shift ? ` (${b.shift > 0 ? "+" : ""}${b.shift} min)` : ""} · {serviceNames(b, state.services)}</p>
                      </button>
                      <div className="flex items-center gap-1"><StatusBadge status={b.status} /><BookingActions booking={b} onEdit={() => d.edit(b)} onDetails={() => d.details(b)} /></div>
                    </div>
                  ))}
                  {!bs.length && (
                    <div className={`rounded-xl border border-dashed p-3 text-sm ${free ? "border-success/30 bg-free text-success" : "border-border text-muted-foreground"}`}>
                      {free ? "Livre" : covered ? "Em atendimento" : "Indisponível"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mode === "semana" && (
        <div className="grid gap-3 md:grid-cols-7">
          {eachDayOfInterval({ start: startOfWeek(cur, { weekStartsOn: 1 }), end: endOfWeek(cur, { weekStartsOn: 1 }) }).map((day) => {
            const bs = of(key(day));
            const free = state.loaded ? daySlots(state, key(day)).filter((t) => isAvailable(state, key(day), t, state.services.find((s) => s.active !== false)?.id ?? "")).length : 0;
            return (
              <div key={key(day)} className="rounded-xl border border-border bg-card p-3">
                <button onClick={() => { setCur(day); setMode("dia"); }} className="mb-2 w-full text-left">
                  <p className="text-xs uppercase text-muted-foreground">{format(day, "EEE", { locale: ptBR })}</p>
                  <p className={`font-display text-2xl font-bold ${key(day) === key(shopNow()) ? "text-primary" : ""}`}>{format(day, "d")}</p>
                  <p className="text-xs text-success">{free} livres</p>
                </button>
                <div className="grid gap-1.5">
                  {bs.map((b) => (
                    <button key={b.id} onClick={() => d.details(b)} className={`rounded-md border px-2 py-1 text-left text-xs ${statusStyle[b.status]}`}>
                      <span className="font-semibold">{b.start}</span> <span className="text-foreground">{b.client.split(" ")[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mode === "mes" && (
        <div className="grid grid-cols-7 gap-1.5">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((w) => <p key={w} className="pb-1 text-center text-xs text-muted-foreground">{w}</p>)}
          {eachDayOfInterval({ start: startOfWeek(startOfMonth(cur), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(cur), { weekStartsOn: 1 }) }).map((day) => {
            const n = of(key(day)).filter((b) => b.status !== "cancelada").length;
            const total = daySlots(state, key(day)).length || 1;
            return (
              <button
                key={key(day)}
                onClick={() => { setCur(day); setMode("dia"); }}
                className={`aspect-square rounded-lg border border-border p-1.5 text-left sm:p-2 ${isSameMonth(day, cur) ? "bg-card" : "opacity-40"} ${key(day) === key(shopNow()) ? "ring-1 ring-primary" : ""}`}
              >
                <p className="text-sm font-semibold">{format(day, "d")}</p>
                {n > 0 && (
                  <>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.min(100, (n / total) * 100)}%` }} /></div>
                    <p className="mt-1 hidden text-[10px] text-muted-foreground sm:block">{n} reservas</p>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}
      {d.node}
    </AppShell>
  );
}
