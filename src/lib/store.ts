import { useSyncExternalStore } from "react";
import { addDays, format } from "date-fns";

/**
 * Client-side demo store. Persists to localStorage and syncs tabs via BroadcastChannel.
 * Shape mirrors the future REST API (bookings/services/settings/tv) so it can be swapped
 * for real API calls + realtime events (n8n -> backend -> TV) later.
 */

export type BookingStatus = "confirmada" | "concluida" | "cancelada" | "ausente";
export type ServiceRule = { id: string; days: number[]; start: string; end: string };
export type Service = { id: string; name: string; duration: number; rules?: ServiceRule[] };
export type Vacation = { id: string; start: string; end: string };
export type BlockedClient = { id: string; phone: string; name?: string | undefined; reason?: string | undefined; createdAt: number };
export type Adjust = { id: string; date: string; fromId: string; minutes: number; ids: string[]; at: number };
export type Booking = {
  id: string;
  client: string;
  phone: string;
  serviceId: string;
  serviceIds?: string[];
  /** minutes of delay (+) or advance (-) applied by agenda adjustments */
  shift?: number | undefined;
  date: string; // yyyy-MM-dd
  start: string; // HH:mm
  status: BookingStatus;
  notes?: string;
  demo?: boolean;
  createdAt: number;
};
export type Settings = {
  shopName: string;
  open: string;
  close: string;
  workDays: number[]; // 0=Dom
  breakStart: string;
  breakEnd: string;
  slot: number;
  showFreeOnTv: boolean;
  tvClientInfo: "first" | "initials" | "none";
  sound: boolean;
  vacations: Vacation[];
  vacationMessage: string;
};
export type TvState = { code: string | null; expires: number; connected: boolean; connectedAt?: number };
export type State = { loaded: boolean; services: Service[]; bookings: Booking[]; settings: Settings; tv: TvState; blacklist: BlockedClient[]; adjusts: Adjust[]; updatedAt: number };
export type TvEvent = { kind: "nova" | "alterada" | "cancelada"; booking: Booking; at: number };

const KEY = "barbearia-snapshot-v1";
const defaultSettings: Settings = {
  shopName: "Navalha & Co.",
  open: "09:00",
  close: "19:00",
  workDays: [1, 2, 3, 4, 5, 6],
  breakStart: "12:00",
  breakEnd: "13:00",
  slot: 30,
  showFreeOnTv: true,
  tvClientInfo: "first",
  sound: false,
  vacations: [],
  vacationMessage: "Olá! Estamos de férias entre {inicio} e {fim}. Voltamos logo — obrigado pela preferência!",
};
const defaultServices: Service[] = [
  { id: "corte", name: "Corte", duration: 30 },
  { id: "barba", name: "Barba", duration: 30 },
  { id: "combo", name: "Corte + Barba", duration: 60 },
  { id: "pigmentacao", name: "Pigmentação", duration: 45 },
];
const empty: State = {
  loaded: false,
  services: defaultServices,
  bookings: [],
  settings: defaultSettings,
  tv: { code: null, expires: 0, connected: false },
  blacklist: [],
  adjusts: [],
  updatedAt: 0,
};

export const uid = () => Math.random().toString(36).slice(2, 10);

function seed(): Booking[] {
  const names = ["Rafael Souza", "Lucas Lima", "Bruno Costa", "Diego Alves", "Thiago Rocha", "Mateus Dias", "André Melo", "Felipe Nunes", "Gustavo Reis", "Caio Martins"];
  const times = ["09:00", "09:30", "10:30", "11:00", "14:00", "15:00", "16:30", "17:30"];
  const svc = ["corte", "barba", "combo", "corte", "pigmentacao", "corte", "combo", "barba"];
  const out: Booking[] = [];
  for (let d = -3; d <= 10; d++) {
    const date = format(addDays(new Date(), d), "yyyy-MM-dd");
    const day = addDays(new Date(), d).getDay();
    if (day === 0) continue;
    const n = d === 0 ? 7 : 2 + ((d * 7 + 11) % 5);
    for (let i = 0; i < n; i++) {
      const status: BookingStatus = d < 0 ? (i % 5 === 3 ? "ausente" : "concluida") : d === 0 && i < 2 ? "concluida" : d === 0 && i === 4 ? "cancelada" : "confirmada";
      out.push({
        id: uid(),
        client: names[(i * 3 + d + 20) % names.length]!,
        phone: `(11) 9${8000 + i * 37}-${1000 + i * 113}`,
        serviceId: svc[i % svc.length]!,
        date,
        start: times[i]!,
        status,
        demo: true,
        createdAt: Date.now(),
      });
    }
  }
  return out;
}

