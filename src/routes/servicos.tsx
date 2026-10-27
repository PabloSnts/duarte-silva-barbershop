import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Service, type ServiceRule, setState, uid, useStore } from "@/lib/store";

export const Route = createFileRoute("/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços — Barbearia" },
      { name: "description", content: "Cadastre os serviços, durações e dias/horários de cada um." },
      { property: "og:title", content: "Serviços — Barbearia" },
      { property: "og:description", content: "Serviços, durações e disponibilidade." },
    ],
  }),
  component: Servicos,
});

const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Valid durations are multiples of 30 minutes (30..480). */
function validDuration(v: string): number | null {
  if (!/^\d+$/.test(v.trim())) return null;
  const m = Number(v);
  return m >= 30 && m <= 480 && m % 30 === 0 ? m : null;
}

const upd = (id: string, p: Partial<Service>) => setState((st) => ({ services: st.services.map((x) => (x.id === id ? { ...x, ...p } : x)) }));

function DurationInput({ value, onValid }: { value: number; onValid: (m: number) => void }) {
  const [text, setText] = useState(String(value));
  const [err, setErr] = useState(false);
  function commit(v = text) {
    const m = validDuration(v);
    if (m === null) { setErr(true); toast.error("Duração inválida: use múltiplos de 30 min (30, 60, 90…)"); return; }
    setErr(false); setText(String(m)); onValid(m);
  }
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1">
        <Input type="text" inputMode="numeric" value={text} aria-invalid={err} className={err ? "border-destructive" : ""}
          onChange={(e) => { setText(e.target.value.replace(/\D/g, "")); setErr(false); }}
          onBlur={() => commit()} onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); const n = Math.max(30, Math.min(480, (Math.round((Number(text) || 0) / 30) * 30) + (e.key === "ArrowUp" ? 30 : -30))); setText(String(n)); commit(String(n)); }
          }} aria-label="Duração em minutos" />
        <span className="text-xs text-muted-foreground">min</span>
      </div>
      {err && <p className="text-xs text-destructive">Só múltiplos de 30</p>}
    </div>
  );
}

function Rules({ s }: { s: Service }) {
  const rules = s.rules ?? [];
  const setRules = (r: ServiceRule[]) => upd(s.id, { rules: r });
  return (
    <div className="grid gap-2 border-t border-border pt-3">
      <p className="text-xs text-muted-foreground">{rules.length ? "Só pode ser agendado nestes dias e horários:" : "Disponível em todo o expediente."}</p>
      {rules.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {days.map((d, i) => (
              <button key={d} onClick={() => setRules(rules.map((x) => (x.id === r.id ? { ...x, days: x.days.includes(i) ? x.days.filter((y) => y !== i) : [...x.days, i] } : x)))} className={`rounded-md border px-2 py-0.5 text-xs ${r.days.includes(i) ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>{d}</button>
            ))}
          </div>
          <Input type="time" className="w-28" value={r.start} onChange={(e) => setRules(rules.map((x) => (x.id === r.id ? { ...x, start: e.target.value } : x)))} />
          <span className="text-xs">às</span>
          <Input type="time" className="w-28" value={r.end} onChange={(e) => setRules(rules.map((x) => (x.id === r.id ? { ...x, end: e.target.value } : x)))} />
          <Button size="icon" variant="ghost" aria-label="Remover regra" onClick={() => setRules(rules.filter((x) => x.id !== r.id))}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-fit" onClick={() => setRules([...rules, { id: uid(), days: [1], start: "08:00", end: "11:00" }])}><Plus className="h-3 w-3" />Adicionar dia/horário</Button>
    </div>
  );
}

function Servicos() {
  const services = useStore((s) => s.services);
  const [name, setName] = useState("");
  const [dur, setDur] = useState("30");
  function add() {
    const n = name.trim().slice(0, 50);
    const m = validDuration(dur);
    if (n.length < 2) { toast.error("Informe o nome do serviço"); return; }
    if (m === null) { toast.error("Duração inválida: use múltiplos de 30 min (30, 60, 90…)"); return; }
    setState((s) => ({ services: [...s.services, { id: uid(), name: n, duration: m }] }));
    setName("");
    toast.success("Serviço adicionado");
  }
  return (
    <AppShell title="Serviços">
      <div className="grid max-w-3xl gap-3">
        <div className="grid grid-cols-[minmax(0,1fr)_100px_auto] gap-2 rounded-xl border border-border bg-card p-3">
          <Input placeholder="Nome do serviço" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
          <Input type="text" inputMode="numeric" placeholder="min" value={dur} onChange={(e) => setDur(e.target.value.replace(/\D/g, ""))} aria-label="Duração em minutos" />
          <Button onClick={add}><Plus className="h-4 w-4" /></Button>
        </div>
        {services.map((s) => (
          <div key={s.id} className="grid gap-3 rounded-xl border border-border bg-card p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_120px_auto] items-start gap-2">
              <Input value={s.name} maxLength={50} onChange={(e) => upd(s.id, { name: e.target.value })} />
              <DurationInput value={s.duration} onValid={(m) => upd(s.id, { duration: m })} />
              <Button size="icon" variant="ghost" aria-label="Remover" onClick={() => setState((st) => ({ services: st.services.filter((x) => x.id !== s.id) }))}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <Rules s={s} />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
