import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { validHours } from "@/lib/domain";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Settings, setState, uid, useStore, vacationText } from "@/lib/store";

export const Route = createFileRoute("/expediente")({
  head: () => ({
    meta: [
      { title: "Expediente, folgas e férias — Barbearia" },
      { name: "description", content: "Defina os dias de trabalho, folgas da semana e férias do barbeiro." },
      { property: "og:title", content: "Expediente, folgas e férias — Barbearia" },
      { property: "og:description", content: "Dias de trabalho, folgas e férias." },
    ],
  }),
  component: Expediente,
});

const days = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function Expediente() {
  const state = useStore((s) => s);
  const s = state.settings;
  const set = (p: Partial<Settings>) => setState((st) => ({ settings: { ...st.settings, ...p } }));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [message,setMessage] = useState(s.vacationMessage);
  useEffect(()=>setMessage(s.vacationMessage),[s.vacationMessage]);
  async function addVac() {
    if (!from || !to || to < from) { toast.error("Informe início e fim válidos"); return; }
    if (!await set({ vacations: [...s.vacations, { id: uid(), start: from, end: to }].sort((a, b) => a.start.localeCompare(b.start)) })) return;
    setFrom(""); setTo("");
    toast.success("Férias cadastradas — a agenda fica bloqueada nesse período");
  }
  return (
    <AppShell title="Expediente e férias">
      <div className="grid max-w-3xl gap-4">
        <section className="grid gap-4 rounded-xl border border-border bg-card p-5">
          <h2 className="text-xl font-bold uppercase">Horários</h2>
          <HoursEditor settings={s} onSave={set} />
          <div className="grid items-center gap-2 sm:grid-cols-[220px_minmax(0,1fr)]">
            <p className="text-sm text-muted-foreground">Duração padrão do horário</p>
            <Select value={String(s.slot)} onValueChange={(v) => set({ slot: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[15, 30, 45, 60].map((m) => <SelectItem key={m} value={String(m)}>{m} minutos</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-1 text-xl font-bold uppercase">Dias de trabalho e folgas</h2>
          <p className="mb-3 text-sm text-muted-foreground">Toque para alternar entre trabalho e folga.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {days.map((d, i) => {
              const on = s.workDays.includes(i);
              return (
                <button key={d} onClick={() => set({ workDays: on ? s.workDays.filter((x) => x !== i) : [...s.workDays, i] })} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
                  <span>{d}</span><span className="text-xs font-semibold">{on ? "Trabalho" : "Folga"}</span>
                </button>
              );
            })}
          </div>
        </section>
        <section className="grid gap-3 rounded-xl border border-border bg-card p-5">
          <h2 className="text-xl font-bold uppercase">Férias</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs text-muted-foreground">Início<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="grid gap-1 text-xs text-muted-foreground">Fim<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            <Button onClick={addVac}><Plus className="h-4 w-4" />Adicionar</Button>
          </div>
          {s.vacations.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma férias cadastrada.</p>}
          {s.vacations.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <span>{v.start.split("-").reverse().join("/")} até {v.end.split("-").reverse().join("/")}</span>
              <Button size="icon" variant="ghost" aria-label="Remover férias" onClick={() => set({ vacations: s.vacations.filter((x) => x.id !== v.id) })}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <div className="grid gap-1.5">
            <p className="text-sm text-muted-foreground">Mensagem padrão para clientes durante as férias (use {"{inicio}"} e {"{fim}"})</p>
            <Textarea value={message} maxLength={400} onChange={(e) => setMessage(e.target.value)} onBlur={()=>{if(message!==s.vacationMessage) void set({vacationMessage:message});}} />
            {s.vacations[0] && <p className="rounded-lg bg-muted p-3 text-sm">Prévia: {vacationText(state, s.vacations[0])}</p>}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function HoursEditor({settings:s,onSave}:{settings:Settings;onSave:(p:Partial<Settings>)=>Promise<boolean>}) {
  const [hours,setHours] = useState({open:s.open,close:s.close,breakStart:s.breakStart,breakEnd:s.breakEnd});
  const [saving,setSaving] = useState(false);
  useEffect(()=>setHours({open:s.open,close:s.close,breakStart:s.breakStart,breakEnd:s.breakEnd}),[s.open,s.close,s.breakStart,s.breakEnd]);
  return <div className="grid gap-3">
    <div className="grid items-center gap-2 sm:grid-cols-[220px_minmax(0,1fr)]">
      <p className="text-sm text-muted-foreground">Abertura / fechamento</p>
      <div className="flex gap-2"><Input aria-label="Abertura" type="time" value={hours.open} onChange={(e)=>setHours({...hours,open:e.target.value})}/><Input aria-label="Fechamento" type="time" value={hours.close} onChange={(e)=>setHours({...hours,close:e.target.value})}/></div>
    </div>
    <div className="grid items-center gap-2 sm:grid-cols-[220px_minmax(0,1fr)]">
      <p className="text-sm text-muted-foreground">Intervalo (bloqueio)</p>
      <div className="flex gap-2"><Input aria-label="Início do intervalo" type="time" value={hours.breakStart} onChange={(e)=>setHours({...hours,breakStart:e.target.value})}/><Input aria-label="Fim do intervalo" type="time" value={hours.breakEnd} onChange={(e)=>setHours({...hours,breakEnd:e.target.value})}/></div>
    </div>
    <Button className="w-fit" disabled={saving} onClick={async()=>{
      if (!validHours(hours.open,hours.close,hours.breakStart,hours.breakEnd)) {toast.error("Confira abertura, fechamento e intervalo.");return;}
      setSaving(true); if(await onSave(hours)) toast.success("Horários salvos"); setSaving(false);
    }}>Salvar horários</Button>
  </div>;
}
