import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Service, type ServiceRule, setState, uid, useStore } from "@/lib/store";
import { validServiceDuration } from "@/lib/domain";

export const Route = createFileRoute("/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços — Barbearia" },
      { name: "description", content: "Cadastre os serviços, preços, durações e dias/horários de cada um." },
      { property: "og:title", content: "Serviços — Barbearia" },
      { property: "og:description", content: "Serviços, preços, durações e disponibilidade." },
    ],
  }),
  component: Servicos,
});

const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const validDuration = validServiceDuration;

/** Accepts values in reais with at most two decimal places. */
function parsePrice(raw: string): number | null {
  const text = raw.trim().replace(/^R\$\s*/, "").replace(/\s/g, "");
  // Portuguese currency: 35,00 or 1.250,50; also accept 35.50.
  const normalized = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(text)
    ? text.replace(/\./g, "").replace(",", ".")
    : /^\d+(?:[,.]\d{1,2})?$/.test(text)
      ? text.replace(",", ".")
      : null;
  if (normalized === null) return null;
  const price = Number(normalized);
  return Number.isFinite(price) && price >= 0 && price <= 99999.99
    ? Math.round(price * 100) / 100
    : null;
}
function formattedPrice(price: number): string {
  return Number.isFinite(price) ? price.toFixed(2).replace(".", ",") : "0,00";
}

const upd = (id: string, p: Partial<Service>) => setState((st) => ({ services: st.services.map((x) => (x.id === id ? { ...x, ...p } : x)) }));

/** Editable money field: save only valid numeric amounts when focus leaves. */
function PriceInput({ value, onValid, label }: { value: number; onValid: (n: number) => Promise<boolean>; label: string }) {
  const [text, setText] = useState(() => formattedPrice(value));
  const [error, setError] = useState(false);

  useEffect(() => { setText(formattedPrice(value)); }, [value]);

  async function commit(raw = text) {
    const parsed = parsePrice(raw);
    if (parsed === null) {
      setError(true);
      toast.error("Preço inválido. Informe um valor em R$ (ex.: 35,00).");
      return;
    }
    setError(false);
    setText(formattedPrice(parsed));
    if (!await onValid(parsed)) { setText(formattedPrice(value)); setError(true); }
  }

  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">R$</span>
        <Input type="text" inputMode="decimal" value={text} aria-invalid={error}
          aria-label={`Preço de ${label} em reais`}
          className={`pl-10 ${error ? "border-destructive" : ""}`}
          onChange={(e) => { setText(e.target.value); setError(false); }}
          onBlur={() => commit()}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }} />
      </div>
      {error && <p className="text-xs text-destructive">Informe um valor válido</p>}
    </div>
  );
}

function DurationInput({ value, onValid }: { value: number; onValid: (m: number) => Promise<boolean> }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)),[value]);
  const [err, setErr] = useState(false);
  async function commit(v = text) {
    const m = validDuration(v);
    if (m === null) { setErr(true); toast.error("Use múltiplos de 15 min, de 15 a 480 minutos."); return; }
    setErr(false); setText(String(m));
    if (!await onValid(m)) { setText(String(value)); setErr(true); }
  }
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1">
        <Input type="text" inputMode="numeric" value={text} aria-invalid={err} className={err ? "border-destructive" : ""}
          onChange={(e) => { setText(e.target.value.replace(/\D/g, "")); setErr(false); }}
          onBlur={() => commit()} onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); const n = Math.max(15, Math.min(480, (Math.round((Number(text) || 0) / 15) * 15) + (e.key === "ArrowUp" ? 15 : -15))); setText(String(n)); commit(String(n)); }
          }} aria-label="Duração em minutos" />
        <span className="text-xs text-muted-foreground">min</span>
      </div>
      {err && <p className="text-xs text-destructive">Múltiplos de 15 (15–480 min)</p>}
    </div>
  );
}

