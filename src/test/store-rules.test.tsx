import { describe, expect, it } from "vitest";
import { checkAvailability, endOf, totalDuration, type State, type Booking } from "@/lib/store";

const base: State = {
  loaded: true,
  services: [
    { id: "corte", name: "Corte", duration: 30 },
    { id: "barba", name: "Barba", duration: 30 },
    { id: "pig", name: "Pigmentação", duration: 30, rules: [{ id: "r", days: [4], start: "14:00", end: "18:00" }] },
  ],
  bookings: [],
  settings: { shopName: "x", open: "08:00", close: "19:00", workDays: [1, 2, 3, 4, 5, 6], breakStart: "12:00", breakEnd: "13:00", slot: 30, showFreeOnTv: true, tvClientInfo: "first", sound: false, vacations: [], vacationMessage: "" },
  tv: { code: null, expires: 0, connected: false },
  blacklist: [],
  adjusts: [],
  updatedAt: 0,
};
const thu = "2026-10-29";

describe("regras da agenda", () => {
  it("soma a duração de vários serviços (3x30 = 90 min, 10:00 → 11:30)", () => {
    expect(totalDuration(["corte", "barba", "pig"], base.services)).toBe(90);
    const b = { id: "1", client: "A", phone: "1", serviceId: "corte", serviceIds: ["corte", "barba", "pig"], date: thu, start: "10:00", status: "confirmada", createdAt: 0 } as Booking;
    expect(endOf(b, base.services)).toBe("11:30");
  });
  it("bloqueia horário dentro de uma reserva de vários serviços", () => {
    const b = { id: "1", client: "A", phone: "1", serviceId: "corte", serviceIds: ["corte", "barba"], date: thu, start: "10:00", status: "confirmada", createdAt: 0 } as Booking;
    expect(checkAvailability({ ...base, bookings: [b] }, thu, "10:30", ["corte"])).not.toBeNull();
  });
  it("pigmentação só quinta 14h–18h", () => {
    expect(checkAvailability(base, thu, "14:00", ["pig"])).toBeNull();
    expect(checkAvailability(base, thu, "10:00", ["pig"])).not.toBeNull();
    expect(checkAvailability(base, "2026-10-28", "14:00", ["pig"])).not.toBeNull();
  });
  it("férias bloqueiam a agenda", () => {
    const s = { ...base, settings: { ...base.settings, vacations: [{ id: "v", start: "2026-10-28", end: "2026-10-30" }] } };
    expect(checkAvailability(s, thu, "14:00", ["corte"])).toBe("Barbeiro de férias");
  });
  it("atraso desloca o fim do atendimento", () => {
    const b = { id: "1", client: "A", phone: "1", serviceId: "corte", date: thu, start: "10:00", shift: 20, status: "confirmada", createdAt: 0 } as Booking;
    expect(endOf(b, base.services)).toBe("10:50");
  });
});
