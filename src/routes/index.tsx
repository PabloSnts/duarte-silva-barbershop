import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleAlert, Clock3, Scissors, Search, Settings2, ShieldCheck, Sparkles,
  Users, Wallet, Plus, MoreHorizontal, LayoutDashboard, Monitor, SlidersHorizontal,
  Menu, X, ArrowUpRight, Bell, CalendarPlus, UserRound, Ban, BriefcaseBusiness, Trash2,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: Index });

type Section = "Início" | "Agenda" | "Agendamentos" | "Clientes" | "Serviços" | "Blacklist" | "Configurações";
type Appointment = {
  id: number; name: string; phone: string; service: string; time: string;
  duration: number; status: "Confirmado" | "Aguardando" | "Concluído"; price: number; date?: string;
};

const initialAppointments: Appointment[] = [
  { id: 1, name: "Rafael Oliveira", phone: "(31) 98821-4302", service: "Corte + Barba", time: "09:00", duration: 60, status: "Concluído", price: 70 },
  { id: 2, name: "Pablo Santos", phone: "(31) 99214-8831", service: "Corte de cabelo", time: "10:00", duration: 30, status: "Confirmado", price: 35 },
  { id: 3, name: "Lucas Ferreira", phone: "(31) 98760-1254", service: "Corte + Barba", time: "10:30", duration: 60, status: "Confirmado", price: 70 },
  { id: 4, name: "André Martins", phone: "(31) 99172-4408", service: "Corte infantil", time: "11:30", duration: 30, status: "Aguardando", price: 35 },
  { id: 5, name: "Gabriel Souza", phone: "(31) 98931-2207", service: "Prótese capilar", time: "14:00", duration: 60, status: "Confirmado", price: 120 },
  { id: 6, name: "Mateus Costa", phone: "(31) 98451-9930", service: "Barba", time: "15:00", duration: 30, status: "Confirmado", price: 35 },
];

const navItems: { label: Section; icon: typeof LayoutDashboard }[] = [
  { label: "Início", icon: LayoutDashboard },
  { label: "Agenda", icon: CalendarDays },
  { label: "Agendamentos", icon: CalendarPlus },
  { label: "Clientes", icon: Users },
  { label: "Serviços", icon: Scissors },
  { label: "Blacklist", icon: ShieldCheck },
  { label: "Configurações", icon: Settings2 },
];

const services = [
  { name: "Corte de cabelo", duration: 30, price: 35 },
  { name: "Corte infantil", duration: 30, price: 35 },
  { name: "Barba", duration: 30, price: 35 },
  { name: "Prótese capilar", duration: 60, price: 120 },
  { name: "Manutenção de prótese", duration: 30, price: 60 },
];

