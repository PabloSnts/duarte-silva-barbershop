import { useState } from "react";
import { Clock, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adjustTargets, applyAdjust, closingForecast, endOf, startOf, toMin, toTime, undoAdjust, useStore } from "@/lib/store";

/** Delay/advance control for a day's agenda with preview before applying. */
export function AdjustPanel({ date }: { date: string }) {
  const state = useStore((s) => s);
  const day = state.bookings.filter((b) => b.date === date && b.status === "confirmada").sort((a, b) => a.start.localeCompare(b.start));
  const [fromId, setFromId] = useState("");
  const [kind, setKind] = useState<"atraso" | "adiantado">("atraso");
  const [mins, setMins] = useState("");
  const adjusts = state.adjusts.filter((a) => a.date === date);
  const n = Number(mins) || 0;
  const delta = kind === "atraso" ? n : -n;
  const from = fromId || day[0]?.id || "";
  const targets = from ? adjustTargets(state, from) : [];
  const dur = (b: (typeof day)[number]) => toMin(endOf(b, state.services)) - toMin(startOf(b));
  const lastEnd = targets.length ? Math.max(...targets.map((b) => toMin(endOf(b, state.services)) + delta)) : 0;
  const newClose = toTime(Math.max(toMin(state.settings.close), lastEnd, ...day.filter((b) => !targets.includes(b)).map((b) => toMin(endOf(b, state.services)))));

  if (!day.length && !adjusts.length) return null;
  return (
    <section className="mb-5 grid gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        <p className="font-semibold">Atraso / adiantamento</p>
        <p className="ml-auto text-sm text-muted-foreground">Encerramento previsto: <span className="font-semibold text-foreground">{closingForecast(state, date)}</span></p>
      </div>
      {day.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-1">
            {(["atraso", "adiantado"] as const).map((k) => (
              <button key={k} onClick={() => setKind(k)} className={`rounded-md px-3 py-1 text-sm ${kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{k === "atraso" ? "Atrasado" : "Adiantado"}</button>
            ))}
          </div>
          <Input className="w-24" inputMode="numeric" placeholder="min" value={mins} onChange={(e) => setMins(e.target.value.replace(/\D/g, "").slice(0, 3))} aria-label="Minutos" />
          <span className="text-sm text-muted-foreground">a partir de</span>
          <div className="w-56">
            <Select value={from} onValueChange={setFromId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{day.map((b) => <SelectItem key={b.id} value={b.id}>{startOf(b)} · {b.client}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      )}
      {n > 0 && targets.length > 0 && (
        <div className="grid gap-1 rounded-lg bg-muted p-3 text-sm">
          <p className="font-semibold">Prévia</p>
          {targets.map((b) => {
            const a = toMin(startOf(b));
            return <p key={b.id}>{b.client}: <span className="text-muted-foreground line-through">{toTime(a)}–{toTime(a + dur(b))}</span> → <span className="font-semibold">{toTime(a + delta)}–{toTime(a + delta + dur(b))}</span></p>;
          })}
          <p className="text-muted-foreground">Novo encerramento previsto: <span className="font-semibold text-foreground">{newClose}</span></p>
          <Button size="sm" className="mt-2 w-fit" onClick={() => { applyAdjust(from, delta); setMins(""); toast.success(`Agenda ${kind === "atraso" ? "atrasada" : "adiantada"} em ${n} min`); }}>Confirmar ajuste</Button>
        </div>
      )}
      {adjusts.map((a) => (
        <div key={a.id} className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Ajuste aplicado: {a.minutes > 0 ? `+${a.minutes}` : a.minutes} min em {a.ids.length} atendimento(s)</span>
          <Button size="sm" variant="ghost" onClick={() => { undoAdjust(a.id); toast("Ajuste desfeito"); }}><Undo2 className="h-3 w-3" />Desfazer</Button>
        </div>
      ))}
    </section>
  );
}
