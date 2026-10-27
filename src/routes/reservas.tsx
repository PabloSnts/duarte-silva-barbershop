import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { AppShell, EmptyState } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookingRow, useBookingDialogs } from "@/components/booking";
import { type BookingStatus, statusLabel, today, useStore } from "@/lib/store";

export const Route = createFileRoute("/reservas")({
  head: () => ({
    meta: [
      { title: "Reservas — Barbearia" },
      { name: "description", content: "Crie, altere, cancele e conclua reservas da barbearia." },
      { property: "og:title", content: "Reservas — Barbearia" },
      { property: "og:description", content: "Gerenciamento completo de reservas." },
    ],
  }),
  component: Reservas,
});

function Reservas() {
  const bookings = useStore((s) => s.bookings);
  const loaded = useStore((s) => s.loaded);
  const d = useBookingDialogs();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"proximas" | BookingStatus>("proximas");
  const t = today();
  const list = bookings
    .filter((b) => (tab === "proximas" ? b.status === "confirmada" && b.date >= t : b.status === tab))
    .filter((b) => b.client.toLowerCase().includes(q.toLowerCase()) || b.phone.includes(q))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start) * (tab === "proximas" ? 1 : -1));

  return (
    <AppShell title="Reservas" actions={<Button onClick={d.create} className="bg-gold"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Nova reserva</span></Button>}>
      <div className="mb-4 flex flex-wrap gap-2">
        {(["proximas", "concluida", "cancelada", "ausente"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full border px-3 py-1 text-sm ${tab === k ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
            {k === "proximas" ? "Próximas" : statusLabel[k] + "s"}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar cliente ou telefone" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-2">
        {!loaded ? <div className="h-24 animate-pulse rounded-xl bg-card" /> : list.length ? list.map((b) => <BookingRow key={b.id} showDate booking={b} onEdit={() => d.edit(b)} onDetails={() => d.details(b)} />) : <EmptyState title="Nenhuma reserva" text="Nada encontrado com esse filtro." />}
      </div>
      {d.node}
    </AppShell>
  );
}