let state: State = empty;
const listeners = new Set<() => void>();
const eventListeners = new Set<(e: TvEvent) => void>();
let channel: BroadcastChannel | null = null;

function init() {
  if (state.loaded || typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    state = parsed ? { ...empty, ...parsed, settings: { ...defaultSettings, ...parsed.settings }, loaded: true } : { ...empty, bookings: seed(), loaded: true, updatedAt: Date.now() };
  } catch {
    state = { ...empty, bookings: seed(), loaded: true };
  }
  persist();
  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel("barbearia");
    channel.onmessage = (m) => {
      if (m.data?.type === "state") {
        state = { ...m.data.state, loaded: true };
        listeners.forEach((l) => l());
      } else if (m.data?.type === "event") {
        eventListeners.forEach((l) => l(m.data.event));
      }
    };
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function setState(fn: (s: State) => Partial<State>, event?: TvEvent) {
  init();
  state = { ...state, ...fn(state), updatedAt: Date.now() };
  persist();
  listeners.forEach((l) => l());
  channel?.postMessage({ type: "state", state });
  if (event) {
    channel?.postMessage({ type: "event", event });
    eventListeners.forEach((l) => l(event));
  }
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => {
      init();
      listeners.add(cb);
      queueMicrotask(cb);
      return () => listeners.delete(cb);
    },
    () => sel(state),
    () => sel(empty),
  );
}

export function onTvEvent(cb: (e: TvEvent) => void) {
  init();
  eventListeners.add(cb);
  return () => {
    eventListeners.delete(cb);
  };
}

// ---------- helpers ----------
export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
export const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export const bookingServiceIds = (b: Pick<Booking, "serviceId" | "serviceIds">) => (b.serviceIds?.length ? b.serviceIds : [b.serviceId]);
export const totalDuration = (ids: string[], services: Service[]) => ids.reduce((t, id) => t + (services.find((s) => s.id === id)?.duration ?? 30), 0);
export const serviceNames = (b: Pick<Booking, "serviceId" | "serviceIds">, services: Service[]) =>
  bookingServiceIds(b).map((id) => services.find((s) => s.id === id)?.name ?? "Serviço").join(" + ");
