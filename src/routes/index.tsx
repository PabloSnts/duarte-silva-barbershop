import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, CheckCircle2, Clock, Plus, Tv, UserRound, XCircle } from "lucide-react";
import { AppShell, EmptyState } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { BookingRow, useBookingDialogs } from "@/components/booking";
import { freeSlots, serviceNames, startOf, today, toMin, useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Agenda da Barbearia" },
      { name: "description", content: "Resumo do dia: agendamentos, próximo cliente, horários livres e cancelamentos." },
      { property: "og:title", content: "Dashboard — Agenda da Barbearia" },
      { property: "og:description", content: "Gerencie a agenda da sua barbearia e exiba os horários na TV." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const state = useStore((s) => s);
  const d = useBookingDialogs();
  const t = today();
  const todays = state.bookings.filter((b) => b.date === t).sort((a, b) => a.start.localeCompare(b.start));
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  const upcoming = todays.filter((b) => b.status === "confirmada" && toMin(startOf(b)) >= now - 15);
  const next = upcoming[0];
  const stats = [
    { label: "Agendamentos hoje", value: todays.filter((b) => b.status !== "cancelada").length, icon: CalendarCheck },
    { label: "Horários livres", value: state.loaded ? freeSlots(state, t).filter((x) => toMin(x) > now).length : 0, icon: Clock },
    { label: "Concluídos", value: todays.filter((b) => b.status === "concluida").length, icon: CheckCircle2 },
    { label: "Cancelamentos", value: todays.filter((b) => b.status === "cancelada").length, icon: XCircle },
  ];

  return (
    <AppShell
      title="Hoje"
      actions={
        <>
          <Button asChild variant="outline" className="hidden sm:inline-flex"><Link to="/tv"><Tv className="h-4 w-4" />Visualização na TV</Link></Button>
          <Button onClick={d.create} className="bg-gold shadow-gold"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Nova reserva</span></Button>
        </>
      }
    >
      <div className="grid gap-6">
        <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Próximo cliente</p>
          {next ? (
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-secondary"><UserRound className="h-6 w-6 text-primary" /></div>
                <div className="min-w-0">
                  <p className="truncate font-display text-3xl font-bold uppercase">{next.client}</p>
                  <p className="text-sm text-muted-foreground">{serviceNames(next, state.services)}</p>
                </div>
              </div>
              <p className="font-display text-5xl font-bold text-primary">{startOf(next)}</p>
            </div>
          ) : (
            <p className="mt-2 text-muted-foreground">Nenhum atendimento restante hoje.</p>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <s.icon className="h-5 w-5 text-primary" />
              <p className="mt-3 font-display text-4xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold uppercase">Próximos atendimentos</h2>
            <Link to="/agenda" className="text-sm text-primary">Ver agenda</Link>
          </div>
          {!state.loaded ? (
            <div className="h-24 animate-pulse rounded-xl bg-card" />
          ) : upcoming.length ? (
            upcoming.map((b) => <BookingRow key={b.id} booking={b} onEdit={() => d.edit(b)} onDetails={() => d.details(b)} />)
          ) : (
            <EmptyState title="Agenda livre" text="Não há próximos atendimentos para hoje." action={<Button onClick={d.create}>Nova reserva</Button>} />
          )}
        </section>
      </div>
      {d.node}
    </AppShell>
  );
}
