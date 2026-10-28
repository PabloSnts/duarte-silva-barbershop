import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { disconnectTv, type Settings, setState, useStore } from "@/lib/store";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Barbearia" },
      { name: "description", content: "Nome da barbearia, visualização na TV e alertas sonoros." },
      { property: "og:title", content: "Configurações — Barbearia" },
      { property: "og:description", content: "Ajuste a agenda e a visualização na TV." },
    ],
  }),
  component: Config,
});


function Config() {
  const s = useStore((st) => st.settings);
  const tv = useStore((st) => st.tv);
  const set = (p: Partial<Settings>) => setState((st) => ({ settings: { ...st.settings, ...p } }));
  const [name,setName] = useState(s.shopName);
  useEffect(()=>setName(s.shopName),[s.shopName]);
  return (
    <AppShell title="Configurações">
      <div className="grid max-w-3xl gap-4">
        <Card title="Barbearia">
          <Row label="Nome"><Input value={name} maxLength={40} onChange={(e)=>setName(e.target.value)} onBlur={()=>{
            if(name.trim().length<2) {toast.error("Informe o nome da barbearia.");setName(s.shopName);return;}
            if(name.trim()!==s.shopName) void set({shopName:name.trim()});
          }}/></Row>
        </Card>
        <Card title="Visualização na TV">
          <Row label="Mostrar horários livres"><Switch checked={s.showFreeOnTv} onCheckedChange={(v) => set({ showFreeOnTv: v })} /></Row>
          <Row label="Informação do cliente">
            <Select value={s.tvClientInfo} onValueChange={(v) => set({ tvClientInfo: v as Settings["tvClientInfo"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="first">Nome - serviços</SelectItem>
                <SelectItem value="initials">Apenas iniciais</SelectItem>
                <SelectItem value="none">Não exibir</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Alertas sonoros"><Switch checked={s.sound} onCheckedChange={(v) => set({ sound: v })} /></Row>
          <Row label={tv.connected ? "TV conectada" : "Nenhuma TV conectada"}>
            <Button variant="outline" disabled={!tv.connected} onClick={async () => { if (await disconnectTv()) toast("TV desconectada"); }}>Encerrar conexão</Button>
          </Row>
        </Card>
      </div>
    </AppShell>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 text-xl font-bold uppercase">{title}</h2>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid items-center gap-2 sm:grid-cols-[220px_minmax(0,1fr)]">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div>{children}</div>
    </div>
  );
}