/** Effective start including delay/advance shift. */
export const startOf = (b: Booking) => toTime(toMin(b.start) + (b.shift ?? 0));
export function endOf(b: Booking, services: Service[]) {
  return toTime(toMin(b.start) + (b.shift ?? 0) + totalDuration(bookingServiceIds(b), services));
}
export const fmtDuration = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`);

export const onVacation = (s: State, date: string) => s.settings.vacations.find((v) => date >= v.start && date <= v.end);
export const vacationText = (s: State, v: Vacation) =>
  s.settings.vacationMessage.replace("{inicio}", v.start.split("-").reverse().join("/")).replace("{fim}", v.end.split("-").reverse().join("/"));
export const digits = (p: string) => p.replace(/\D/g, "");
export const isBlocked = (s: State, phone: string) => {
  const d = digits(phone);
  return d.length >= 8 ? s.blacklist.find((x) => digits(x.phone).endsWith(d.slice(-8)) || d.endsWith(digits(x.phone).slice(-8))) : undefined;
};

export function daySlots(s: State, date: string) {
  const { open, close, slot, breakStart, breakEnd, workDays } = s.settings;
  const day = new Date(date + "T12:00").getDay();
  if (!workDays.includes(day) || onVacation(s, date)) return [];
  const out: string[] = [];
  for (let m = toMin(open); m < toMin(close); m += slot) {
    if (m >= toMin(breakStart) && m < toMin(breakEnd)) continue;
    out.push(toTime(m));
  }
  return out;
}

/** Returns why a service can't run in [a,b) on that weekday, or null if allowed. */
export function serviceRuleBlock(svc: Service | undefined, date: string, a: number, b: number) {
  if (!svc?.rules?.length) return null;
  const day = new Date(date + "T12:00").getDay();
  const ok = svc.rules.some((r) => r.days.includes(day) && a >= toMin(r.start) && b <= toMin(r.end));
  return ok ? null : `${svc.name} não é atendido neste dia/horário`;
}

export function checkAvailability(s: State, date: string, start: string, serviceIds: string[], ignoreId?: string): string | null {
  const dur = totalDuration(serviceIds, s.services);
  const a = toMin(start);
  const b = a + dur;
  if (onVacation(s, date)) return "Barbeiro de férias";
  if (!daySlots(s, date).includes(start)) return "Fora do expediente";
  if (b > toMin(s.settings.close)) return "Passa do horário de fechamento";
  if (a < toMin(s.settings.breakEnd) && b > toMin(s.settings.breakStart)) return "Conflita com o intervalo";
  for (const id of serviceIds) {
    const r = serviceRuleBlock(s.services.find((x) => x.id === id), date, a, b);
    if (r) return r;
  }
  const clash = s.bookings.some((x) => {
    if (x.id === ignoreId || x.date !== date || x.status === "cancelada") return false;
    const xa = toMin(startOf(x));
    const xb = toMin(endOf(x, s.services));
    return a < xb && b > xa;
  });
  return clash ? "Conflita com outra reserva" : null;
}

export function isAvailable(s: State, date: string, start: string, serviceId: string | string[], ignoreId?: string) {
  return checkAvailability(s, date, start, Array.isArray(serviceId) ? serviceId : [serviceId], ignoreId) === null;
}

export function freeSlots(s: State, date: string) {
  return daySlots(s, date).filter((t) => isAvailable(s, date, t, s.services[0]?.id ?? "corte"));
}

/** Forecast closing = max(scheduled close, last effective end of active bookings). */
export function closingForecast(s: State, date: string) {
  const ends = s.bookings.filter((b) => b.date === date && b.status === "confirmada").map((b) => toMin(endOf(b, s.services)));
  return toTime(Math.max(toMin(s.settings.close), ...ends));
}

/** Bookings affected by an adjustment starting at booking `fromId` (same day, confirmed, at/after it). */
export function adjustTargets(s: State, fromId: string) {
  const from = s.bookings.find((b) => b.id === fromId);
  if (!from) return [];
  return s.bookings
    .filter((b) => b.date === from.date && b.status === "confirmada" && b.start >= from.start)
    .sort((a, b) => a.start.localeCompare(b.start));
}
export function applyAdjust(fromId: string, minutes: number) {
  init();
  const ids = adjustTargets(state, fromId).map((b) => b.id);
  const from = state.bookings.find((b) => b.id === fromId);
  if (!from || !ids.length || !minutes) return;
  setState((s) => ({
    bookings: s.bookings.map((b) => (ids.includes(b.id) ? { ...b, shift: (b.shift ?? 0) + minutes } : b)),
    adjusts: [...s.adjusts, { id: uid(), date: from.date, fromId, minutes, ids, at: Date.now() }],
  }));
}
export function undoAdjust(id: string) {
  const a = state.adjusts.find((x) => x.id === id);
  if (!a) return;
  setState((s) => ({
    bookings: s.bookings.map((b) => (a.ids.includes(b.id) ? { ...b, shift: (b.shift ?? 0) - a.minutes } : b)),
    adjusts: s.adjusts.filter((x) => x.id !== id),
  }));
}

export const statusLabel: Record<BookingStatus, string> = {
  confirmada: "Confirmada",
  concluida: "Concluída",
  cancelada: "Cancelada",
  ausente: "Ausente",
};

export function displayName(name: string, mode: Settings["tvClientInfo"]) {
  if (mode === "none") return "Cliente";
  const parts = name.trim().split(/\s+/);
  if (mode === "initials") return parts.map((p) => p[0]?.toUpperCase() + ".").join(" ");
  return parts[0];
}

export const today = () => format(new Date(), "yyyy-MM-dd");

// ---------- actions ----------
export function upsertBooking(b: Booking, isNew: boolean) {
  setState((s) => ({ bookings: isNew ? [...s.bookings, b] : s.bookings.map((x) => (x.id === b.id ? b : x)) }), {
    kind: isNew ? "nova" : b.status === "cancelada" ? "cancelada" : "alterada",
    booking: b,
    at: Date.now(),
  });
}
export function setStatus(id: string, status: BookingStatus) {
  const b = state.bookings.find((x) => x.id === id);
  if (!b) return;
  upsertBooking({ ...b, status }, false);
}
export function clearDemo() {
  setState((s) => ({ bookings: s.bookings.filter((b) => !b.demo) }));
}

export function generatePairCode() {
  const code = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  setState(() => ({ tv: { code, expires: Date.now() + 10 * 60_000, connected: false } }));
  return code;
}
export function pairTv(code: string) {
  init();
  const tv = state.tv;
  if (!tv.code || tv.code !== code.toUpperCase().trim() || Date.now() > tv.expires) return false;
  setState(() => ({ tv: { code: null, expires: 0, connected: true, connectedAt: Date.now() } }));
  return true;
}
export function disconnectTv() {
  setState(() => ({ tv: { code: null, expires: 0, connected: false } }));
}

export function addBlocked(c: Omit<BlockedClient, "id" | "createdAt">) {
  setState((s) => ({ blacklist: [...s.blacklist, { ...c, id: uid(), createdAt: Date.now() }] }));
}
export function removeBlocked(id: string) {
  setState((s) => ({ blacklist: s.blacklist.filter((x) => x.id !== id) }));
}
