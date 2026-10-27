import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleAlert, Clock3, Scissors, Search, Settings2, ShieldCheck, Sparkles,
  Users, Wallet, Plus, MoreHorizontal, LayoutDashboard, Monitor, SlidersHorizontal,
  Menu, X, ArrowUpRight, Bell, CalendarPlus, UserRound, Ban, BriefcaseBusiness,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: Index });

type Section = "Início" | "Agenda" | "Agendamentos" | "Clientes" | "Serviços" | "Blacklist" | "Configurações";
type Appointment = {
  id: number; name: string; phone: string; service: string; time: string;
  duration: number; status: "Confirmado" | "Aguardando" | "Concluído"; price: number;
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
  { name: "Corte de cabelo", duration: 30, price: 35, category: "Cabelo" },
  { name: "Corte infantil", duration: 30, price: 35, category: "Cabelo" },
  { name: "Barba", duration: 30, price: 35, category: "Barba" },
  { name: "Prótese capilar", duration: 60, price: 120, category: "Especial" },
  { name: "Manutenção de prótese", duration: 30, price: 60, category: "Especial" },
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
    const [hour, minute] = booking.time.split(":").map(Number);
    const startMinute = hour * 60 + minute;
    const endMinute = startMinute + totalDuration;
    const end = `${String(Math.floor(endMinute / 60)).padStart(2, "0")}:${String(endMinute % 60).padStart(2, "0")}`;
    const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const bookingWeekday = weekdayLabels[new Date(`${booking.date}T12:00:00`).getDay()];
    if (vacations.some((period) => booking.date >= period.start && booking.date <= period.end)) { showNotice("A barbearia estará fechada durante o período de férias cadastrado."); return; }
    if (!workDays.includes(bookingWeekday)) { showNotice(`A barbearia não atende às ${bookingWeekday}.`); return; }
    if (minute % 30 !== 0) { showNotice("Escolha um horário em intervalos de 30 minutos."); return; }
    if (startMinute < 8 * 60 || endMinute > 20 * 60) { showNotice("O atendimento precisa acontecer entre 08:00 e 20:00."); return; }
    if (startMinute < 13 * 60 && endMinute > 12 * 60) { showNotice("O atendimento não pode atravessar o intervalo de almoço (12:00–13:00)."); return; }
    const overlaps = appointments.some((a) => {
      const [h, m] = a.time.split(":").map(Number);
      const start = h * 60 + m;
      return (a.date ?? "2026-10-27") === booking.date && start < endMinute && start + a.duration > startMinute;
    });
    if (overlaps) {
      showNotice("Conflito de horário: este intervalo já possui uma reserva.");
      return;
    }
    setAppointments((current) => [...current, {
      id: Math.max(0, ...current.map((a) => a.id)) + 1, name: booking.name.trim(),
      phone: booking.phone, service: serviceLabel, time: booking.time,
      duration: totalDuration, status: "Confirmado", price: totalPrice,
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
      const [h, m] = a.time.split(":").map(Number);
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
  const [view, setView] = useState("Dia");
  const [showAdjust, setShowAdjust] = useState(false);
  return <><PageHeading eyebrow="PLANEJAMENTO OPERACIONAL" title="Agenda" description="Visualize os horários e acompanhe o fluxo de atendimentos." action={<button className="button button-primary" onClick={onBook}><Plus size={17} /> Nova reserva</button>} />
    <div className="toolbar"><div className="date-navigator"><button className="icon-button" aria-label="Dia anterior"><ChevronLeft size={17} /></button><strong>Terça, 27 de outubro</strong><button className="icon-button" aria-label="Próximo dia"><ChevronRight size={17} /></button><button className="button button-secondary button-small">Hoje</button></div><div className="toolbar-actions"><div className="segmented">{["Dia", "Semana"].map((v) => <button key={v} className={view === v ? "selected" : ""} onClick={() => setView(v)}>{v}</button>)}</div><button className="button button-secondary button-small" onClick={() => setShowAdjust(!showAdjust)}><SlidersHorizontal size={15} /> Ajustar horários</button></div></div>
    {showAdjust && <section className="panel adjust-panel"><div><h3>Ajuste de fluxo do dia</h3><p>Simule o atraso ou adiantamento dos atendimentos a partir de um horário.</p></div><div className="adjust-fields"><label className="field">A partir das<select value={delayFrom} onChange={(e) => setDelayFrom(e.target.value)}>{appointments.map((a) => <option key={a.id}>{a.time}</option>)}</select></label><label className="field">Ajuste (minutos)<input type="number" min="30" step="30" value={delay} onChange={(e) => setDelay(e.target.value)} /></label><button className="button button-primary" onClick={applyDelay}>Aplicar simulação</button></div><p className="form-note"><CircleAlert size={15} /> Protótipo local: a simulação altera apenas os dados desta sessão; ainda não existe persistência nem desfazer.</p></section>}
    <div className="schedule-layout"><section className="panel schedule-panel"><div className="schedule-head"><span>HORÁRIO</span><span>ATENDIMENTO</span><span>STATUS</span></div>{Array.from({ length: 22 }, (_, i) => { const mins = 8 * 60 + i * 30; const time = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`; const a = appointments.find((item) => item.time === time); return <div key={time} className={`schedule-slot ${a ? "occupied" : ""}`}><span className="slot-time">{time}</span>{a ? <><div className="slot-client"><strong>{a.name}</strong><small>{a.service} · {a.duration} min</small></div><span className={`status-pill ${a.status === "Concluído" ? "status-complete" : a.status === "Aguardando" ? "status-waiting" : "status-confirmed"}`}>{a.status}</span></> : <><button className="slot-free" onClick={onBook}><Plus size={14} /> Horário livre</button><span className="free-label">Disponível</span></>}</div>; })}</section><aside className="panel day-summary"><h3>Resumo do dia</h3><div className="summary-big">{appointments.length}<span> atendimentos</span></div><div className="summary-line"><span>Concluídos</span><strong>{appointments.filter((a) => a.status === "Concluído").length}</strong></div><div className="summary-line"><span>Confirmados</span><strong>{appointments.filter((a) => a.status === "Confirmado").length}</strong></div><div className="summary-line"><span>Aguardando</span><strong>{appointments.filter((a) => a.status === "Aguardando").length}</strong></div><div className="summary-line"><span>Último término estimado</span><strong>{appointments.length ? "15:30" : "—"}</strong></div></aside></div>
  </>;
}

function Appointments({ appointments, search, setSearch, onBook, setAppointments }: { appointments: Appointment[]; search: string; setSearch: (v: string) => void; onBook: () => void; setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>> }) {
  return <><PageHeading eyebrow="GESTÃO DE ATENDIMENTOS" title="Agendamentos" description="Consulte, acompanhe e atualize os atendimentos." action={<button className="button button-primary" onClick={onBook}><Plus size={17} /> Nova reserva</button>} /><div className="panel table-panel"><div className="table-toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, telefone ou serviço..." /></div><button className="button button-secondary button-small"><SlidersHorizontal size={15} /> Filtros</button></div><div className="table-scroll"><table><thead><tr><th>CLIENTE</th><th>DATA / HORA</th><th>SERVIÇOS</th><th>DURAÇÃO</th><th>VALOR</th><th>STATUS</th><th>AÇÃO</th></tr></thead><tbody>{appointments.map((a) => <tr key={a.id}><td><strong>{a.name}</strong><small className="table-subtext">{a.phone}</small></td><td>27/10/2026 <small className="table-subtext">{a.time}</small></td><td>{a.service}</td><td>{a.duration} min</td><td>R$ {a.price},00</td><td><span className={`status-pill ${a.status === "Concluído" ? "status-complete" : a.status === "Aguardando" ? "status-waiting" : "status-confirmed"}`}>{a.status}</span></td><td><select className="status-select" aria-label={`Alterar status de ${a.name}`} value={a.status} onChange={(e) => setAppointments((current) => current.map((item) => item.id === a.id ? { ...item, status: e.target.value as Appointment["status"] } : item))}><option>Confirmado</option><option>Aguardando</option><option>Concluído</option></select></td></tr>)}</tbody></table>{appointments.length === 0 && <div className="empty-state"><Search size={24} /><strong>Nenhum agendamento encontrado</strong><span>Tente ajustar a busca.</span></div>}</div><div className="table-foot">Exibindo {appointments.length} atendimentos · dados demonstrativos</div></div></>;
}

function Clients({ appointments, search, setSearch }: { appointments: Appointment[]; search: string; setSearch: (v: string) => void }) {
  const clients = Array.from(new Map(appointments.map((a) => [a.phone, { name: a.name, phone: a.phone, visits: appointments.filter((x) => x.phone === a.phone).length, last: a.time }])).values()).filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageHeading eyebrow="RELACIONAMENTO" title="Clientes" description="Cadastro, contatos e histórico de atendimentos." action={<button className="button button-primary" onClick={() => window.alert("Cadastro persistente de clientes será ligado ao Supabase na próxima etapa.")}><Plus size={17} /> Novo cliente</button>} /><div className="panel table-panel"><div className="table-toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou telefone..." /></div><span className="subtle-count">{clients.length} clientes</span></div><div className="table-scroll"><table><thead><tr><th>CLIENTE</th><th>TELEFONE</th><th>ATENDIMENTOS</th><th>ÚLTIMO HORÁRIO</th><th>HISTÓRICO</th></tr></thead><tbody>{clients.map((c) => <tr key={c.phone}><td><div className="client-cell"><div className="person-avatar">{c.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}</div><strong>{c.name}</strong></div></td><td>{c.phone}</td><td>{c.visits}</td><td>Hoje · {c.last}</td><td><button className="text-action" onClick={() => window.alert(appointments.filter((a) => a.phone === c.phone).map((a) => `${a.time} — ${a.service} — R$ ${a.price}`).join("
"))}>Ver histórico <ArrowUpRight size={14} /></button></td></tr>)}</tbody></table></div></div></>;
}

function Services() {
  return <><PageHeading eyebrow="CATÁLOGO" title="Serviços" description="Preços, duração e disponibilidade por serviço." action={<button className="button button-primary" onClick={() => window.alert("O cadastro de serviços será integrado ao Supabase existente na próxima etapa.")}><Plus size={17} /> Novo serviço</button>} /><div className="service-grid">{services.map((s) => <article className="service-card" key={s.name}><div className="service-icon"><Scissors size={20} /></div><span className="service-category">{s.category}</span><h3>{s.name}</h3><div className="service-price">R$ {s.price},00</div><div className="service-meta"><span><Clock3 size={15} /> {s.duration} minutos</span><span><CalendarDays size={15} /> Conforme agenda</span></div><div className="service-card-footer"><span className="service-active"><i /> Ativo</span><button className="button button-secondary button-small" onClick={() => window.alert("A edição será habilitada junto à persistência dos serviços.")}>Editar</button></div></article>)}</div><div className="info-banner"><CircleAlert size={17} /><p>Os serviços exibidos são exemplos para visualizar a interface. Preços, regras de disponibilidade e duração serão lidos do Supabase existente quando a integração for configurada.</p></div></>;
}

function Blacklist({ blocked, setBlocked, form, setForm, showNotice }: { blocked: { name: string; phone: string; reason: string; date: string }[]; setBlocked: React.Dispatch<React.SetStateAction<{ name: string; phone: string; reason: string; date: string }[]>>; form: { name: string; phone: string; reason: string }; setForm: React.Dispatch<React.SetStateAction<{ name: string; phone: string; reason: string }>>; showNotice: (message: string) => void }) {
  return <><PageHeading eyebrow="CONTROLE DE ACESSO" title="Blacklist" description="Gerencie contatos bloqueados para novas reservas." /><div className="blacklist-layout"><section className="panel block-form"><div className="panel-heading"><div><h3>Adicionar bloqueio</h3><p>O telefone é obrigatório para identificar o contato.</p></div><span className="metric-icon gold"><ShieldCheck size={18} /></span></div><label className="field">Nome do cliente<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome (opcional)" /></label><label className="field">Telefone / WhatsApp *<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(31) 99999-9999" /></label><label className="field">Motivo do bloqueio<textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Descreva o motivo (opcional)" rows={3} /></label><button className="button button-primary full-button" onClick={() => { const phone = form.phone.replace(/\D/g, ""); if (phone.length < 10) { showNotice("Informe um telefone válido."); return; } if (blocked.some((b) => b.phone.replace(/\D/g, "") === phone)) { showNotice("Este telefone já está bloqueado."); return; } setBlocked((current) => [...current, { name: form.name.trim() || "Sem nome", phone: form.phone, reason: form.reason.trim() || "Não informado", date: new Date().toLocaleDateString("pt-BR") }]); setForm({ name: "", phone: "", reason: "" }); showNotice("Contato adicionado à blacklist local."); }}><Ban size={16} /> Bloquear contato</button><p className="form-note"><CircleAlert size={15} /> Protótipo: o bloqueio vale apenas nesta sessão e não protege webhooks até a validação no servidor.</p></section><section className="panel blacklist-list"><div className="panel-heading"><div><h3>Contatos bloqueados</h3><p>Lista de telefones impedidos de reservar</p></div><span className="count-badge">{blocked.length}</span></div>{blocked.length ? <div className="blocked-table">{blocked.map((b) => <div className="blocked-row" key={b.phone}><div className="person-avatar blocked-avatar"><Ban size={16} /></div><div className="blocked-info"><strong>{b.name}</strong><span>{b.phone}</span><small>Motivo: {b.reason}</small></div><div className="blocked-actions"><small>{b.date}</small><button className="button button-danger-soft button-small" onClick={() => { setBlocked((current) => current.filter((x) => x.phone !== b.phone)); showNotice("Contato removido da blacklist local."); }}>Desbloquear</button></div></div>)}</div> : <div className="empty-state"><ShieldCheck size={25} /><strong>Nenhum contato bloqueado</strong><span>Os contatos adicionados aparecerão aqui.</span></div>}</section></div></>;
}

function Settings({ tvNameFormat, setTvNameFormat, workDays, setWorkDays, vacationStart, setVacationStart, vacationEnd, setVacationEnd, vacations, setVacations, showNotice }: { tvNameFormat: string; setTvNameFormat: (v: string) => void; workDays: string[]; setWorkDays: (v: string[]) => void; vacationStart: string; setVacationStart: (v: string) => void; vacationEnd: string; setVacationEnd: (v: string) => void; vacations: { start: string; end: string }[]; setVacations: (v: (current: { start: string; end: string }[]) => { start: string; end: string }[]) => void; showNotice: (message: string) => void }) {
  const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  return <><PageHeading eyebrow="PREFERÊNCIAS DA OPERAÇÃO" title="Configurações" description="Personalize expediente, recesso e experiência da TV." /><div className="settings-grid"><section className="panel settings-card"><div className="settings-title"><div className="settings-icon"><Clock3 size={19} /></div><div><h3>Expediente e folgas</h3><p>Defina os dias regulares de atendimento.</p></div></div><span className="field-label">DIAS DE TRABALHO</span><div className="days-picker">{days.map((day) => <button key={day} className={workDays.includes(day) ? "day-selected" : ""} onClick={() => setWorkDays(workDays.includes(day) ? workDays.filter((d) => d !== day) : [...workDays, day])}>{day}</button>)}</div><div className="setting-row"><label>Início do expediente</label><input type="time" defaultValue="08:00" /></div><div className="setting-row"><label>Fim do expediente</label><input type="time" defaultValue="20:00" /></div><div className="setting-row"><label>Intervalo de almoço</label><span>12:00 — 13:00</span></div></section><section className="panel settings-card"><div className="settings-title"><div className="settings-icon"><CalendarDays size={19} /></div><div><h3>Férias e recesso</h3><p>Período de indisponibilidade programada.</p></div></div><label className="field">Data de início<input type="date" value={vacationStart} onChange={(e) => setVacationStart(e.target.value)} /></label><label className="field">Data de término<input type="date" value={vacationEnd} onChange={(e) => setVacationEnd(e.target.value)} min={vacationStart || undefined} /></label><label className="field">Mensagem de ausência<textarea rows={3} defaultValue="Estamos em recesso até {fim}. Retornaremos nossos atendimentos em breve!" /></label><div className="vacation-list">{vacations.map((v) => <div className="setting-row" key={`${v.start}-${v.end}`}><span>{v.start} até {v.end}</span><button className="button button-danger-soft button-small" onClick={() => { setVacations((current) => current.filter((item) => item.start !== v.start || item.end !== v.end)); showNotice("Período de férias removido."); }}>Remover</button></div>)}</div></section><section className="panel settings-card"><div className="settings-title"><div className="settings-icon"><Monitor size={19} /></div><div><h3>Visualização na TV</h3><p>Defina como os clientes serão identificados na fila.</p></div></div><label className="field">Informação do cliente<select value={tvNameFormat} onChange={(e) => setTvNameFormat(e.target.value)}><option>Primeiro nome</option><option>Nome e sobrenome</option><option>Iniciais</option><option>Nome - Serviços</option></select></label><div className="tv-preview"><div className="tv-preview-head"><Monitor size={15} /> PRÉVIA DO LOUNGE DISPLAY</div><strong>{tvNameFormat === "Primeiro nome" ? "Pablo" : tvNameFormat === "Iniciais" ? "PS" : tvNameFormat === "Nome - Serviços" ? "Pablo - Corte + Barba" : "Pablo Santos"}</strong><span>Em atendimento · cadeira 01</span></div></section><section className="panel settings-card"><div className="settings-title"><div className="settings-icon"><BriefcaseBusiness size={19} /></div><div><h3>Preferências gerais</h3><p>Opções de experiência e operação.</p></div></div><div className="setting-row"><div><strong>Notificações de reserva</strong><small>Feedback visual ao salvar agendamentos</small></div><span className="toggle-on">Ativo</span></div><div className="setting-row"><div><strong>Passos de horário</strong><small>Intervalos aceitos na agenda</small></div><strong>30 minutos</strong></div><div className="setting-row"><div><strong>Modo de dados</strong><small>Integração ainda não configurada</small></div><span className="mode-badge">Demonstração</span></div><button className="button button-primary full-button" onClick={() => { if (vacationStart && vacationEnd) { if (vacationEnd < vacationStart) { showNotice("A data final das férias precisa ser igual ou posterior à inicial."); return; } setVacations((current) => current.some((v) => v.start === vacationStart && v.end === vacationEnd) ? current : [...current, { start: vacationStart, end: vacationEnd }]); setVacationStart(""); setVacationEnd(""); showNotice("Período de férias cadastrado e sincronizado entre abas."); } else showNotice("Preferências locais salvas e sincronizadas entre abas."); }}><Check size={16} /> Salvar preferências</button></section></div><div className="info-banner"><CircleAlert size={17} /><p>As configurações ainda são locais e demonstrativas. Regras de expediente, férias e bloqueios precisam ser validadas também no backend antes de uso real.</p></div></>;
}
