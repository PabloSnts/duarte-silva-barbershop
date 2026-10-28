import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Ban, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, EmptyState } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Confirm } from "@/components/booking";
import { addBlocked, digits, isBlocked, normalizePhone, removeBlocked, useStore } from "@/lib/store";

export const Route = createFileRoute("/blacklist")({
  head: () => ({
    meta: [
      { title: "Blacklist — Barbearia" },
      { name: "description", content: "Clientes bloqueados que não podem fazer novos agendamentos." },
      { property: "og:title", content: "Blacklist — Barbearia" },
      { property: "og:description", content: "Gerencie os clientes bloqueados." },
    ],
  }),
  component: Blacklist,
});

function Blacklist() {
  const state = useStore((s) => s);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [del, setDel] = useState<string | null>(null);
  const clients = useMemo(() => {
    const m = new Map<string, { name: string; phone: string }>();
    state.bookings.forEach((b) => m.set(digits(b.phone), { name: b.client, phone: b.phone }));
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [state.bookings]);

  async function add() {
    if (!normalizePhone(phone)) { toast.error("Informe um telefone válido com DDD"); return; }
    if (isBlocked(state, phone)) { toast.error("Esse contato já está na blacklist"); return; }
    if (!await addBlocked({ phone: phone.trim().slice(0, 20), name: name.trim().slice(0, 80) || undefined, reason: reason.trim().slice(0, 200) || undefined })) return;
    setPhone(""); setName(""); setReason("");
    toast.success("Cliente adicionado à blacklist");
  }

  return (
    <AppShell title="Blacklist">
      <div className="grid max-w-3xl gap-4">
        <section className="grid gap-3 rounded-xl border border-border bg-card p-5">
          <div className="grid gap-1.5">
            <Label>Escolher da lista de clientes (opcional)</Label>
            <Select value="" onValueChange={(v) => { const c = clients.find((x) => digits(x.phone) === v); if (c) { setPhone(c.phone); setName(c.name); } }}>
              <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.phone} value={digits(c.phone)}>{c.name} · {c.phone}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label>Telefone / contato *</Label><Input value={phone} maxLength={20} inputMode="tel" placeholder="(11) 99999-0000" onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Nome (se souber)</Label><Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></div>
          </div>
          <div className="grid gap-1.5"><Label>Motivo (opcional)</Label><Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} /></div>
          <Button className="w-fit" onClick={add}><Ban className="h-4 w-4" />Bloquear cliente</Button>
        </section>
        {state.blacklist.length === 0 ? <EmptyState title="Ninguém bloqueado" text="Clientes bloqueados aparecem aqui." /> : state.blacklist.map((c) => (
          <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-destructive/30 bg-card p-4">
            <div className="min-w-0">
              <p className="truncate font-semibold">{c.name || "Sem nome"} · <span className="text-muted-foreground">{c.phone}</span></p>
              {c.reason && <p className="truncate text-sm text-muted-foreground">{c.reason}</p>}
            </div>
            <Button size="icon" variant="ghost" aria-label="Remover da blacklist" onClick={() => setDel(c.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
      <Confirm open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Remover da blacklist?" text="O cliente poderá voltar a agendar." onConfirm={async () => { if (del && await removeBlocked(del)) { setDel(null); toast("Removido da blacklist"); } }} />
    </AppShell>
  );
}