function Index() {
  const [section, setSection] = useState<Section>("Início");
  const [appointments, setAppointments] = useState<Appointment[]>(() => { try { const saved = localStorage.getItem("barbearia-store-v1"); if (saved) { const parsed = JSON.parse(saved); if (Array.isArray(parsed.appointments)) return parsed.appointments; } } catch {} return initialAppointments.map((a) => ({ ...a, date: "2026-10-27" })); });
  const [search, setSearch] = useState("");
  const [showBooking, setShowBooking] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const [booking, setBooking] = useState({ name: "", phone: "", date: "2026-10-27", time: "16:00", serviceNames: ["Corte de cabelo"] as string[] });
  const [blocked, setBlocked] = useState<{ name: string; phone: string; reason: string; date: string }[]>(() => { try { const saved = localStorage.getItem("barbearia-store-v1"); const parsed = saved ? JSON.parse(saved) : null; if (Array.isArray(parsed?.blocked)) return parsed.blocked; } catch {} return [
    { name: "Contato bloqueado", phone: "(31) 90000-0000", reason: "Solicitação do responsável", date: "12/10/2026" },
  ]; });
  const [blockForm, setBlockForm] = useState({ name: "", phone: "", reason: "" });
  const [tvNameFormat, setTvNameFormat] = useState("Nome - Serviços");
  const [workDays, setWorkDays] = useState<string[]>(() => { try { const saved = localStorage.getItem("barbearia-store-v1"); const parsed = saved ? JSON.parse(saved) : null; if (Array.isArray(parsed?.workDays)) return parsed.workDays; } catch {} return ["Seg", "Qua", "Qui", "Sex", "Sáb"]; });
  const [vacationStart, setVacationStart] = useState("");
  const [vacationEnd, setVacationEnd] = useState("");
  const [vacations, setVacations] = useState<{ start: string; end: string }[]>(() => { try { const saved = localStorage.getItem("barbearia-store-v1"); const parsed = saved ? JSON.parse(saved) : null; return Array.isArray(parsed?.vacations) ? parsed.vacations : []; } catch { return []; } });

  const lastRemoteStore = useRef("");
  useEffect(() => {
    const channel = new BroadcastChannel("barbearia-store-v1");
    const publish = () => { const store = { appointments, blocked, workDays, vacations, tvNameFormat }; const serialized = JSON.stringify(store); if (serialized === lastRemoteStore.current) { lastRemoteStore.current = ""; return; } localStorage.setItem("barbearia-store-v1", serialized); channel.postMessage(store); };
    publish();
    const receive = (event: MessageEvent) => { const store = event.data; if (!store || typeof store !== "object") return; lastRemoteStore.current = JSON.stringify({ appointments: store.appointments ?? appointments, blocked: store.blocked ?? blocked, workDays: store.workDays ?? workDays, vacations: store.vacations ?? vacations, tvNameFormat: store.tvNameFormat ?? tvNameFormat }); if (Array.isArray(store.appointments)) setAppointments(store.appointments); if (Array.isArray(store.blocked)) setBlocked(store.blocked); if (Array.isArray(store.workDays)) setWorkDays(store.workDays); if (Array.isArray(store.vacations)) setVacations(store.vacations); if (typeof store.tvNameFormat === "string") setTvNameFormat(store.tvNameFormat); };
    channel.addEventListener("message", receive);
    const receiveStorage = (event: StorageEvent) => { if (event.key !== "barbearia-store-v1" || !event.newValue) return; try { receive({ data: JSON.parse(event.newValue) } as MessageEvent); } catch {} };
    window.addEventListener("storage", receiveStorage);
    return () => { channel.removeEventListener("message", receive); window.removeEventListener("storage", receiveStorage); channel.close(); };
  }, [appointments, blocked, workDays, vacations, tvNameFormat]);
  const [delay, setDelay] = useState("15");
  const [delayFrom, setDelayFrom] = useState("10:30");

  const todayAppointments = useMemo(() => [...appointments].sort((a, b) => a.time.localeCompare(b.time)), [appointments]);
  const filteredAppointments = todayAppointments.filter((a) => `${a.name} ${a.phone} ${a.service}`.toLowerCase().includes(search.toLowerCase()));
  const completed = appointments.filter((a) => a.status === "Concluído").length;
  const revenue = appointments.filter((a) => a.status === "Concluído").reduce((sum, a) => sum + a.price, 0);
  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  };

  function saveBooking() {
    const normalizedPhone = booking.phone.replace(/\D/g, "");
    if (!booking.name.trim() || normalizedPhone.length < 10) {
      showNotice("Informe o nome e um telefone válido.");
      return;
    }
    if (blocked.some((item) => item.phone.replace(/\D/g, "") === normalizedPhone)) {
      showNotice("Este telefone está na Blacklist. A reserva não pode ser criada.");
      return;
    }
    const selectedServices = services.filter((item) => booking.serviceNames.includes(item.name));
    if (selectedServices.length === 0) {
      showNotice("Selecione pelo menos um serviço.");
      return;
    }
    const totalDuration = selectedServices.reduce((sum, item) => sum + item.duration, 0);
    const totalPrice = selectedServices.reduce((sum, item) => sum + item.price, 0);
    const serviceLabel = selectedServices.map((item) => item.name).join(" + ");
    const selectedDate = typeof booking.date === "string" ? booking.date.trim() : "";
    const selectedTime = typeof booking.time === "string" ? booking.time.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate) || Number.isNaN(new Date(`${selectedDate}T12:00:00`).getTime())) {
      showNotice("Selecione uma data válida para a reserva.");
      return;
    }
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(selectedTime);
    if (!timeMatch) {
      showNotice("Selecione um horário válido.");
      return;
    }
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      showNotice("Selecione um horário válido.");
      return;
    }
    const startMinute = hour * 60 + minute;
    const endMinute = startMinute + totalDuration;
    const end = `${String(Math.floor(endMinute / 60)).padStart(2, "0")}:${String(endMinute % 60).padStart(2, "0")}`;
    const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const bookingWeekday = weekdayLabels[new Date(`${selectedDate}T12:00:00`).getDay()] ?? "";
    if (vacations.some((period) => selectedDate >= period.start && selectedDate <= period.end)) { showNotice("A barbearia estará fechada durante o período de férias cadastrado."); return; }
    if (!workDays.includes(bookingWeekday)) { showNotice(`A barbearia não atende às ${bookingWeekday}.`); return; }
    if (minute % 30 !== 0) { showNotice("Escolha um horário em intervalos de 30 minutos."); return; }
    if (startMinute < 8 * 60 || endMinute > 20 * 60) { showNotice("O atendimento precisa acontecer entre 08:00 e 20:00."); return; }
    if (startMinute < 13 * 60 && endMinute > 12 * 60) { showNotice("O atendimento não pode atravessar o intervalo de almoço (12:00–13:00)."); return; }
    const overlaps = appointments.some((a) => {
      const [h = 0, m = 0] = a.time.split(":").map(Number);
      const start = h * 60 + m;
      return (a.date ?? "2026-10-27") === selectedDate && start < endMinute && start + a.duration > startMinute;
    });
    if (overlaps) {
      showNotice("Conflito de horário: este intervalo já possui uma reserva.");
      return;
    }
    setAppointments((current) => [...current, {
      id: Math.max(0, ...current.map((a) => a.id)) + 1, name: booking.name.trim(),
      phone: booking.phone, service: serviceLabel, time: selectedTime,
      duration: totalDuration, status: "Confirmado" as const, price: totalPrice, date: selectedDate,
    }].sort((a, b) => a.time.localeCompare(b.time)));
    setShowBooking(false);
    setBooking({ name: "", phone: "", date: "2026-10-27", time: "16:00", serviceNames: ["Corte de cabelo"] });
    showNotice(`Reserva criada. Atendimento previsto até ${end}.`);
  }

  function applyDelay() {
    const offset = Number(delay);
    if (!Number.isFinite(offset) || offset === 0 || offset % 30 !== 0) {
      showNotice("O ajuste deve ser múltiplo de 30 minutos (30, 60, 90...).");
      return;
    }
    setAppointments((current) => current.map((a) => {
      if (a.time < delayFrom) return a;
      const [h = 0, m = 0] = a.time.split(":").map(Number);
      const total = Math.max(0, h * 60 + m + offset);
      return { ...a, time: `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}` };
    }).sort((a, b) => a.time.localeCompare(b.time)));
    showNotice(`Ajuste aplicado localmente em cascata: ${offset > 0 ? "+" : ""}${offset} minutos. Confira os conflitos antes de confirmar.`);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${showMobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Scissors size={23} strokeWidth={1.7} /></div>
          <div><div className="brand-name">DUARTE <span>&</span> SILVA</div><div className="brand-caption">BARBERSHOP · MANAGEMENT</div></div>
          <button className="icon-button mobile-close" onClick={() => setShowMobileNav(false)} aria-label="Fechar menu"><X size={18} /></button>
        </div>
        <div className="workspace-label">ESPAÇO DE TRABALHO</div>
        <nav className="side-nav">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${section === label ? "active" : ""}`} onClick={() => { setSection(label); setShowMobileNav(false); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === "Agenda" && <span className="nav-count">{appointments.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-status"><span className="status-dot" /><div><strong>Modo demonstração</strong><small>Dados locais · sem Supabase</small></div></div>
          <button className="nav-item tv-link" onClick={() => window.open("/tv", "_blank", "noopener,noreferrer")}><Monitor size={18} /><span>Visualização na TV</span><ArrowUpRight size={15} /></button>
          <div className="profile"><div className="profile-avatar">DS</div><div className="profile-copy"><strong>Barbeiro administrador</strong><small>Gestão da barbearia</small></div><MoreHorizontal size={18} className="muted-icon" /></div>
        </div>
      </aside>

      {showMobileNav && <button className="mobile-overlay" aria-label="Fechar menu" onClick={() => setShowMobileNav(false)} />}
      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setShowMobileNav(true)} aria-label="Abrir menu"><Menu size={20} /></button><div className="breadcrumb">Barbearia <ChevronRight size={14} /> <strong>{section}</strong></div></div>
          <div className="topbar-actions"><span className="live-indicator"><span className="status-dot" /> Operação ativa</span><button className="icon-button notification-button" aria-label="Notificações"><Bell size={18} /><i /></button><div className="date-chip"><CalendarDays size={15} /> Ter, 27 out.</div></div>
        </header>
        <div className="content">
          {section === "Início" && <Dashboard appointments={todayAppointments} completed={completed} revenue={revenue} onBook={() => setShowBooking(true)} onNavigate={setSection} />}
          {section === "Agenda" && <Agenda appointments={todayAppointments} onBook={() => setShowBooking(true)} delay={delay} setDelay={setDelay} delayFrom={delayFrom} setDelayFrom={setDelayFrom} applyDelay={applyDelay} />}
          {section === "Agendamentos" && <Appointments appointments={filteredAppointments} search={search} setSearch={setSearch} onBook={() => setShowBooking(true)} setAppointments={setAppointments} />}
          {section === "Clientes" && <Clients appointments={appointments} search={search} setSearch={setSearch} />}
          {section === "Serviços" && <Services />}
          {section === "Blacklist" && <Blacklist blocked={blocked} setBlocked={setBlocked} form={blockForm} setForm={setBlockForm} showNotice={showNotice} />}
          {section === "Configurações" && <Settings tvNameFormat={tvNameFormat} setTvNameFormat={setTvNameFormat} workDays={workDays} setWorkDays={setWorkDays} vacationStart={vacationStart} setVacationStart={setVacationStart} vacationEnd={vacationEnd} setVacationEnd={setVacationEnd} vacations={vacations} setVacations={setVacations} showNotice={showNotice} />}
        </div>
      </main>

      {showBooking && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowBooking(false); }}>
        <section className="booking-modal">
          <div className="modal-heading"><div><span className="eyebrow">AGENDA · NOVO REGISTRO</span><h2>Nova reserva</h2><p>Preencha os dados para adicionar um atendimento.</p></div><button className="icon-button" onClick={() => setShowBooking(false)} aria-label="Fechar"><X size={19} /></button></div>
          <div className="form-grid"><label className="field full-field">Nome do cliente<input value={booking.name} onChange={(e) => setBooking({ ...booking, name: e.target.value })} placeholder="Ex.: João da Silva" /></label>
          <label className="field full-field">Telefone / WhatsApp<input value={booking.phone} onChange={(e) => setBooking({ ...booking, phone: e.target.value })} placeholder="(31) 99999-9999" /></label>
          <div className="field full-field"><span className="field-label">Serviços</span><p className="field-help">Selecione um ou mais serviços para o mesmo atendimento.</p><div className="booking-services">{services.map((s) => { const checked = booking.serviceNames.includes(s.name); return <label key={s.name} className={`booking-service-option ${checked ? "service-option-selected" : ""}`}><input type="checkbox" checked={checked} onChange={(e) => setBooking((current) => ({ ...current, serviceNames: e.target.checked ? [...current.serviceNames, s.name] : current.serviceNames.filter((name) => name !== s.name) }))} /><span className="booking-service-check">{checked && <Check size={13} />}</span><span className="booking-service-copy"><strong>{s.name}</strong><small>{s.duration} min · R$ {s.price},00</small></span><span className="booking-service-price">R$ {s.price},00</span></label>; })}</div></div>
          <label className="field">Data<input type="date" value={booking.date} onChange={(e) => setBooking({ ...booking, date: e.target.value })} /></label>
          <label className="field">Horário<select value={booking.time} onChange={(e) => setBooking({ ...booking, time: e.target.value })}>{Array.from({ length: 24 }, (_, i) => { const mins = 8 * 60 + i * 30; return mins <= 19 * 60 + 30 ? `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}` : null; }).filter(Boolean).map((time) => <option key={time}>{time}</option>)}</select></label>
          <div className="booking-summary"><Clock3 size={17} /><span>Duração total</span><strong>{services.filter((s) => booking.serviceNames.includes(s.name)).reduce((sum, s) => sum + s.duration, 0)} min</strong><span className="summary-divider" /><span>Valor total</span><strong>R$ {services.filter((s) => booking.serviceNames.includes(s.name)).reduce((sum, s) => sum + s.price, 0)},00</strong></div>
          <p className="form-note full-field"><CircleAlert size={15} /> Demonstração: as reservas ficam apenas nesta sessão do navegador. A persistência e validação definitiva dependem da integração com o Supabase existente.</p></div>
          <div className="modal-actions"><button className="button button-secondary" onClick={() => setShowBooking(false)}>Cancelar</button><button className="button button-primary" onClick={saveBooking}><Check size={16} /> Confirmar reserva</button></div>
        </section>
      </div>}
      {notice && <div className="toast"><span className="toast-icon"><Check size={16} /></span>{notice}<button onClick={() => setNotice("")} aria-label="Fechar aviso"><X size={15} /></button></div>}
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Dashboard({ appointments, completed, revenue, onBook, onNavigate }: { appointments: Appointment[]; completed: number; revenue: number; onBook: () => void; onNavigate: (section: Section) => void }) {
  const next = appointments.find((a) => a.status !== "Concluído");
  return <>
    <PageHeading eyebrow="TERÇA-FEIRA · 27 DE OUTUBRO, 2026" title="Bom dia, barbeiro." description="Aqui está o panorama da sua operação hoje." action={<button className="button button-primary" onClick={onBook}><Plus size={17} /> Nova reserva</button>} />
    <div className="welcome-banner"><div className="banner-decoration"><Sparkles size={20} /></div><div className="banner-copy"><span>SEU DIA, NO CONTROLE</span><h2>Precisão em cada horário.</h2><p>Acompanhe a agenda, mantenha o ritmo e entregue uma experiência impecável.</p></div><div className="banner-stat"><small>PRÓXIMO ATENDIMENTO</small><strong>{next?.time ?? "—"}</strong><span>{next?.name ?? "Agenda livre"}</span></div></div>
    <div className="metrics-grid">
      <Metric title="Agendamentos hoje" value={String(appointments.length).padStart(2, "0")} detail="Atendimentos na agenda" icon={CalendarDays} tone="gold" />
      <Metric title="Concluídos" value={String(completed).padStart(2, "0")} detail={appointments.length ? `${Math.round(completed / appointments.length * 100)}% da agenda` : "Sem atendimentos"} icon={Check} tone="green" />
      <Metric title="Faturamento realizado" value={`R$ ${revenue.toLocaleString("pt-BR")}`} detail="Somente serviços concluídos" icon={Wallet} tone="blue" />
      <Metric title="Próximo horário livre" value="12:00" detail="Janela disponível estimada" icon={Clock3} tone="purple" />
    </div>
    <div className="dashboard-columns">
      <section className="panel today-panel"><div className="panel-heading"><div><h3>Agenda de hoje</h3><p>Próximos atendimentos programados</p></div><button className="text-action" onClick={() => onNavigate("Agenda")}>Ver agenda <ArrowUpRight size={15} /></button></div>
        <div className="appointment-list">{appointments.slice(0, 5).map((a) => <AppointmentRow key={a.id} appointment={a} />)}</div>
        <button className="panel-footer-link" onClick={() => onNavigate("Agendamentos")}>Ver todos os agendamentos <ChevronRight size={16} /></button>
      </section>
      <div className="right-column"><section className="panel occupancy-panel"><div className="panel-heading"><div><h3>Ritmo do dia</h3><p>Ocupação estimada</p></div><Activity size={18} className="gold-icon" /></div><div className="occupancy-number">68<span>%</span></div><div className="progress-track"><div className="progress-value" style={{ width: "68%" }} /></div><div className="progress-meta"><span>Tempo reservado</span><strong>4h 30min</strong></div><div className="progress-meta"><span>Capacidade total</span><strong>8h úteis</strong></div></section>
      <section className="quick-panel"><h3>Acesso rápido</h3><button onClick={() => onNavigate("Clientes")}><span className="quick-icon"><Users size={17} /></span><span><strong>Clientes</strong><small>Consultar cadastro e histórico</small></span><ChevronRight size={16} /></button><button onClick={() => onNavigate("Serviços")}><span className="quick-icon"><Scissors size={17} /></span><span><strong>Serviços</strong><small>Preços e durações</small></span><ChevronRight size={16} /></button><button onClick={() => onNavigate("Blacklist")}><span className="quick-icon"><ShieldCheck size={17} /></span><span><strong>Blacklist</strong><small>Gerenciar bloqueios</small></span><ChevronRight size={16} /></button></section></div>
    </div>
    <div className="dashboard-footnote"><span className="status-dot" /> Visão demonstrativa com dados fictícios. Conecte o banco existente para operação real.</div>
  </>;
}

function Metric({ title, value, detail, icon: Icon, tone }: { title: string; value: string; detail: string; icon: typeof Activity; tone: string }) {
  return <div className="metric-card"><div className="metric-top"><span>{title}</span><span className={`metric-icon ${tone}`}><Icon size={18} /></span></div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></div>;
}

function AppointmentRow({ appointment: a }: { appointment: Appointment }) {
  const statusClass = a.status === "Concluído" ? "status-complete" : a.status === "Aguardando" ? "status-waiting" : "status-confirmed";
  return <div className="appointment-row"><div className="appointment-time">{a.time}<span>{a.duration} min</span></div><div className="appointment-person"><div className="person-avatar">{a.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}</div><div><strong>{a.name}</strong><small>{a.service}</small></div></div><span className={`status-pill ${statusClass}`}><i />{a.status}</span><span className="appointment-price">R$ {a.price},00</span></div>;
}

function Agenda({ appointments, onBook, delay, setDelay, delayFrom, setDelayFrom, applyDelay }: { appointments: Appointment[]; onBook: () => void; delay: string; setDelay: (v: string) => void; delayFrom: string; setDelayFrom: (v: string) => void; applyDelay: () => void }) {
  const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [view, setView] = useState<"Dia" | "Semana" | "Mês">("Dia");
  const [showAdjust, setShowAdjust] = useState(false);
  const selected = new Date(`${selectedDate}T12:00:00`);
  const rangeStart = new Date(selected);
  if (view === "Semana") rangeStart.setDate(rangeStart.getDate() - ((rangeStart.getDay() + 6) % 7));
  if (view === "Mês") rangeStart.setDate(1);
  const rangeEnd = new Date(rangeStart);
  if (view === "Semana") rangeEnd.setDate(rangeEnd.getDate() + 7);
  else if (view === "Mês") rangeEnd.setMonth(rangeEnd.getMonth() + 1);
  else rangeEnd.setDate(rangeEnd.getDate() + 1);
  const inRange = (a: Appointment) => {
    const d = a.date ?? dateKey(new Date());
    return d >= dateKey(rangeStart) && d < dateKey(rangeEnd);
  };
  const visibleAppointments = appointments.filter(inRange).sort((a,b) => (a.date ?? "").localeCompare(b.date ?? "") || a.time.localeCompare(b.time));
  const moveRange = (offset: number) => {
    const next = new Date(selected);
    if (view === "Semana") next.setDate(next.getDate() + offset * 7);
    else if (view === "Mês") next.setMonth(next.getMonth() + offset);
    else next.setDate(next.getDate() + offset);
    setSelectedDate(dateKey(next));
  };
  const headingDate = view === "Dia"
    ? selected.toLocaleDateString("pt-BR", { weekday:"long", day:"2-digit", month:"long", year:"numeric" })
    : view === "Semana"
      ? `${rangeStart.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})} – ${new Date(rangeEnd.getTime()-86400000).toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"})}`
      : selected.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  const dayRows = view === "Dia"
    ? [selectedDate]
    : Array.from({length: view === "Semana" ? 7 : new Date(rangeStart.getFullYear(),rangeStart.getMonth()+1,0).getDate()},(_,i)=>{const d=new Date(rangeStart);d.setDate(d.getDate()+i);return dateKey(d);});
  return <><PageHeading eyebrow="PLANEJAMENTO OPERACIONAL" title="Agenda" description="Visualize os horários e acompanhe o fluxo de atendimentos." action={<button className="button button-primary" onClick={onBook}><Plus size={17} /> Nova reserva</button>} />
    <div className="toolbar"><div className="date-navigator"><button className="icon-button" aria-label="Período anterior" onClick={() => moveRange(-1)}><ChevronLeft size={17} /></button><strong>{headingDate.charAt(0).toUpperCase()+headingDate.slice(1)}</strong><button className="icon-button" aria-label="Próximo período" onClick={() => moveRange(1)}><ChevronRight size={17} /></button><input aria-label="Selecionar data" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} /><button className="button button-secondary button-small" onClick={() => setSelectedDate(dateKey(new Date()))}>Hoje</button></div><div className="toolbar-actions"><div className="segmented">{(["Dia", "Semana", "Mês"] as const).map((v) => <button key={v} className={view === v ? "selected" : ""} onClick={() => setView(v)}>{v}</button>)}</div><button className="button button-secondary button-small" onClick={() => setShowAdjust(!showAdjust)}><SlidersHorizontal size={15} /> Ajustar horários</button></div></div>
    {showAdjust && <section className="panel adjust-panel"><div><h3>Ajuste de fluxo do dia</h3><p>Simule o atraso ou adiantamento dos atendimentos a partir de um horário.</p></div><div className="adjust-fields"><label className="field">A partir das<select value={delayFrom} onChange={(e) => setDelayFrom(e.target.value)}>{appointments.map((a) => <option key={a.id}>{a.time}</option>)}</select></label><label className="field">Ajuste (minutos)<input type="number" min="30" step="30" value={delay} onChange={(e) => setDelay(e.target.value)} /></label><button className="button button-primary" onClick={applyDelay}>Aplicar simulação</button></div><p className="form-note"><CircleAlert size={15} /> Protótipo local: a simulação altera apenas os dados desta sessão; ainda não existe persistência nem desfazer.</p></section>}
    {view === "Dia" ? <div className="schedule-layout"><section className="panel schedule-panel"><div className="schedule-head"><span>HORÁRIO</span><span>ATENDIMENTO</span><span>STATUS</span></div>{Array.from({ length: 24 }, (_, i) => { const mins = 8 * 60 + i * 30; const time = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`; const a = visibleAppointments.find((item) => item.time === time); return <div key={time} className={`schedule-slot ${a ? "occupied" : ""}`}><span className="slot-time">{time}</span>{a ? <><div className="slot-client"><strong>{a.name}</strong><small>{a.service} · {a.duration} min</small></div><span className={`status-pill ${a.status === "Concluído" ? "status-complete" : a.status === "Aguardando" ? "status-waiting" : "status-confirmed"}`}>{a.status}</span></> : <><button className="slot-free" onClick={onBook}><Plus size={14} /> Horário livre</button><span className="free-label">Disponível</span></>}</div>; })}</section><aside className="panel day-summary"><h3>Resumo do dia</h3><div className="summary-big">{visibleAppointments.length}<span> atendimentos</span></div><div className="summary-line"><span>Concluídos</span><strong>{visibleAppointments.filter((a) => a.status === "Concluído").length}</strong></div><div className="summary-line"><span>Confirmados</span><strong>{visibleAppointments.filter((a) => a.status === "Confirmado").length}</strong></div><div className="summary-line"><span>Aguardando</span><strong>{visibleAppointments.filter((a) => a.status === "Aguardando").length}</strong></div><div className="summary-line"><span>Último término estimado</span><strong>{visibleAppointments.length ? visibleAppointments.reduce((latest,a)=>{const [h,m]=a.time.split(":").map(Number);return Math.max(latest,h*60+m+a.duration)},0) ? (()=>{const n=visibleAppointments.reduce((latest,a)=>{const [h,m]=a.time.split(":").map(Number);return Math.max(latest,h*60+m+a.duration)},0);return `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`})() : "—" : "—"}</strong></div></aside></div>
    : <div className="panel month-agenda-grid">{dayRows.map((day) => {const date = new Date(`${day}T12:00:00`);const dayItems=visibleAppointments.filter(a=>(a.date??dateKey(new Date()))===day);return <section className="month-agenda-day" key={day}><button className="month-agenda-day-title" onClick={()=>{setSelectedDate(day);setView("Dia")}}><strong>{date.toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit"})}</strong><span>{dayItems.length} atendimento(s)</span></button>{dayItems.length ? dayItems.map(a=><div className="month-agenda-item" key={a.id}><time>{a.time}</time><span>{a.name}</span><small>{a.service}</small></div>) : <p className="month-agenda-empty">Sem atendimentos</p>}</section>})}<style>{`.month-agenda-grid{padding:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}.month-agenda-day{border:1px solid var(--border,#e2e8f0);border-radius:12px;overflow:hidden;min-width:0}.month-agenda-day-title{width:100%;display:flex;justify-content:space-between;gap:8px;padding:12px;background:var(--surface-soft,#f7f8fa);border:0;text-align:left;cursor:pointer}.month-agenda-day-title span{font-size:12px;color:var(--muted,#718096)}.month-agenda-item{display:grid;grid-template-columns:48px 1fr;gap:4px 8px;padding:9px 12px;border-top:1px solid var(--border,#e2e8f0);font-size:13px}.month-agenda-item time{grid-row:span 2;font-weight:700}.month-agenda-item small{color:var(--muted,#718096)}.month-agenda-empty{padding:0 12px;font-size:12px;color:var(--muted,#718096)}`}</style></div>}
  </>;
}

function Appointments({ appointments, search, setSearch, onBook, setAppointments }: { appointments: Appointment[]; search: string; setSearch: (v: string) => void; onBook: () => void; setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>> }) {
  return <><PageHeading eyebrow="GESTÃO DE ATENDIMENTOS" title="Agendamentos" description="Consulte, acompanhe e atualize os atendimentos." action={<button className="button button-primary" onClick={onBook}><Plus size={17} /> Nova reserva</button>} /><div className="panel table-panel"><div className="table-toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, telefone ou serviço..." /></div><button className="button button-secondary button-small"><SlidersHorizontal size={15} /> Filtros</button></div><div className="table-scroll"><table><thead><tr><th>CLIENTE</th><th>DATA / HORA</th><th>SERVIÇOS</th><th>DURAÇÃO</th><th>VALOR</th><th>STATUS</th><th>AÇÃO</th></tr></thead><tbody>{appointments.map((a) => <tr key={a.id}><td><strong>{a.name}</strong><small className="table-subtext">{a.phone}</small></td><td>27/10/2026 <small className="table-subtext">{a.time}</small></td><td>{a.service}</td><td>{a.duration} min</td><td>R$ {a.price},00</td><td><span className={`status-pill ${a.status === "Concluído" ? "status-complete" : a.status === "Aguardando" ? "status-waiting" : "status-confirmed"}`}>{a.status}</span></td><td><select className="status-select" aria-label={`Alterar status de ${a.name}`} value={a.status} onChange={(e) => setAppointments((current) => current.map((item) => item.id === a.id ? { ...item, status: e.target.value as Appointment["status"] } : item))}><option>Confirmado</option><option>Aguardando</option><option>Concluído</option></select></td></tr>)}</tbody></table>{appointments.length === 0 && <div className="empty-state"><Search size={24} /><strong>Nenhum agendamento encontrado</strong><span>Tente ajustar a busca.</span></div>}</div><div className="table-foot">Exibindo {appointments.length} atendimentos · dados demonstrativos</div></div></>;
}

function Clients({ appointments, search, setSearch }: { appointments: Appointment[]; search: string; setSearch: (v: string) => void }) {
  const clients = Array.from(new Map(appointments.map((a) => [a.phone, { name: a.name, phone: a.phone, visits: appointments.filter((x) => x.phone === a.phone).length, last: a.time }])).values()).filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageHeading eyebrow="RELACIONAMENTO" title="Clientes" description="Cadastro, contatos e histórico de atendimentos." action={<button className="button button-primary" onClick={() => window.alert("Cadastro persistente de clientes será ligado ao Supabase na próxima etapa.")}><Plus size={17} /> Novo cliente</button>} /><div className="panel table-panel"><div className="table-toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou telefone..." /></div><span className="subtle-count">{clients.length} clientes</span></div><div className="table-scroll"><table><thead><tr><th>CLIENTE</th><th>TELEFONE</th><th>ATENDIMENTOS</th><th>ÚLTIMO HORÁRIO</th><th>HISTÓRICO</th></tr></thead><tbody>{clients.map((c) => <tr key={c.phone}><td><div className="client-cell"><div className="person-avatar">{c.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}</div><strong>{c.name}</strong></div></td><td>{c.phone}</td><td>{c.visits}</td><td>Hoje · {c.last}</td><td><button className="text-action" onClick={() => window.alert(appointments.filter((a) => a.phone === c.phone).map((a) => `${a.time} — ${a.service} — R$ ${a.price}`).join("\n"))}>Ver histórico <ArrowUpRight size={14} /></button></td></tr>)}</tbody></table></div></div></>;
}

function Services() {
  type ServiceItem = { name: string; duration: number; price: number; active: boolean };
  const defaultServices: ServiceItem[] = [
    { name: "Corte de cabelo", duration: 30, price: 35, active: true },
    { name: "Corte infantil", duration: 30, price: 35, active: true },
    { name: "Barba", duration: 30, price: 35, active: true },
    { name: "Prótese capilar", duration: 60, price: 120, active: true },
    { name: "Manutenção de prótese", duration: 30, price: 60, active: true },
  ];
  const [items, setItems] = useState<ServiceItem[]>(() => {
    try {
      const saved = localStorage.getItem("barbearia-services-v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return defaultServices;
  });
  const [editing, setEditing] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ServiceItem>({ name: "", duration: 30, price: 0, active: true });
  const [feedback, setFeedback] = useState("");
  const persist = (next: ServiceItem[]) => {
    setItems(next);
    localStorage.setItem("barbearia-services-v1", JSON.stringify(next));
  };
  const openNew = () => {
    setEditing(null);
    setForm({ name: "", duration: 30, price: 0, active: true });
    setShowForm(true);
  };
  const openEdit = (index: number) => {
    setEditing(index);
    setForm({ ...items[index] });
    setShowForm(true);
  };
  const save = () => {
    if (!form.name.trim()) { setFeedback("Informe o nome do serviço."); return; }
    if (!Number.isFinite(form.price) || form.price < 0) { setFeedback("Informe um preço válido."); return; }
    if (!Number.isFinite(form.duration) || form.duration < 5) { setFeedback("A duração mínima é de 5 minutos."); return; }
    const normalized = { ...form, name: form.name.trim(), price: Math.round(form.price * 100) / 100 };
    const next = editing === null ? [...items, normalized] : items.map((item, index) => index === editing ? normalized : item);
    persist(next);
    setShowForm(false);
    setFeedback(editing === null ? "Serviço cadastrado neste navegador." : "Serviço atualizado neste navegador.");
  };
  const remove = (index: number) => {
    if (!window.confirm(`Excluir o serviço "${items[index].name}"?`)) return;
    persist(items.filter((_, itemIndex) => itemIndex !== index));
    setFeedback("Serviço excluído.");
  };
  return <>
    <PageHeading eyebrow="CATÁLOGO" title="Serviços" description="Edite preços, duração e disponibilidade dos serviços." action={<button className="button button-primary" onClick={openNew}><Plus size={17} /> Novo serviço</button>} />
    {feedback && <div className="info-banner"><Check size={17} /><p>{feedback}</p><button className="text-action" onClick={() => setFeedback("")}>Fechar</button></div>}
    <div className="service-grid">{items.map((s, index) => <article className="service-card" key={`${s.name}-${index}`}><div className="service-icon"><Scissors size={20} /></div><h3>{s.name}</h3><div className="service-price">{s.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div><div className="service-meta"><span><Clock3 size={15} /> {s.duration} minutos</span><span><CalendarDays size={15} /> Conforme agenda</span></div><div className="service-card-footer"><span className="service-active" style={{ opacity: s.active ? 1 : 0.55 }}><i /> {s.active ? "Ativo" : "Inativo"}</span><div style={{ display: "flex", gap: 8 }}><button className="button button-secondary button-small" onClick={() => openEdit(index)}>Editar</button><button className="button button-secondary button-small" onClick={() => remove(index)} aria-label={`Excluir ${s.name}`}><Trash2 size={14} /></button></div></div></article>)}</div>
    {items.length === 0 && <div className="empty-state"><Scissors size={24} /><strong>Nenhum serviço cadastrado</strong><span>Use “Novo serviço” para adicionar o primeiro.</span></div>}
    {showForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}><section className="booking-modal service-editor"><div className="modal-heading"><div><span className="eyebrow">CATÁLOGO DE SERVIÇOS</span><h2>{editing === null ? "Novo serviço" : "Editar serviço"}</h2><p>As alterações ficam salvas neste navegador para teste.</p></div><button className="icon-button" onClick={() => setShowForm(false)} aria-label="Fechar"><X size={19} /></button></div><div className="form-grid"><label className="field full-field">Nome do serviço<input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Corte degradê" /></label><label className="field">Duração (minutos)<input type="text" inputMode="numeric" placeholder="Ex.: 30" value={form.duration === 0 ? "" : String(form.duration)} onChange={(e) => { const raw = e.target.value.replace(/\D/g, ""); setForm({ ...form, duration: raw === "" ? 0 : Number(raw) }); }} /></label><label className="field">Preço (R$)<input type="text" inputMode="decimal" placeholder="Ex.: 35,00" value={form.price === 0 ? "" : String(form.price).replace(".", ",")} onChange={(e) => { const raw = e.target.value.replace(/[^\d,\.]/g, "").replace(",", "."); const parsed = Number(raw); setForm({ ...form, price: raw === "" ? 0 : Number.isFinite(parsed) ? parsed : form.price }); }} /></label><label className="field">Disponibilidade<select value={form.active ? "ativo" : "inativo"} onChange={(e) => setForm({ ...form, active: e.target.value === "ativo" })}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label></div><p className="form-note"><CircleAlert size={15} /> Modo demonstração: esses dados são locais e ainda não alteram o Supabase nem o bot do WhatsApp.</p><div className="modal-actions"><button className="button button-secondary" onClick={() => setShowForm(false)}>Cancelar</button><button className="button button-primary" onClick={save}><Check size={16} /> Salvar serviço</button></div></section></div>}
  </>;
}

function Blacklist({ blocked, setBlocked, form, setForm, showNotice }: { blocked: { name: string; phone: string; reason: string; date: string }[]; setBlocked: React.Dispatch<React.SetStateAction<{ name: string; phone: string; reason: string; date: string }[]>>; form: { name: string; phone: string; reason: string }; setForm: React.Dispatch<React.SetStateAction<{ name: string; phone: string; reason: string }>>; showNotice: (message: string) => void }) {
  return <><PageHeading eyebrow="CONTROLE DE ACESSO" title="Blacklist" description="Gerencie contatos bloqueados para novas reservas." /><div className="blacklist-layout"><section className="panel block-form"><div className="panel-heading"><div><h3>Adicionar bloqueio</h3><p>O telefone é obrigatório para identificar o contato.</p></div><span className="metric-icon gold"><ShieldCheck size={18} /></span></div><label className="field">Nome do cliente<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome (opcional)" /></label><label className="field">Telefone / WhatsApp *<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(31) 99999-9999" /></label><label className="field">Motivo do bloqueio<textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Descreva o motivo (opcional)" rows={3} /></label><button className="button button-primary full-button" onClick={() => { const phone = form.phone.replace(/\D/g, ""); if (phone.length < 10) { showNotice("Informe um telefone válido."); return; } if (blocked.some((b) => b.phone.replace(/\D/g, "") === phone)) { showNotice("Este telefone já está bloqueado."); return; } setBlocked((current) => [...current, { name: form.name.trim() || "Sem nome", phone: form.phone, reason: form.reason.trim() || "Não informado", date: new Date().toLocaleDateString("pt-BR") }]); setForm({ name: "", phone: "", reason: "" }); showNotice("Contato adicionado à blacklist local."); }}><Ban size={16} /> Bloquear contato</button><p className="form-note"><CircleAlert size={15} /> Protótipo: o bloqueio vale apenas nesta sessão e não protege webhooks até a validação no servidor.</p></section><section className="panel blacklist-list"><div className="panel-heading"><div><h3>Contatos bloqueados</h3><p>Lista de telefones impedidos de reservar</p></div><span className="count-badge">{blocked.length}</span></div>{blocked.length ? <div className="blocked-table">{blocked.map((b) => <div className="blocked-row" key={b.phone}><div className="person-avatar blocked-avatar"><Ban size={16} /></div><div className="blocked-info"><strong>{b.name}</strong><span>{b.phone}</span><small>Motivo: {b.reason}</small></div><div className="blocked-actions"><small>{b.date}</small><button className="button button-danger-soft button-small" onClick={() => { setBlocked((current) => current.filter((x) => x.phone !== b.phone)); showNotice("Contato removido da blacklist local."); }}>Desbloquear</button></div></div>)}</div> : <div className="empty-state"><ShieldCheck size={25} /><strong>Nenhum contato bloqueado</strong><span>Os contatos adicionados aparecerão aqui.</span></div>}</section></div></>;
}

function Settings({ tvNameFormat, setTvNameFormat, workDays, setWorkDays, vacationStart, setVacationStart, vacationEnd, setVacationEnd, vacations, setVacations, showNotice }: { tvNameFormat: string; setTvNameFormat: (v: string) => void; workDays: string[]; setWorkDays: (v: string[]) => void; vacationStart: string; setVacationStart: (v: string) => void; vacationEnd: string; setVacationEnd: (v: string) => void; vacations: { start: string; end: string }[]; setVacations: (v: (current: { start: string; end: string }[]) => { start: string; end: string }[]) => void; showNotice: (message: string) => void }) {
  const days = [{ key: "Dom", label: "Domingo" }, { key: "Seg", label: "Segunda" }, { key: "Ter", label: "Terça" }, { key: "Qua", label: "Quarta" }, { key: "Qui", label: "Quinta" }, { key: "Sex", label: "Sexta" }, { key: "Sáb", label: "Sábado" }];
  const [openingTime, setOpeningTime] = useState(() => localStorage.getItem("barbearia-opening-time") || "08:00");
  const [closingTime, setClosingTime] = useState(() => localStorage.getItem("barbearia-closing-time") || "20:00");
  const [breakStart, setBreakStart] = useState(() => localStorage.getItem("barbearia-break-start") || "12:00");
  const [breakEnd, setBreakEnd] = useState(() => localStorage.getItem("barbearia-break-end") || "13:00");
  const [slotDuration, setSlotDuration] = useState(() => localStorage.getItem("barbearia-slot-duration") || "30");
  const [absenceMessage, setAbsenceMessage] = useState(() => localStorage.getItem("barbearia-absence-message") || "Olá! Estarei de férias de {inicio} a {fim}. Retorno aos atendimentos logo em seguida. Antecipe seu agendamento!");
  const formatDate = (value: string) => value ? new Date(value + "T12:00:00").toLocaleDateString("pt-BR") : "";
  const previewVacation = vacations[0];
  const previewMessage = absenceMessage.replaceAll("{inicio}", formatDate(previewVacation?.start || vacationStart || "2026-01-01")).replaceAll("{fim}", formatDate(previewVacation?.end || vacationEnd || "2026-01-01"));
  const addVacation = () => { if (!vacationStart || !vacationEnd) { showNotice("Informe a data inicial e a data final das férias."); return; } if (vacationEnd < vacationStart) { showNotice("A data final das férias precisa ser igual ou posterior à inicial."); return; } setVacations((current) => current.some((v) => v.start === vacationStart && v.end === vacationEnd) ? current : [...current, { start: vacationStart, end: vacationEnd }].sort((a, b) => a.start.localeCompare(b.start))); setVacationStart(""); setVacationEnd(""); showNotice("Férias cadastradas — a agenda fica bloqueada nesse período"); };
  const saveHours = () => { const toMinutes = (v: string) => { const parts = v.split(":").map(Number); return parts[0] * 60 + parts[1]; }; if (toMinutes(openingTime) >= toMinutes(closingTime)) { showNotice("O fim do expediente precisa ser depois do início."); return; } if (toMinutes(breakStart) >= toMinutes(breakEnd) || toMinutes(breakStart) < toMinutes(openingTime) || toMinutes(breakEnd) > toMinutes(closingTime)) { showNotice("Confira o intervalo de almoço."); return; } localStorage.setItem("barbearia-opening-time", openingTime); localStorage.setItem("barbearia-closing-time", closingTime); localStorage.setItem("barbearia-break-start", breakStart); localStorage.setItem("barbearia-break-end", breakEnd); localStorage.setItem("barbearia-slot-duration", slotDuration); localStorage.setItem("barbearia-absence-message", absenceMessage); showNotice("Preferências salvas neste navegador."); };
  return <><PageHeading eyebrow="PREFERÊNCIAS DA OPERAÇÃO" title="Configurações" description="Personalize expediente, folgas e experiência da TV." /><div className="settings-grid">
    <section className="panel settings-card"><div className="settings-title"><div className="settings-icon"><Clock3 size={19} /></div><div><h3>Horários</h3><p>Defina expediente, intervalo e duração dos horários.</p></div></div><label className="field">Início do expediente<input type="time" value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} /></label><label className="field">Fim do expediente<input type="time" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} /></label><div className="settings-subtitle">Intervalo de almoço</div><div className="settings-time-grid"><label className="field">Início<input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} /></label><label className="field">Fim<input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} /></label></div><label className="field">Duração de cada horário<select value={slotDuration} onChange={(e) => setSlotDuration(e.target.value)}><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60">60 minutos</option></select></label></section>
    <section className="panel settings-card"><div className="settings-title"><div className="settings-icon"><CalendarDays size={19} /></div><div><h3>Dias de Trabalho e Folgas</h3><p>Toque para alternar entre trabalho e folga.</p></div></div><div className="settings-week-grid">{days.map((day) => { const working = workDays.includes(day.key); return <button type="button" key={day.key} className={"settings-day-button " + (working ? "is-working" : "is-off")} onClick={() => setWorkDays(working ? workDays.filter((d) => d !== day.key) : [...workDays, day.key])}><strong>{day.label}</strong><span>{working ? "Trabalho" : "Folga"}</span></button>; })}</div></section>
    <section className="panel settings-card"><div className="settings-title"><div className="settings-icon"><CalendarDays size={19} /></div><div><h3>Férias e Mensagem Automática</h3><p>Bloqueie a agenda durante o período de férias.</p></div></div><div className="settings-time-grid"><label className="field">Data de início<input type="date" value={vacationStart} onChange={(e) => setVacationStart(e.target.value)} /></label><label className="field">Data de término<input type="date" min={vacationStart || undefined} value={vacationEnd} onChange={(e) => setVacationEnd(e.target.value)} /></label></div><button type="button" className="button button-primary" onClick={addVacation}><Plus size={16} /> Adicionar férias</button><div className="vacation-list">{vacations.length ? vacations.slice().sort((a, b) => a.start.localeCompare(b.start)).map((v) => <div className="setting-row" key={v.start + "-" + v.end}><span>{formatDate(v.start)} até {formatDate(v.end)}</span><button aria-label="Excluir período de férias" className="button button-danger-soft button-small" onClick={() => { setVacations((current) => current.filter((item) => item.start !== v.start || item.end !== v.end)); showNotice("Período de férias removido."); }}><Trash2 size={15} /></button></div>) : <div className="settings-empty">Nenhuma férias cadastrada.</div>}</div><label className="field">Mensagem automática de ausência<textarea rows={4} maxLength={400} value={absenceMessage} onChange={(e) => setAbsenceMessage(e.target.value)} /><small>{absenceMessage.length}/400 caracteres</small></label><div className="settings-message-preview"><strong>Prévia da mensagem</strong><p>{previewMessage}</p></div></section>
    <section className="panel settings-card"><div className="settings-title"><div className="settings-icon"><Monitor size={19} /></div><div><h3>Visualização na TV</h3><p>Defina como os clientes serão identificados na fila.</p></div></div><label className="field">Informação do cliente<select value={tvNameFormat} onChange={(e) => setTvNameFormat(e.target.value)}><option>Primeiro nome</option><option>Nome e sobrenome</option><option>Iniciais</option><option>Nome - Serviços</option></select></label><div className="tv-preview"><div className="tv-preview-head"><Monitor size={15} /> PRÉVIA DO LOUNGE DISPLAY</div><strong>{tvNameFormat === "Primeiro nome" ? "Pablo" : tvNameFormat === "Iniciais" ? "PS" : tvNameFormat === "Nome - Serviços" ? "Pablo - Corte + Barba" : "Pablo Santos"}</strong><span>Em atendimento · cadeira 01</span></div><button className="button button-primary full-button" onClick={saveHours}><Check size={16} /> Salvar preferências</button></section>
  </div><div className="info-banner"><CircleAlert size={17} /><p>Estas preferências ficam salvas neste navegador. Para bloquear também o bot do WhatsApp, o webhook precisa consultar essas configurações no backend.</p></div><style>{`.settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:18px}.settings-card{padding:22px;display:flex;flex-direction:column;gap:16px}.settings-title{display:flex;gap:12px;align-items:center}.settings-title h3{margin:0;font-size:16px}.settings-title p{margin:4px 0 0;color:var(--muted,#718096);font-size:13px}.settings-icon{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:var(--surface-soft,#f3f5f7)}.settings-subtitle{font-size:13px;font-weight:600}.settings-time-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.settings-week-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:10px}.settings-day-button{border:1px solid var(--border,#dce2e8);border-radius:12px;padding:12px 10px;display:flex;flex-direction:column;gap:6px;text-align:left;background:var(--surface,#fff);cursor:pointer}.settings-day-button span{font-size:12px}.settings-day-button.is-working{border-color:#69b68b;background:#effaf3;color:#17653b}.settings-day-button.is-off{color:var(--muted,#718096)}.settings-empty{padding:14px;border:1px dashed var(--border,#dce2e8);border-radius:10px;color:var(--muted,#718096);font-size:13px}.settings-message-preview{padding:14px;border-radius:12px;background:var(--surface-soft,#f3f5f7)}.settings-message-preview p{margin:8px 0 0;white-space:pre-wrap}.settings-card .field{display:flex;flex-direction:column;gap:7px}.settings-card input,.settings-card select,.settings-card textarea{width:100%;box-sizing:border-box}@media(max-width:480px){.settings-time-grid{grid-template-columns:1fr}.settings-card{padding:16px}}`}</style></>;
}