import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarCheck, Check, CheckCircle2, Clock3, Info, Phone, Scissors,
  ShieldCheck, UserRound,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type Booking, type State, bookingServiceIds, checkAvailability, daySlots,
  fmtDuration, isAvailable, isBlocked, serviceNames, today, toMin, totalDuration,
  uid, upsertBooking, useStore,
} from "@/lib/store";

export const Route = createFileRoute("/agendar")({
  head: () => ({
    meta: [
      { title: "Agendar horário — Barbearia" },
      { name: "description", content: "Selecione seus serviços, escolha a data e agende seu horário." },
      { property: "og:title", content: "Agendar horário — Barbearia" },
      { property: "og:description", content: "Escolha o serviço e encontre um horário disponível." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CustomerBooking,
});

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

function validPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ||
    ((digits.length === 12 || digits.length === 13) && digits.startsWith("55"));
}

/** Uses the same business rules as the barber's agenda, including breaks and vacations. */
function openTimes(state: State, date: string, services: string[], clock: Date) {
  if (!state.loaded || !services.length || date < format(clock, "yyyy-MM-dd")) return [];
  const nowInMinutes = clock.getHours() * 60 + clock.getMinutes();
  return daySlots(state, date).filter((time) =>
    (date !== format(clock, "yyyy-MM-dd") || toMin(time) > nowInMinutes) &&
    isAvailable(state, date, time, services)
  );
}

function SectionTitle({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 font-display text-xl font-bold text-primary">{number}</span>
      <div>
        <h2 className="text-2xl font-bold uppercase leading-none sm:text-3xl">{title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function CustomerBooking() {
  const state = useStore((s) => s);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [chosenServices, setChosenServices] = useState<string[]>([]);
  const [chosenDate, setChosenDate] = useState("");
  const [chosenTime, setChosenTime] = useState("");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<Booking | null>(null);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const selectedServices = state.services.filter((service) => chosenServices.includes(service.id));
  const selectedDuration = totalDuration(chosenServices, state.services);
  const totalPrice = selectedServices.reduce((sum, service) => sum + (service.price ?? 0), 0);
  const freeTimes = chosenDate ? openTimes(state, chosenDate, chosenServices, clock) : [];
  const selectedDate = chosenDate ? parseISO(chosenDate) : undefined;
  const ready = state.loaded && customerName.trim().length >= 2 &&
    validPhone(phone) && chosenServices.length > 0 && !!chosenDate &&
    !!chosenTime && freeTimes.includes(chosenTime);

  function toggleService(id: string) {
    setChosenServices((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]
    );
    setChosenTime("");
    setError("");
  }

  function isDayDisabled(date: Date) {
    const key = format(date, "yyyy-MM-dd");
    return !chosenServices.length || key < today() ||
      openTimes(state, key, chosenServices, clock).length === 0;
  }

  function selectDate(date: Date | undefined) {
    setChosenDate(date ? format(date, "yyyy-MM-dd") : "");
    setChosenTime("");
    setError("");
  }

  function confirm() {
    setError("");
    if (!state.loaded) {
      setError("A agenda ainda está carregando. Tente novamente.");
      return;
    }
    if (customerName.trim().length < 2 || customerName.trim().length > 80) {
      setError("Informe seu nome completo para continuar.");
      return;
    }
    if (!validPhone(phone)) {
      setError("Informe um número de WhatsApp válido com DDD.");
      return;
    }
    if (!chosenServices.length || chosenServices.some((id) => !state.services.some((s) => s.id === id))) {
      setError("Escolha pelo menos um serviço disponível.");
      return;
    }
    if (!chosenDate || !chosenTime) {
      setError("Selecione a data e o horário.");
      return;
    }
    if (isBlocked(state, phone)) {
      setError("Não foi possível concluir o agendamento. Entre em contato com o estabelecimento.");
      return;
    }
    // Always check again on confirmation, including past slots.
    if (!openTimes(state, chosenDate, chosenServices, new Date()).includes(chosenTime) ||
        checkAvailability(state, chosenDate, chosenTime, chosenServices) !== null) {
      setChosenTime("");
      setError("Esse horário não está mais disponível. Escolha outro horário.");
      return;
    }

    const booking: Booking = {
      id: uid(),
      client: customerName.trim().replace(/\s+/g, " "),
      phone: phone.trim(),
      serviceId: chosenServices[0]!,
      serviceIds: chosenServices,
      date: chosenDate,
      start: chosenTime,
      status: "confirmada",
      demo: true,
      createdAt: Date.now(),
    };
    // Demonstration only. This browser's localStorage is NOT a shared booking backend.
    upsertBooking(booking, true);
    setConfirmed(booking);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function newBooking() {
    setConfirmed(null);
    setChosenServices([]);
    setChosenDate("");
    setChosenTime("");
    setError("");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-sidebar/80">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5 sm:px-6">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-gold text-primary-foreground">
            <Scissors className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">{state.settings.shopName}</p>
            <p className="text-xs text-muted-foreground">Agendamento online</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        {confirmed ? (
          <div className="mx-auto max-w-2xl rounded-2xl border border-success/30 bg-card p-6 text-center shadow-lg sm:p-10">
            <div className="mx-auto grid size-20 place-items-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="size-12" />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-success">Agendamento de demonstração</p>
            <h1 className="mt-2 text-4xl font-extrabold uppercase sm:text-5xl">Horário registrado!</h1>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Seu agendamento foi salvo nesta versão de testes.
            </p>
            <div className="mt-8 space-y-3 rounded-xl border border-border bg-background p-5 text-left">
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Cliente</span><strong className="text-right">{confirmed.client}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">WhatsApp</span><strong className="text-right">{confirmed.phone}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Serviços</span><strong className="max-w-[65%] text-right">{serviceNames(confirmed, state.services)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Data</span><strong className="text-right capitalize">{format(parseISO(confirmed.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Horário</span><strong>{confirmed.start}</strong></div>
              <div className="flex justify-between gap-3 border-t border-border pt-3"><span className="text-muted-foreground">Total</span><strong className="text-xl text-primary">{money(bookingServiceIds(confirmed).reduce((acc, id) => acc + (state.services.find((s) => s.id === id)?.price ?? 0), 0))}</strong></div>
            </div>
            <div className="mt-5 rounded-lg border border-warning/30 bg-warning/10 p-4 text-left text-sm text-muted-foreground">
              <Info className="mr-2 inline size-4 text-warning" />
              Modo de demonstração: a reserva existe apenas neste navegador. Nenhuma mensagem foi enviada pelo WhatsApp. A integração real será feita posteriormente.
            </div>
            <Button onClick={newBooking} className="mt-6 w-full bg-gold text-primary-foreground sm:w-auto">
              Agendar outro horário
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-8 max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <CalendarCheck className="size-4" /> Agendamento online
              </div>
              <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.95] sm:text-6xl">
                Seu próximo horário começa aqui.
              </h1>
              <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
                Informe seus dados, escolha os serviços e selecione um horário disponível.
                Simples, rápido e sem precisar criar uma conta.
              </p>
              <p className="mt-3 flex items-start gap-2 text-xs text-warning">
                <Info className="mt-0.5 size-4 shrink-0" />
                Versão de testes: as reservas são salvas somente neste navegador, sem confirmação por WhatsApp.
              </p>
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.85fr)]">
              <div className="grid min-w-0 gap-5">
                <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
                  <SectionTitle number="01" title="Seus dados" subtitle="Precisamos destas informações para identificar a reserva." />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="flex items-center gap-2 text-sm font-semibold"><UserRound className="size-4 text-primary" /> Nome completo</span>
                      <Input autoComplete="name" value={customerName} maxLength={80}
                        onChange={(event) => { setCustomerName(event.target.value); setError(""); }}
                        placeholder="Seu nome" aria-label="Nome completo" />
                    </label>
                    <label className="grid gap-2">
                      <span className="flex items-center gap-2 text-sm font-semibold"><Phone className="size-4 text-primary" /> Número de WhatsApp</span>
                      <Input type="tel" inputMode="tel" autoComplete="tel" maxLength={22} value={phone}
                        onChange={(event) => { setPhone(event.target.value); setError(""); }}
                        placeholder="(31) 99999-9999" aria-label="Número de WhatsApp" />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
                  <SectionTitle number="02" title="Escolha os serviços" subtitle="Você pode selecionar mais de um serviço." />
                  {state.loaded && state.services.length === 0 ? (
                    <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">Nenhum serviço cadastrado no momento.</p>
                  ) : (
                    <div className="grid gap-2">
                      {state.services.map((service) => {
                        const active = chosenServices.includes(service.id);
                        return (
                          <button key={service.id} type="button" aria-pressed={active}
                            onClick={() => toggleService(service.id)}
                            className={[
                              "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors",
                              active ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/50",
                            ].join(" ")}>
                            <span className={[
                              "grid size-6 shrink-0 place-items-center rounded-md border",
                              active ? "border-primary bg-primary text-primary-foreground" : "border-input",
                            ].join(" ")}>
                              {active && <Check className="size-4" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold">{service.name}</span>
                              <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock3 className="size-3.5" /> {fmtDuration(service.duration)}
                              </span>
                            </span>
                            <strong className="shrink-0 font-display text-xl text-primary">{money(service.price ?? 0)}</strong>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
                  <SectionTitle number="03" title="Data e horário" subtitle="Os horários mudam conforme os serviços escolhidos." />
                  {!chosenServices.length && (
                    <p className="mb-4 rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm text-muted-foreground">
                      Primeiro escolha pelo menos um serviço para consultar a agenda.
                    </p>
                  )}
                  <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="min-w-0">
                      <p className="mb-3 text-sm font-semibold">Selecione uma data</p>
                      <div className="flex justify-center overflow-hidden rounded-xl border border-border bg-background p-2">
                        <Calendar
                          mode="single"
                          locale={ptBR}
                          weekStartsOn={1}
                          selected={selectedDate}
                          onSelect={selectDate}
                          disabled={isDayDisabled}
                          showOutsideDays={false}
                          className="mx-auto [--cell-size:2.25rem] sm:[--cell-size:2.5rem]"
                          classNames={{ today: "text-primary font-semibold" }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Datas sem expediente, de férias ou sem horários livres ficam indisponíveis.
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="mb-3 text-sm font-semibold">Horários disponíveis</p>
                      {!chosenDate ? (
                        <div className="rounded-xl border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
                          <Clock3 className="mx-auto mb-3 size-7 text-primary/70" />
                          Escolha uma data no calendário para ver os horários.
                        </div>
                      ) : freeTimes.length ? (
                        <>
                          <p className="mb-3 text-xs capitalize text-muted-foreground">
                            {format(parseISO(chosenDate), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                          </p>
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-3">
                            {freeTimes.map((time) => (
                              <button key={time} type="button" aria-pressed={chosenTime === time}
                                onClick={() => { setChosenTime(time); setError(""); }}
                                className={[
                                  "rounded-lg border px-2 py-3 text-center text-sm font-semibold transition-colors",
                                  chosenTime === time
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-background hover:border-primary hover:text-primary",
                                ].join(" ")}>
                                {time}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="rounded-xl border border-dashed border-border bg-background p-5 text-sm text-muted-foreground">
                          Não há horários disponíveis nesta data para os serviços escolhidos. Selecione outra data.
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              </div>

              <aside className="min-w-0 lg:sticky lg:top-6">
                <div className="rounded-2xl border border-primary/30 bg-card p-5 shadow-lg sm:p-7">
                  <h2 className="font-display text-3xl font-bold uppercase">Seu agendamento</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Confira os detalhes antes de confirmar.</p>
                  <div className="mt-5 space-y-4">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Cliente</span>
                      <span className="max-w-[65%] break-words text-right font-semibold">{customerName.trim() || "A informar"}</span>
                    </div>
                    <div className="border-t border-border pt-4">
                      <p className="mb-2 text-sm text-muted-foreground">Serviços</p>
                      {selectedServices.length ? selectedServices.map((service) => (
                        <div key={service.id} className="mb-2 flex justify-between gap-3 text-sm">
                          <span>{service.name}</span>
                          <span className="shrink-0">{money(service.price ?? 0)}</span>
                        </div>
                      )) : <p className="text-sm text-muted-foreground">Nenhum serviço escolhido</p>}
                    </div>
                    <div className="flex justify-between gap-3 border-t border-border pt-4 text-sm">
                      <span className="text-muted-foreground">Duração total</span>
                      <strong>{selectedServices.length ? fmtDuration(selectedDuration) : "—"}</strong>
                    </div>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Data</span>
                      <strong className="text-right capitalize">
                        {chosenDate ? format(parseISO(chosenDate), "dd/MM/yyyy") : "A escolher"}
                      </strong>
                    </div>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Horário</span>
                      <strong>{chosenTime || "A escolher"}</strong>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 border-t border-border pt-4">
                      <span className="text-sm font-semibold">Total</span>
                      <strong className="font-display text-3xl font-bold text-primary">{money(totalPrice)}</strong>
                    </div>
                  </div>

                  {error && (
                    <p role="alert" className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  <Button className="mt-6 h-12 w-full bg-gold text-primary-foreground"
                    onClick={confirm} disabled={!state.loaded}>
                    <CheckCircle2 className="size-5" />
                    {ready ? "Confirmar agendamento" : "Conferir e confirmar"}
                  </Button>
                  <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                    Teste local, sem pagamento online e sem envio automático de mensagens.
                  </p>
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
      <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground">
        {state.settings.shopName} · Agendamento online · Versão de demonstração
      </footer>
    </div>
  );
}
