import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Scissors, Clock3, Sparkles } from "lucide-react";

export const Route = createFileRoute("/tv")({ component: TvDisplay });

const fallbackQueue = [
  { name: "Pablo - Corte + Barba", time: "10:00", status: "EM ATENDIMENTO", active: true },
  { name: "Lucas Ferreira", time: "10:30", status: "PRÓXIMO", active: false },
  { name: "André Martins", time: "11:30", status: "NA FILA", active: false },
  { name: "Gabriel Souza", time: "14:00", status: "AGENDADO", active: false },
];

function TvDisplay() {
  const [now, setNow] = useState(new Date());
  const [store, setStore] = useState<{ appointments: { id: number; name: string; service: string; time: string; date?: string; status: string; duration: number }[]; tvNameFormat?: string }>(() => { try { const raw = localStorage.getItem("barbearia-store-v1"); if (raw) return JSON.parse(raw); } catch {} return { appointments: [] }; });
  const queue = useMemo(() => { const today = new Date().toISOString().slice(0, 10); const appointments = (store.appointments ?? []).filter((item) => !item.date || item.date === today).sort((a, b) => a.time.localeCompare(b.time)); if (!appointments.length) return fallbackQueue; return appointments.map((item, index) => ({ name: store.tvNameFormat === "Iniciais" ? item.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : store.tvNameFormat === "Primeiro nome" ? item.name.split(/\s+/)[0] : store.tvNameFormat === "Nome e sobrenome" ? item.name.split(/\s+/).slice(0, 2).join(" ") : `${item.name} — ${item.service}`, time: item.time, status: index === 0 ? "PRÓXIMO" : "AGENDADO", active: false })); }, [store]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    const channel = new BroadcastChannel("barbearia-store-v1");
    const refresh = () => { try { const raw = localStorage.getItem("barbearia-store-v1"); if (raw) setStore(JSON.parse(raw)); } catch {} };
    channel.addEventListener("message", refresh);
    window.addEventListener("storage", refresh);
    refresh();
    return () => { window.clearInterval(timer); channel.removeEventListener("message", refresh); window.removeEventListener("storage", refresh); channel.close(); };
  }, []);

  return (
    <main className="tv-screen">
      <header className="tv-header">
        <div className="tv-brand-mark"><Scissors size={28} /></div>
        <div className="tv-brand"><strong>DUARTE <span>&</span> SILVA</strong><small>BARBERSHOP</small></div>
        <div className="tv-header-right"><span className="tv-open"><i /> ATENDIMENTO EM ANDAMENTO</span><time>{now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time></div>
      </header>
      <section className="tv-welcome">
        <div className="tv-eyebrow"><Sparkles size={15} /> SEU MOMENTO. SEU ESTILO.</div>
        <h1>Bem-vindo à <em>experiência</em>.</h1>
        <p>Relaxe. Estamos preparando tudo para você.</p>
      </section>
      <section className="tv-now">
        <div className="tv-now-label"><span className="tv-pulse" /> EM ATENDIMENTO AGORA</div>
        <div className="tv-now-person">Pablo <span>— Corte + Barba</span></div>
        <div className="tv-now-meta"><Clock3 size={17} /> Início às 10:00 <span className="tv-meta-separator" /> Cadeira 01</div>
      </section>
      <section className="tv-queue-section">
        <div className="tv-section-title"><div><span className="tv-eyebrow">ACOMPANHAMENTO</span><h2>Fila de atendimento</h2></div><span className="tv-queue-count">03 NA SEQUÊNCIA</span></div>
        <div className="tv-queue">
          {queue.filter((item) => !item.active).map((item, index) => (
            <article className={`tv-queue-card ${index === 0 ? "tv-next" : ""}`} key={item.name}>
              <div className="tv-queue-index">{String(index + 1).padStart(2, "0")}</div>
              <div className="tv-queue-info"><span>{item.status}</span><strong>{item.name}</strong></div>
              <div className="tv-queue-time">{item.time}</div>
            </article>
          ))}
        </div>
      </section>
      <footer className="tv-footer"><span>DUARTE & SILVA <i /> CUIDADO EM CADA DETALHE</span><span>Obrigado pela preferência.</span></footer>
      <style>{`
        .tv-screen{min-height:100vh;padding:clamp(24px,4vw,64px) clamp(22px,6vw,100px);background:radial-gradient(ellipse at 50% 35%,rgba(174,137,37,.12),transparent 44%),#0b0c0e;color:#f1eee6;font-family:"Manrope",ui-sans-serif,system-ui,sans-serif;display:flex;flex-direction:column}
        .tv-header{display:flex;align-items:center;gap:15px;padding-bottom:24px;border-bottom:1px solid rgba(255,255,255,.1)}
        .tv-brand-mark{display:grid;place-items:center;width:52px;height:52px;border:1px solid rgba(212,175,55,.4);border-radius:14px;color:#d4af37;background:rgba(212,175,55,.08)}
        .tv-brand strong{display:block;font-family:"Big Shoulders Display",Impact,sans-serif;font-size:clamp(15px,1.6vw,23px);letter-spacing:.14em}.tv-brand strong span{color:#d4af37;font-style:italic}.tv-brand small{display:block;margin-top:6px;color:#8b8980;font-size:10px;letter-spacing:.25em}
        .tv-header-right{margin-left:auto;display:flex;align-items:center;gap:clamp(15px,3vw,44px)}.tv-open{display:flex;align-items:center;gap:9px;color:#a9aa9f;font-size:clamp(9px,.9vw,12px);letter-spacing:.1em}.tv-open i,.tv-pulse{width:8px;height:8px;border-radius:50%;background:#74c998;box-shadow:0 0 12px rgba(116,201,152,.45)}.tv-header time{font-family:"Big Shoulders Display",Impact,sans-serif;font-size:clamp(25px,3vw,43px);color:#e2c65e}
        .tv-welcome{text-align:center;padding:clamp(35px,6vh,75px) 0 35px}.tv-eyebrow{display:flex;align-items:center;justify-content:center;gap:9px;color:#d3b44c;font-size:clamp(9px,.9vw,12px);letter-spacing:.2em}.tv-welcome h1{margin:18px 0 12px;font-family:"Big Shoulders Display",Impact,sans-serif;font-size:clamp(34px,5.2vw,76px);font-weight:400;letter-spacing:-.04em}.tv-welcome h1 em{color:#d7b84c;font-weight:400}.tv-welcome p{margin:0;color:#999991;font-size:clamp(13px,1.3vw,18px)}
        .tv-now{width:min(100%,1050px);margin:0 auto;padding:clamp(22px,3vw,40px);text-align:center;border:1px solid rgba(212,175,55,.28);border-radius:18px;background:linear-gradient(115deg,rgba(212,175,55,.08),rgba(255,255,255,.018) 60%),#141518;box-shadow:0 20px 80px rgba(0,0,0,.2)}.tv-now-label{display:flex;align-items:center;justify-content:center;gap:10px;color:#d4b84f;font-size:clamp(9px,.9vw,12px);letter-spacing:.17em}.tv-now-person{margin:20px 0 14px;font-family:"Big Shoulders Display",Impact,sans-serif;font-size:clamp(27px,4vw,56px)}.tv-now-person span{color:#c9b76e}.tv-now-meta{display:flex;align-items:center;justify-content:center;gap:10px;color:#96958c;font-size:clamp(11px,1.1vw,15px)}.tv-now-meta svg{color:#d4af37}.tv-meta-separator{height:15px;width:1px;margin:0 8px;background:rgba(255,255,255,.18)}
        .tv-queue-section{width:min(100%,1050px);margin:clamp(30px,5vh,55px) auto 0;flex:1}.tv-section-title{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:18px}.tv-section-title .tv-eyebrow{justify-content:flex-start;font-size:9px}.tv-section-title h2{margin:8px 0 0;font-family:"Big Shoulders Display",Impact,sans-serif;font-size:clamp(22px,2.2vw,31px);font-weight:400}.tv-queue-count{color:#9a988e;font-size:10px;letter-spacing:.13em}.tv-queue{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.tv-queue-card{display:flex;align-items:center;gap:13px;min-width:0;padding:clamp(15px,2vw,25px);border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025)}.tv-next{border-color:rgba(212,175,55,.3);background:rgba(212,175,55,.055)}.tv-queue-index{font-family:"Big Shoulders Display",Impact,sans-serif;font-size:clamp(20px,2vw,29px);color:#b39a43}.tv-queue-info{flex:1;min-width:0}.tv-queue-info span{display:block;color:#bba74f;font-size:8px;letter-spacing:.13em}.tv-queue-info strong{display:block;margin-top:8px;overflow-wrap:anywhere;font-size:clamp(11px,1.15vw,15px);font-weight:500}.tv-queue-time{color:#e3d7a4;font-family:"Big Shoulders Display",Impact,sans-serif;font-size:clamp(17px,1.8vw,25px)}
        .tv-footer{display:flex;justify-content:space-between;gap:15px;margin-top:45px;padding-top:20px;border-top:1px solid rgba(255,255,255,.08);color:#77786f;font-size:9px;letter-spacing:.12em}.tv-footer span:first-child{display:flex;align-items:center;gap:9px}.tv-footer i{width:3px;height:3px;background:#d4af37;border-radius:50%}
        @media(max-width:700px){.tv-open{display:none}.tv-queue{grid-template-columns:1fr}.tv-queue-card{padding:15px}.tv-footer{flex-direction:column;align-items:center;text-align:center}.tv-welcome{padding:35px 0 25px}.tv-now-person span{display:block;margin-top:8px;font-size:.65em}.tv-header-right{gap:0}}
        @media(min-width:1500px){.tv-screen{padding-left:9vw;padding-right:9vw}}
      `}</style>
    </main>
  );
}