function ServiceName({service}:{service:Service}) {
  const [name,setName] = useState(service.name);
  useEffect(()=>setName(service.name),[service.name]);
  return <Input value={name} maxLength={50} onChange={(e)=>setName(e.target.value)} aria-label="Nome do serviço" onBlur={()=>{
    if (name.trim().length<2) { toast.error("Informe o nome do serviço."); setName(service.name); return; }
    if (name.trim()!==service.name) void upd(service.id,{name:name.trim()});
  }} />;
}

function Rules({ s }: { s: Service }) {
  const [rules,setRules] = useState<ServiceRule[]>(s.rules ?? []);
  const saved = JSON.stringify(s.rules ?? []);
  useEffect(() => setRules(JSON.parse(saved) as ServiceRule[]),[saved]);
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
      {JSON.stringify(rules)!==saved && <Button size="sm" className="w-fit" onClick={async()=>{
        if (rules.some((r)=>!r.days.length || !r.start || !r.end || r.start>=r.end)) { toast.error("Selecione os dias e um intervalo válido."); return; }
        if (await upd(s.id,{rules})) toast.success("Dias e horários salvos");
      }}>Salvar dias e horários</Button>}
    </div>
  );
}

function Servicos() {
  const services = useStore((s) => s.services);
  const [name, setName] = useState("");
  const [dur, setDur] = useState("30");
  const [price, setPrice] = useState("");
  async function add() {
    const n = name.trim().slice(0, 50);
    const m = validDuration(dur);
    const amount = parsePrice(price);
    if (n.length < 2) { toast.error("Informe o nome do serviço"); return; }
    if (m === null) { toast.error("Use múltiplos de 15 min, de 15 a 480 minutos."); return; }
    if (amount === null) { toast.error("Informe o preço do serviço em reais (ex.: 35,00)"); return; }
    if (!await setState((s) => ({ services: [...s.services, { id: uid(), name: n, duration: m, price: amount }] }))) return;
    setName("");
    setDur("30");
    setPrice("");
    toast.success("Serviço adicionado");
  }
  return (
    <AppShell title="Serviços">
      <div className="grid max-w-3xl gap-3">
        <div className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_90px_145px_auto] sm:items-end">
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Novo serviço</span>
            <Input placeholder="Nome do serviço" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Duração (min)</span>
            <Input type="text" inputMode="numeric" placeholder="30" value={dur} onChange={(e) => setDur(e.target.value.replace(/\D/g, ""))} aria-label="Duração em minutos" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Preço (R$)</span>
            <div className="relative">
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">R$</span>
              <Input type="text" inputMode="decimal" className="pl-10" placeholder="35,00" value={price}
                onChange={(e) => setPrice(e.target.value)} aria-label="Preço do novo serviço em reais" />
            </div>
          </label>
          <Button onClick={add} aria-label="Adicionar serviço"><Plus className="h-4 w-4" /><span className="sm:hidden">Adicionar serviço</span></Button>
        </div>
        {services.filter((s) => s.active !== false).map((service) => (
          <div key={service.id} className="grid gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid min-w-[160px] flex-1 gap-1">
                <span className="text-xs text-muted-foreground">Serviço</span>
                <ServiceName service={service} />
              </label>
              <div className="w-[105px] sm:w-[120px]">
                <span className="text-xs text-muted-foreground">Duração</span>
                <DurationInput value={service.duration} onValid={(m) => upd(service.id, { duration: m })} />
              </div>
              <div className="w-[125px] sm:w-[145px]">
                <PriceInput value={service.price ?? 0} onValid={(amount) => upd(service.id, { price: amount })} label="Preço" />
              </div>
              <Button size="icon" variant="ghost" aria-label={`Remover ${service.name}`} onClick={() => setState((st) => ({ services: st.services.map((x) => x.id === service.id ? { ...x, active: false } : x) }))}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <Rules s={service} />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
