import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Scissors, Maximize, Minimize } from "lucide-react";

export const Route = createFileRoute("/tv")({ component: TvDisplay });

type TvAppointment = {
  id: number;
  name: string;
  service: string;
  time: string;
  date?: string;
  status: string;
  duration: number;
};

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function TvDisplay() {
  const [now, setNow] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [store, setStore] = useState<{ appointments: TvAppointment[] }>(() => {
    try {
      const raw = localStorage.getItem("barbearia-store-v1");
      if (raw) return JSON.parse(raw);
    } catch {}
    return { appointments: [] };
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    const refresh = () => {
      try {
        const raw = localStorage.getItem("barbearia-store-v1");
        if (raw) setStore(JSON.parse(raw));
      } catch {}
    };
    let channel: BroadcastChannel | undefined;
    try {
      channel = new BroadcastChannel("barbearia-store-v1");
      channel.addEventListener("message", refresh);
    } catch {}
    window.addEventListener("storage", refresh);
    refresh();
    return () => {
      window.clearInterval(timer);
      channel?.removeEventListener("message", refresh);
      channel?.close();
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const appointments = useMemo(() => {
    const today = localDateKey(now);
    return (store.appointments ?? [])
      .filter((item) => !item.date || item.date === today)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [store, now]);

  const upcoming = appointments.filter((item) => {
    const status = item.status.toLowerCase();
    return !status.includes("conclu") && !status.includes("cancel") && item.time >= now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
  });

  const freeSlots = useMemo(() => {
    const day = now.getDay();
    if (day === 0 || day === 2) return [];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const busy = appointments
      .filter((item) => !/conclu|cancel/i.test(item.status))
      .map((item) => {
        const [hour, minute] = item.time.split(":").map(Number);
        return { start: hour * 60 + minute, end: hour * 60 + minute + (item.duration || 30) };
      });
    const slots: string[] = [];
    for (let minute = 8 * 60; minute < 20 * 60; minute += 30) {
      if (minute <= currentMinutes || (minute >= 12 * 60 && minute < 13 * 60)) continue;
      if (busy.some((item) => minute < item.end && minute + 30 > item.start)) continue;
      slots.push(`${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`);
      if (slots.length === 4) break;
    }
    return slots;
  }, [appointments, now]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {}
  };

  const formatDate = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const displayStatus = (status: string) => {
    if (/conclu/i.test(status)) return "Concluída";
    if (/aguard/i.test(status)) return "Aguardando";
    if (/cancel/i.test(status)) return "Cancelada";
    return "Confirmada";
  };

  return (
    <main className="tv-screen">
      <header className="tv-header">
        <div className="tv-brand-mark"><Scissors size={31} strokeWidth={2.2} /></div>
        <div className="tv-brand">
          <strong>NAVALHA <span>&amp;</span> CO.</strong>
          <small>{formatDate.charAt(0).toUpperCase() + formatDate.slice(1)}</small>
        </div>
        <div className="tv-header-right">
          <time>{now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
          <button className="tv-fullscreen" onClick={toggleFullscreen} aria-label={isFullscreen ? "Sair da tela cheia" : "Ativar tela cheia"}>
            {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
          </button>
        </div>
      </header>

      <div className="tv-layout">
        <section className="tv-agenda">
          <h1>AGENDA DE HOJE</h1>
          {appointments.length ? (
            <div className="tv-appointment-list">
              {appointments.map((item) => {
                const completed = /conclu/i.test(item.status);
                const cancelled = /cancel/i.test(item.status);
                const [hour, minute] = item.time.split(":").map(Number);
                const endMinutes = hour * 60 + minute + (item.duration || 30);
                const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
                return (
                  <article className={`tv-appointment ${completed || cancelled ? "is-muted" : ""}`} key={item.id}>
                    <time className="tv-appointment-time">{item.time}</time>
                    <div className="tv-appointment-info">
                      <strong>{item.name} - {item.service}</strong>
                      <span>{item.service} · até {endTime}</span>
                    </div>
                    <span className={`tv-status ${completed ? "is-completed" : cancelled ? "is-cancelled" : "is-confirmed"}`}>{displayStatus(item.status)}</span>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="tv-empty">Nenhum agendamento para hoje.</div>
          )}
        </section>

        <aside className="tv-sidebar">
          <section className="tv-panel tv-next-panel">
            <h2>PRÓXIMOS</h2>
            {upcoming.length ? (
              <div className="tv-next-list">
                {upcoming.slice(0, 3).map((item) => (
                  <div className="tv-next-item" key={item.id}>
                    <time>{item.time}</time><span>{item.name}</span>
                  </div>
                ))}
              </div>
            ) : <p>Sem próximos atendimentos</p>}
          </section>
          <section className="tv-panel tv-free-panel">
            <h2>HORÁRIOS LIVRES</h2>
            {freeSlots.length ? (
              <div className="tv-free-slots">{freeSlots.map((slot) => <span key={slot}>{slot}</span>)}</div>
            ) : <p>Sem horários livres disponíveis</p>}
          </section>
        </aside>
      </div>

      <style>{`
        .tv-screen{box-sizing:border-box;min-height:100vh;padding:14px clamp(16px,2.4vw,38px) 28px;background:#0b0c0e;color:#eeeae3;font-family:"Manrope",ui-sans-serif,system-ui,sans-serif;overflow:auto}
        .tv-header{display:flex;align-items:center;gap:22px;min-height:88px;margin-bottom:38px}
        .tv-brand-mark{display:grid;place-items:center;flex:0 0 72px;width:72px;height:72px;border-radius:18px;color:#0b0c0e;background:linear-gradient(135deg,#edc56f,#c58d3b)}
        .tv-brand strong{display:block;font-family:"Big Shoulders Display",Impact,sans-serif;font-size:clamp(34px,3.3vw,54px);font-weight:800;line-height:.92;letter-spacing:.015em;color:#f2eee7}
        .tv-brand strong span{color:#e0b251}
        .tv-brand small{display:block;margin-top:8px;color:#a7a29a;font-size:clamp(13px,1.2vw,20px);font-weight:400}
        .tv-header-right{display:flex;align-items:center;gap:28px;margin-left:auto}
        .tv-header-right time{font-family:"Big Shoulders Display",Impact,sans-serif;font-size:clamp(48px,5vw,86px);font-weight:800;line-height:1;color:#e5b34f;font-variant-numeric:tabular-nums}
        .tv-fullscreen{display:grid;place-items:center;padding:8px;border:0;background:transparent;color:#55565a;cursor:pointer}
        .tv-fullscreen:hover{color:#e5b34f}
        .tv-layout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(360px,1fr);gap:clamp(22px,2vw,36px);align-items:start}
        .tv-agenda h1{margin:0 0 18px;font-family:"Big Shoulders Display",Impact,sans-serif;font-size:clamp(24px,2vw,36px);font-weight:700;color:#b9b1a3}
        .tv-appointment-list{display:flex;flex-direction:column;gap:13px}
        .tv-appointment{display:flex;align-items:center;gap:clamp(15px,2vw,35px);min-height:110px;padding:16px 27px;border:1px solid #2b2c2f;border-radius:23px;background:#17181a}
        .tv-appointment.is-muted{background:#111214;border-color:#202123;color:#858585}
        .tv-appointment-time{flex:0 0 160px;font-family:"Big Shoulders Display",Impact,sans-serif;font-size:clamp(35px,3.4vw,58px);font-weight:700;line-height:1;font-variant-numeric:tabular-nums}
        .tv-appointment-info{display:flex;flex:1;flex-direction:column;gap:3px;min-width:0}
        .tv-appointment-info strong{font-size:clamp(17px,1.8vw,31px);font-weight:600;line-height:1.2;overflow-wrap:anywhere}
        .tv-appointment-info span{color:#aaa49b;font-size:clamp(12px,1.2vw,21px)}
        .tv-status{flex:0 0 auto;padding:10px 18px;border:1px solid transparent;border-radius:30px;font-size:clamp(12px,1.1vw,20px);font-weight:600;white-space:nowrap}
        .tv-status.is-completed{color:#36734f;border-color:#1d3b2a;background:#17251d}
        .tv-status.is-confirmed{color:#e6b04e;border-color:#6d5225;background:#342b1d}
        .tv-status.is-cancelled{color:#c87979;border-color:#573232;background:#2a1c1c}
        .tv-panel{padding:26px 28px 28px;border:1px solid;border-radius:23px;background:#17181a}
        .tv-panel h2{margin:0 0 20px;font-family:"Big Shoulders Display",Impact,sans-serif;font-size:clamp(24px,1.8vw,34px);font-weight:700}
        .tv-next-panel{border-color:#5c4827}
        .tv-next-panel h2{color:#e3ad4a}
        .tv-panel p{margin:0;color:#aaa49b;font-size:clamp(16px,1.45vw,26px)}
        .tv-next-list{display:flex;flex-direction:column;gap:14px}
        .tv-next-item{display:flex;gap:20px;align-items:center;color:#e4dfd6;font-size:clamp(14px,1.2vw,20px)}
        .tv-next-item time{font-family:"Big Shoulders Display",Impact,sans-serif;color:#e5b34f;font-size:1.35em}
        .tv-free-panel{margin-top:30px;border-color:#28543c}
        .tv-free-panel h2{color:#4caf77}
        .tv-free-slots{display:flex;flex-wrap:wrap;gap:12px}
        .tv-free-slots span{padding:10px 18px;border-radius:18px;background:#203128;color:#55bd80;font-family:"Big Shoulders Display",Impact,sans-serif;font-size:clamp(20px,1.8vw,31px);font-weight:700}
        .tv-empty{padding:30px;border:1px solid #2b2c2f;border-radius:22px;color:#aaa49b;background:#17181a;font-size:20px}
        @media(max-width:1000px){.tv-layout{grid-template-columns:1fr}.tv-sidebar{display:grid;grid-template-columns:1fr 1fr;gap:18px}.tv-free-panel{margin-top:0}.tv-appointment-time{flex-basis:115px}}
        @media(max-width:650px){.tv-screen{padding:12px}.tv-header{gap:12px;margin-bottom:25px}.tv-brand-mark{flex-basis:48px;width:48px;height:48px;border-radius:13px}.tv-brand-mark svg{width:24px}.tv-brand strong{font-size:28px}.tv-brand small{font-size:11px}.tv-header-right{gap:6px}.tv-header-right time{font-size:36px}.tv-fullscreen svg{width:17px}.tv-sidebar{display:flex;flex-direction:column}.tv-free-panel{margin-top:0}.tv-appointment{gap:10px;min-height:80px;padding:12px;border-radius:16px;flex-wrap:wrap}.tv-appointment-time{flex-basis:70px;font-size:34px}.tv-appointment-info{min-width:calc(100% - 90px)}.tv-appointment-info strong{font-size:15px}.tv-appointment-info span{font-size:11px}.tv-status{margin-left:80px;padding:6px 10px;font-size:11px}.tv-panel{padding:20px;border-radius:17px}}
      `}</style>
    </main>
  );
}
