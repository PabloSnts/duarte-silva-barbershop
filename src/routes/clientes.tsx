import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { AppShell, EmptyState } from "@/components/AppShell";
import { normalizePhone, useStore } from "@/lib/store";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Barbearia" },
      { name: "description", content: "Clientes da barbearia com histórico de atendimentos." },
      { property: "og:title", content: "Clientes — Barbearia" },
      { property: "og:description", content: "Lista de clientes e histórico de visitas." },
    ],
  }),
  component: Clientes,
});

function Clientes() {
  const bookings = useStore((s) => s.bookings);
  const map = new Map<string, { name: string; phone: string; visits: number; last: string; noShows: number }>();
  for (const b of bookings) {
    const key = b.clientId ?? normalizePhone(b.phone) ?? b.id;
    const c = map.get(key) ?? { name: b.client, phone: b.phone, visits: 0, last: "", noShows: 0 };
    if (b.status === "concluida") c.visits++;
    if (b.status === "ausente") c.noShows++;
    if (b.date > c.last) c.last = b.date;
    map.set(key, c);
  }
  const list = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <AppShell title="Clientes">
      {list.length === 0 ? (
        <EmptyState title="Sem clientes" text="Os clientes aparecem aqui conforme as reservas chegam." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <div key={c.phone} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.visits} atendimentos · {c.noShows} ausências · último {c.last.split("-").reverse().join("/")}</p>
              </div>
              <a href={`https://wa.me/${normalizePhone(c.phone) ?? ""}`} target="_blank" rel="noreferrer" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success/15 text-success" aria-label="Abrir WhatsApp">
                <MessageCircle className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
