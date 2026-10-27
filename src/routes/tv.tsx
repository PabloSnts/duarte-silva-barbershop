import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Maximize, MonitorSmartphone, RefreshCw, Tv, Unplug } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { disconnectTv, generatePairCode, useStore } from "@/lib/store";

export const Route = createFileRoute("/tv")({
  head: () => ({
    meta: [
      { title: "Visualização na TV — Barbearia" },
      { name: "description", content: "Abra a agenda na TV da barbearia ou conecte uma televisão com QR Code ou código." },
      { property: "og:title", content: "Visualização na TV — Barbearia" },
      { property: "og:description", content: "Mostre a agenda do dia em uma tela grande." },
    ],
  }),
  component: TvSetup,
});

function TvSetup() {
  const tv = useStore((s) => s.tv);
  const [origin, setOrigin] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setOrigin(window.location.origin);
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const valid = tv.code && tv.expires > now;
  const left = Math.max(0, Math.floor((tv.expires - now) / 1000));

  return (
    <AppShell title="Visualização na TV">
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <span className={`h-3 w-3 shrink-0 rounded-full ${tv.connected ? "bg-success" : valid ? "animate-pulse bg-warning" : "bg-muted-foreground/40"}`} />
        <p className="min-w-0 flex-1 truncate font-semibold">{tv.connected ? "TV conectada" : valid ? "Aguardando conexão" : "Nenhuma TV conectada"}</p>
        {tv.connected && <Button size="sm" variant="outline" onClick={disconnectTv}><Unplug className="h-4 w-4" />Desconectar</Button>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6">
          <MonitorSmartphone className="h-8 w-8 text-primary" />
          <h2 className="mt-3 text-2xl font-bold uppercase">Opção A — Abrir nesta tela</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ideal se este aparelho estiver ligado à TV (notebook via HDMI, por exemplo). Ative a tela cheia na próxima página.</p>
          <Button asChild className="mt-5 bg-gold shadow-gold"><Link to="/painel-tv" search={{ local: 1 }}><Maximize className="h-4 w-4" />Abrir painel da TV</Link></Button>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <Tv className="h-8 w-8 text-primary" />
          <h2 className="mt-3 text-2xl font-bold uppercase">Opção B — Conectar uma televisão</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Na TV, abra o navegador e acesse <span className="text-foreground">{origin || "o endereço do sistema"}/painel-tv</span></li>
            <li>Digite o código abaixo na TV, ou leia o QR Code com o dispositivo ligado a ela.</li>
            <li>O código vale por 10 minutos e funciona uma única vez.</li>
          </ol>
          {valid ? (
            <div className="mt-5 flex flex-wrap items-center gap-6">
              <div className="rounded-xl bg-foreground p-3">
                <QRCodeSVG value={`${origin}/painel-tv?code=${tv.code}`} size={140} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Código de pareamento</p>
                <p className="font-display text-5xl font-bold tracking-[0.2em] text-primary">{tv.code}</p>
                <p className="text-xs text-muted-foreground">Expira em {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</p>
                <Button size="sm" variant="ghost" className="mt-2" onClick={generatePairCode}><RefreshCw className="h-4 w-4" />Novo código</Button>
              </div>
            </div>
          ) : (
            <Button className="mt-5" variant="outline" onClick={generatePairCode}>Gerar código de pareamento</Button>
          )}
          <p className="mt-5 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            Modo demonstração: o pareamento funciona entre abas do mesmo navegador. Para conectar uma TV física, é preciso ativar o servidor com atualização em tempo real.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
