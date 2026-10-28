import { useEffect, useSyncExternalStore } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { api, getAuthClient, saveTvToken, type RemoteSnapshot } from "./remote";
import { normalizePhone, shopNow } from "./domain";
export { normalizePhone, shopNow } from "./domain";

/** Shared Supabase state. Old localStorage is preserved only for manual export. */

export type BookingStatus = "confirmada" | "concluida" | "cancelada" | "ausente";
export type ServiceRule = { id: string; days: number[]; start: string; end: string };
export type Service = { id: string; name: string; duration: number; price: number; rules?: ServiceRule[]; active?: boolean };
export type BookingServiceSnapshot = { id: string; name: string; duration: number; price: number };
export type Vacation = { id: string; start: string; end: string };
export type BlockedClient = { id: string; phone: string; name?: string | undefined; reason?: string | undefined; createdAt: number };
export type Adjust = { id: string; date: string; fromId: string; minutes: number; ids: string[]; at: number };
export type Booking = {
  id: string;
  client: string;
  phone: string;
  serviceId: string;
  serviceIds?: string[];
  serviceSnapshots?: BookingServiceSnapshot[];
  clientId?: string;
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
export type State = { access?: "barber" | "tv" | "public" | undefined; error?: string | undefined; loaded: boolean; services: Service[]; bookings: Booking[]; settings: Settings; tv: TvState; blacklist: BlockedClient[]; adjusts: Adjust[]; updatedAt: number; demoSeedVersion?: string };
export type TvEvent = { kind: "nova" | "alterada" | "cancelada"; booking: Booking; at: number };

const KEY = "barbearia-snapshot-v1";
const defaultSettings: Settings = {
  shopName: "Duarte & Silva Barbearia",
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
  { id: "corte", name: "Corte", duration: 30, price: 35 },
  { id: "barba", name: "Barba", duration: 30, price: 35 },
  { id: "combo", name: "Corte + Barba", duration: 60, price: 70 },
  { id: "pigmentacao", name: "Pigmentação", duration: 45, price: 0 },
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

export const uid = () => globalThis.crypto.randomUUID();

let state: State = empty;
const listeners = new Set<() => void>();
const eventListeners = new Set<(e: TvEvent) => void>();
let started = false;
let authUserId: string | null = null;
let currentPath = "";
let revision = "";
let generation = 0;
let pendingWrites = 0;
let writes: Promise<unknown> = Promise.resolve();
const notify = () => listeners.forEach((l) => l());

function init() {
  if (typeof window === "undefined") return;
  if (!started) {
    started = true;
    getAuthClient().auth.onAuthStateChange((event,session) => {
      const userId=session?.user.id ?? null;
      if (event === "INITIAL_SESSION" || event === "SIGNED_OUT" || event === "USER_UPDATED" || userId !== authUserId) {
        authUserId=userId;
        setTimeout(() => void refreshStore(true),0);
      }
    });
    window.setInterval(() => { if (state.access) void refreshStore(); },15000);
    window.addEventListener("focus",() => void refreshStore());
  }
  if (currentPath !== window.location.pathname) {
    currentPath = window.location.pathname;
    void refreshStore(true);
  }
}
function accept(snapshot: RemoteSnapshot) {
  const previous = state;
  const code = state.tv.code;
  state = { ...snapshot.state, error:undefined };
  if (code && state.tv.expires > Date.now()) state = {...state,tv:{...state.tv,code}};
  revision = snapshot.revision;
  notify();
  if (previous.access === "barber" || previous.access === "tv") {
    for (const booking of state.bookings) {
      const old = previous.bookings.find((b)=>b.id===booking.id);
      const changed = old && (old.date!==booking.date || old.start!==booking.start || old.shift!==booking.shift || (old.status!=="cancelada" && booking.status==="cancelada"));
      if (!old || changed) eventListeners.forEach((l)=>l({kind:!old ? "nova" : booking.status==="cancelada" ? "cancelada" : "alterada",booking,at:Date.now()}));
    }
    for (const booking of previous.bookings) {
      if (!state.bookings.some((b)=>b.id===booking.id)) eventListeners.forEach((l)=>l({kind:"cancelada",booking,at:Date.now()}));
    }
  }
}
export async function refreshStore(reset = false) {
  if (pendingWrites && !reset) return;
  const id = ++generation;
  if (reset) { state = {...empty}; notify(); }
  try {
    // Visitors (no barber session, no paired TV) only get the public catalogue,
    // so the private snapshot is never requested and never answers 401.
    const signedIn = !!(await getAuthClient().auth.getSession()).data.session;
    const pairedTv = typeof localStorage !== "undefined" && !!localStorage.getItem("barbearia-tv-session-v1");
    const snapshot = await api(currentPath === "/agendar" || (!signedIn && !pairedTv) ? "catalog" : "snapshot");
    if (id === generation) accept(snapshot);
  } catch (error) {
    if (id !== generation) return;
    // Never fall back to stale private data after logout or failed authorization.
    state = {...empty,loaded:true,error:error instanceof Error ? error.message : "Falha na conexão"};
    revision = "";
    notify();
  }
}
export function setState(fn: (s: State) => Partial<State>, event?: TvEvent): Promise<boolean> {
  init();
  pendingWrites++;
  const operation = writes.then(async () => {
    if (state.access !== "barber") throw new Error("Entre com a conta autorizada do barbeiro.");
    // A late polling response must not overwrite the result of this write.
    const id = ++generation;
    const partial = fn(state);
    const allowed = ["services","settings","blacklist","bookings","adjusts"];
    const changes = Object.fromEntries(Object.entries(partial).filter(([key]) => allowed.includes(key)));
    const snapshot = await api("patch",{changes},revision);
    if (id !== generation) return false;
    accept(snapshot);
    return true;
  });
  writes = operation.catch(() => {});
  return operation.catch(async (error) => {
    toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    await refreshStore(true);
    return false;
  }).finally(() => { pendingWrites--; });
}
/** Explicit user export; never overwrite or import the browser's old data. */
export function exportBrowserBackup() {
  const raw = localStorage.getItem(KEY);
  if (!raw) { toast("Não há dados locais neste aparelho."); return; }
  const href = URL.createObjectURL(new Blob([raw],{type:"application/json"}));
  const anchor = document.createElement("a");
  anchor.href = href; anchor.download = "barbearia-dados-locais-" + today() + ".json"; anchor.click();
  URL.revokeObjectURL(href);
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
export const serviceNames = (b: Pick<Booking, "serviceId" | "serviceIds" | "serviceSnapshots">, services: Service[]) =>
  bookingServiceIds(b).map((id) => b.serviceSnapshots?.find((s) => s.id === id)?.name ?? services.find((s) => s.id === id)?.name ?? "Serviço").join(" + ");
export const bookingDuration = (b: Booking, services: Service[]) =>
  b.serviceSnapshots?.length ? b.serviceSnapshots.reduce((sum, s) => sum + s.duration, 0) : totalDuration(bookingServiceIds(b), services);
/** Effective start including delay/advance shift. */
export const startOf = (b: Booking) => toTime(toMin(b.start) + (b.shift ?? 0));
export function endOf(b: Booking, services: Service[]) {
  return toTime(toMin(b.start) + (b.shift ?? 0) + bookingDuration(b, services));
}
export const fmtDuration = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`);

export const onVacation = (s: State, date: string) => s.settings.vacations.find((v) => date >= v.start && date <= v.end);
export const vacationText = (s: State, v: Vacation) =>
  s.settings.vacationMessage.replace("{inicio}", v.start.split("-").reverse().join("/")).replace("{fim}", v.end.split("-").reverse().join("/"));
export const digits = (p: string) => p.replace(/\D/g, "");
export const isBlocked = (s: State, phone: string) => {
  const canonical = normalizePhone(phone);
  return canonical ? s.blacklist.find((x) => normalizePhone(x.phone) === canonical) : undefined;
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
  const previous = s.bookings.find((b) => b.id === ignoreId);
  const sameServices = previous && JSON.stringify(bookingServiceIds(previous)) === JSON.stringify(serviceIds);
  if (!serviceIds.length || new Set(serviceIds).size !== serviceIds.length || serviceIds.some((id) => !s.services.some((x) => x.id === id && (x.active !== false || sameServices)))) return "Escolha serviços disponíveis";
  if (sameServices && previous.date===date && previous.start===start) return null;
  const dur = sameServices ? bookingDuration(previous, s.services) : totalDuration(serviceIds, s.services);
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
  const service = s.services.find((x) => x.active !== false);
  return service ? daySlots(s, date).filter((t) => isAvailable(s, date, t, service.id)) : [];
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
  return setState((s) => {
    const ids = adjustTargets(s, fromId).map((b) => b.id);
    const from = s.bookings.find((b) => b.id === fromId);
    if (!from || !ids.length || !Number.isInteger(minutes) || !minutes) throw new Error("Escolha um ajuste válido.");
    const bookings = s.bookings.map((b) => ids.includes(b.id) ? {...b,shift:(b.shift ?? 0)+minutes} : b);
    const error = adjustmentError({...s,bookings});
    if (error) throw new Error(error);
    return {bookings,adjusts:[...s.adjusts,{id:uid(),date:from.date,fromId,minutes,ids,at:Date.now()}]};
  });
}
export function undoAdjust(id: string) {
  return setState((s) => {
    const a = s.adjusts.find((x) => x.id === id);
    if (!a) throw new Error("Este ajuste não está mais disponível.");
    const bookings = s.bookings.map((b) => a.ids.includes(b.id) ? {...b,shift:(b.shift ?? 0)-a.minutes} : b);
    const error = adjustmentError({...s,bookings});
    if (error) throw new Error(error);
    return {bookings,adjusts:s.adjusts.filter((x) => x.id !== id)};
  });
}

export function adjustmentError(s: State): string | null {
  const active = s.bookings.filter((b) => b.status !== "cancelada");
  for (const b of active) {
    const start = toMin(b.start)+(b.shift ?? 0);
    const end = start+bookingDuration(b,s.services);
    if (start<0 || end>1440 || Math.abs(b.shift ?? 0)>1440) return "O ajuste ultrapassa o dia da reserva.";
    if (active.some((x) => x.id!==b.id && x.date===b.date && start<toMin(endOf(x,s.services)) && end>toMin(startOf(x)))) return "O ajuste conflita com outra reserva.";
  }
  return null;
}

export const statusLabel: Record<BookingStatus, string> = {
  confirmada: "Confirmado",
  concluida: "Concluído",
  cancelada: "Cancelada",
  ausente: "Ausente",
};

export function displayName(name: string, mode: Settings["tvClientInfo"]) {
  if (mode === "none") return "Cliente";
  const parts = name.trim().split(/\s+/);
  if (mode === "initials") return parts.map((p) => p[0]?.toUpperCase() + ".").join(" ");
  return parts[0];
}

export const today = () => format(shopNow(), "yyyy-MM-dd");

// ---------- actions ----------
export async function upsertBooking(b: Booking, isNew: boolean): Promise<Booking | null> {
  init();
  if (state.access !== "barber") {
    if (!isNew) return null;
    try {
      const saved = await api<{booking:Booking}>("book",{booking:b});
      await refreshStore();
      return saved.booking;
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível reservar."); await refreshStore(); return null; }
  }
  const ok = await setState((s) => {
    const old = s.bookings.find((x) => x.id === b.id);
    const moved = old && (old.date !== b.date || old.start !== b.start);
    return {
      bookings:isNew ? [...s.bookings,b] : s.bookings.map((x) => x.id === b.id ? b : x),
      ...(moved ? {adjusts:s.adjusts.map((a) => ({...a,ids:a.ids.filter((id) => id!==b.id)})).filter((a) => a.ids.length)} : {}),
    };
  }, {kind:isNew ? "nova" : b.status === "cancelada" ? "cancelada" : "alterada",booking:b,at:Date.now()});
  return ok ? state.bookings.find((x) => x.id === b.id) ?? null : null;
}
export async function setStatus(id: string, status: BookingStatus): Promise<boolean> {
  init();
  if (state.access === "tv") {
    if (status !== "ausente") return false;
    try { accept(await api("absent",{id})); return true; }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar."); return false; }
  }
  const b = state.bookings.find((x) => x.id === id);
  return !!b && !!await upsertBooking({...b,status},false);
}

/**
 * Preserve existing hook consumers while completion runs on the server.
 */
export function useAutoCompleteBookings() {
  // Completion runs in Supabase Cron. Polling only reads the authoritative state.
  useEffect(() => { init(); },[]);
}
export function deleteBooking(id: string) {
  init();
  const booking = state.bookings.find((b) => b.id === id);
  if (!booking) return;
  return setState(
    (s) => ({
      bookings: s.bookings.filter((b) => b.id !== id),
      adjusts: s.adjusts.map((a) => ({ ...a, fromId:a.fromId===id ? "" : a.fromId, ids: a.ids.filter((x) => x !== id) })).filter((a) => a.ids.length > 0),
    }),
    { kind: "cancelada", booking, at: Date.now() },
  );
}

export async function generatePairCode(): Promise<string | null> {
  try {
    const data = await api<{code:string;expires:number}>("pair-code");
    state = {...state,tv:{...state.tv,...data}}; notify(); return data.code;
  } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível gerar o código."); return null; }
}
export async function pairTv(code: string): Promise<boolean> {
  try {
    const data = await api<{token:string}>("pair",{code});
    saveTvToken(data.token); await refreshStore(true); return state.access === "tv" || state.access === "barber";
  } catch { return false; }
}
export async function disconnectTv(): Promise<boolean> {
  try { accept(await api("disconnect-tv")); return true; }
  catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível desconectar."); return false; }
}
export function addBlocked(c: Omit<BlockedClient,"id"|"createdAt">) {
  const phone = normalizePhone(c.phone);
  if (!phone) { toast.error("Informe um telefone com DDD."); return Promise.resolve(false); }
  return setState((s) => ({blacklist:[...s.blacklist,{...c,phone,id:uid(),createdAt:Date.now()}]}));
}
export function removeBlocked(id: string) {
  return setState((s) => ({blacklist:s.blacklist.filter((x) => x.id !== id)}));
}
