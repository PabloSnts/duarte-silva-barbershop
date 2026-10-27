import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreHorizontal } from "lucide-react";
import {
  type Booking,
  type BookingStatus,
  bookingServiceIds,
  checkAvailability,
  daySlots,
  deleteBooking,
  endOf,
  fmtDuration,
  isBlocked,
  isAvailable,
  serviceNames,
  startOf,
  toMin,
  toTime,
  totalDuration,
  setStatus,
  statusLabel,
  today,
  uid,
  upsertBooking,
  useStore,
} from "@/lib/store";

const schema = z.object({
  client: z.string().trim().min(2, "Informe o nome").max(80),
  phone: z.string().trim().regex(/^[\d\s()+-]{8,20}$/, "Telefone inválido"),
  serviceIds: z.array(z.string()).min(1, "Escolha ao menos um serviço"),
  date: z.string().min(10, "Escolha a data"),
  start: z.string().min(4, "Escolha o horário"),
  notes: z.string().max(300).optional(),
});

export const statusStyle: Record<BookingStatus, string> = {
  confirmada: "bg-primary/15 text-primary border-primary/30",
  concluida: "bg-success/15 text-success border-success/30",
  cancelada: "bg-destructive/15 text-destructive border-destructive/30",
  ausente: "bg-warning/15 text-warning border-warning/30",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusStyle[status]}`}>{statusLabel[status]}</span>;
}

export function BookingDialog({ open, onOpenChange, booking }: { open: boolean; onOpenChange: (o: boolean) => void; booking?: Booking | null }) {
  const state = useStore((s) => s);
  const [form, setForm] = useState<{ client: string; phone: string; serviceIds: string[]; date: string; start: string; notes: string }>({ client: "", phone: "", serviceIds: [], date: today(), start: "", notes: "" });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(booking ? { client: booking.client, phone: booking.phone, serviceIds: bookingServiceIds(booking), date: booking.date, start: booking.start, notes: booking.notes ?? "" } : { client: "", phone: "", serviceIds: state.services[0] ? [state.services[0].id] : [], date: today(), start: "", notes: "" });
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, booking]);

  const slots = useMemo(() => daySlots(state, form.date), [state, form.date]);
  const problem = form.start && form.serviceIds.length ? checkAvailability(state, form.date, form.start, form.serviceIds, booking?.id) : undefined;
  const available = problem === undefined ? null : problem === null;
  const total = totalDuration(form.serviceIds, state.services);
  const blocked = isBlocked(state, form.phone);

  function save() {
    const r = schema.safeParse(form);
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    if (blocked) {
      setErrors({ phone: "Cliente na blacklist — não pode agendar" });
      return;
    }
    if (!available) {
      setErrors({ start: problem ?? "Horário indisponível" });
      return;
    }
    if (booking && (booking.date !== form.date || booking.start !== form.start)) {
      setConfirm(true);
      return;
    }
    commit();
  }
  function commit() {
    const base = { ...form, serviceId: form.serviceIds[0]!, notes: form.notes };
    const b: Booking = booking ? { ...booking, ...base, shift: booking.date === form.date && booking.start === form.start ? booking.shift : 0 } : { ...base, id: uid(), status: "confirmada", createdAt: Date.now() };
    upsertBooking(b, !booking);
    toast.success(booking ? "Reserva alterada" : "Reserva criada");
    setConfirm(false);
    onOpenChange(false);
  }

  const set = (k: "client" | "phone" | "start" | "notes") => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (id: string) => setForm((f) => ({ ...f, serviceIds: f.serviceIds.includes(id) ? f.serviceIds.filter((x) => x !== id) : [...f.serviceIds, id] }));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl uppercase">{booking ? "Alterar reserva" : "Nova reserva"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Nome do cliente" error={errors["client"]}>
              <Input value={form.client} maxLength={80} onChange={(e) => set("client")(e.target.value)} />
            </Field>
            <Field label="Telefone / WhatsApp" error={errors["phone"]}>
              <Input value={form.phone} maxLength={20} inputMode="tel" placeholder="(11) 99999-0000" onChange={(e) => set("phone")(e.target.value)} />
            </Field>
            {blocked && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/15 px-3 py-2 text-sm text-destructive"><XCircle className="h-4 w-4" />Este contato está na blacklist{blocked.reason ? ` (${blocked.reason})` : ""}.</div>
            )}
            <Field label="Serviços" error={errors["serviceIds"]}>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {state.services.map((s) => {
                  const on = form.serviceIds.includes(s.id);
                  return (
                    <button type="button" key={s.id} onClick={() => toggle(s.id)} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
                      <span className="truncate">{on ? "✓ " : ""}{s.name}</span><span className="shrink-0 text-xs">{s.duration} min</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">Duração total: <span className="font-semibold text-foreground">{fmtDuration(total)}</span>{form.start ? ` · ${form.start} às ${toTime(toMin(form.start) + total)}` : ""}</p>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data" error={errors["date"]}>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value, start: "" }))} />
              </Field>
              <Field label="Horário" error={errors["start"]}>
                <Select value={form.start} onValueChange={set("start")}>
                  <SelectTrigger><SelectValue placeholder={slots.length ? "Escolha" : "Fechado / férias"} /></SelectTrigger>
                  <SelectContent>
                    {slots.map((t) => {
                      const ok = form.serviceIds.length ? isAvailable(state, form.date, t, form.serviceIds, booking?.id) : true;
                      return (
                        <SelectItem key={t} value={t} disabled={!ok}>{t}{ok ? "" : " · ocupado"}</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {available !== null && (
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${available ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                {available ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {available ? `Horário disponível (${form.start} às ${toTime(toMin(form.start) + total)})` : problem}
              </div>
            )}
            <Field label="Observações (opcional)">
              <Textarea value={form.notes} maxLength={300} onChange={(e) => set("notes")(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={save}>{booking ? "Salvar alteração" : "Criar reserva"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Confirm
        open={confirm}
        onOpenChange={setConfirm}
        title="Alterar data ou horário?"
        text={`A reserva de ${form.client} será movida para ${form.date.split("-").reverse().join("/")} às ${form.start}.`}
        onConfirm={commit}
      />
    </>
  );
}

function Field({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function Confirm({ open, onOpenChange, title, text, onConfirm, danger }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; text: string; onConfirm: () => void; danger?: boolean }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{text}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction className={danger ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""} onClick={onConfirm}>Confirmar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function BookingActions({ booking, onEdit, onDetails }: { booking: Booking; onEdit: () => void; onDetails?: () => void }) {
  const [cancel, setCancel] = useState(false);
  const [remove, setRemove] = useState(false);
  const closed = booking.status !== "confirmada";
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Ações da reserva"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onDetails && <DropdownMenuItem onClick={onDetails}>Ver detalhes</DropdownMenuItem>}
          <DropdownMenuItem disabled={closed} onClick={onEdit}>Alterar horário</DropdownMenuItem>
          <DropdownMenuItem disabled={closed} onClick={() => { setStatus(booking.id, "concluida"); toast.success("Atendimento concluído"); }}>Marcar como concluído</DropdownMenuItem>
          <DropdownMenuItem disabled={closed} onClick={() => { setStatus(booking.id, "ausente"); toast("Cliente marcado como ausente"); }}>Marcar como ausente</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={booking.status === "cancelada"} className="text-destructive" onClick={() => setCancel(true)}>Cancelar reserva</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={() => setRemove(true)}>Excluir reserva</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Confirm
        open={cancel}
        onOpenChange={setCancel}
        danger
        title="Cancelar reserva?"
        text={`A reserva de ${booking.client} às ${booking.start} será cancelada e o horário ficará livre.`}
        onConfirm={() => { setStatus(booking.id, "cancelada"); toast("Reserva cancelada"); }}
      />
      <Confirm
        open={remove}
        onOpenChange={setRemove}
        danger
        title="Excluir reserva permanentemente?"
        text={`A reserva de ${booking.client}, dia ${booking.date.split("-").reverse().join("/")} às ${booking.start}, será retirada da agenda. Esta ação não pode ser desfeita.`}
        onConfirm={() => { deleteBooking(booking.id); toast.success("Reserva excluída"); }}
      />
    </>
  );
}

export function BookingDetails({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  const services = useStore((s) => s.services);
  if (!booking) return null;
  return (
    <Dialog open={!!booking} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-2xl uppercase">{booking.client}</DialogTitle></DialogHeader>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <dt className="text-muted-foreground">WhatsApp</dt><dd>{booking.phone}</dd>
          <dt className="text-muted-foreground">Serviço</dt><dd>{serviceNames(booking, services)} ({fmtDuration(totalDuration(bookingServiceIds(booking), services))})</dd>
          <dt className="text-muted-foreground">Data</dt><dd>{booking.date.split("-").reverse().join("/")}</dd>
          <dt className="text-muted-foreground">Horário</dt><dd>{startOf(booking)} – {endOf(booking, services)}{booking.shift ? ` (previsto ${booking.start}, ${booking.shift > 0 ? "+" : ""}${booking.shift} min)` : ""}</dd>
          <dt className="text-muted-foreground">Situação</dt><dd><StatusBadge status={booking.status} /></dd>
          {booking.notes && (<><dt className="text-muted-foreground">Observações</dt><dd>{booking.notes}</dd></>)}
        </dl>
      </DialogContent>
    </Dialog>
  );
}

export function BookingRow({ booking, onEdit, onDetails, showDate }: { booking: Booking; onEdit: () => void; onDetails: () => void; showDate?: boolean }) {
  const services = useStore((s) => s.services);
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border bg-card p-4">
      <div className="w-16 shrink-0 text-center">
        {showDate && <p className="text-[10px] uppercase text-muted-foreground">{booking.date.slice(8)}/{booking.date.slice(5, 7)}</p>}
        <p className="font-display text-2xl font-bold">{startOf(booking)}</p>
        <p className="text-xs text-muted-foreground">até {endOf(booking, services)}</p>
      </div>
      <button onClick={onDetails} className="min-w-0 text-left">
        <p className="truncate font-semibold">{booking.client}</p>
        <p className="truncate text-sm text-muted-foreground">{serviceNames(booking, services)}</p>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden sm:inline"><StatusBadge status={booking.status} /></span>
        <BookingActions booking={booking} onEdit={onEdit} onDetails={onDetails} />
      </div>
    </div>
  );
}

/** Hook bundling dialog state for create/edit/details on any page. */
export function useBookingDialogs() {
  const [editing, setEditing] = useState<Booking | null>(null);
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<Booking | null>(null);
  return {
    create: () => { setEditing(null); setOpen(true); },
    edit: (b: Booking) => { setEditing(b); setOpen(true); },
    details: (b: Booking) => setDetails(b),
    node: (
      <>
        <BookingDialog open={open} onOpenChange={setOpen} booking={editing} />
        <BookingDetails booking={details} onClose={() => setDetails(null)} />
      </>
    ),
  };
}
