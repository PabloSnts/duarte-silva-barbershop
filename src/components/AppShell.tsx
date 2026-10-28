import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Ban, CalendarClock, CalendarDays, CalendarPlus, LayoutDashboard, ListChecks, Scissors, Settings, Tv, Users } from "lucide-react";
import { clearDemo, useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/reservas", label: "Reservas", icon: ListChecks },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/servicos", label: "Serviços", icon: Scissors },
  { to: "/expediente", label: "Expediente e férias", icon: CalendarClock },
  { to: "/blacklist", label: "Blacklist", icon: Ban },
  { to: "/tv", label: "Visualização na TV", icon: Tv },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
  { to: "/agendar", label: "Agendamento cliente", icon: CalendarPlus },
] as const;

const mobileNav = [nav[0], nav[1], nav[2], nav[7], nav[8]];

export function AppShell({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const shop = useStore((s) => s.settings.shopName);
  const hasDemo = useStore((s) => s.bookings.some((b) => b.demo));
  const tvOn = useStore((s) => s.tv.connected);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_1fr]">
      <aside className="hidden border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gold text-primary-foreground">
            <Scissors className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-bold uppercase">{shop}</p>
            <p className="text-xs text-muted-foreground">Painel do barbeiro</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {nav.map((n) => {
            const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "bg-sidebar-accent text-primary" : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
                {n.to === "/tv" && <span className={`ml-auto h-2 w-2 rounded-full ${tvOn ? "bg-success" : "bg-muted-foreground/40"}`} />}
              </Link>
            );
          })}
        </nav>
        <p className="px-6 py-5 text-xs text-muted-foreground">Reservas recebidas via WhatsApp</p>
      </aside>

      <div className="flex min-w-0 flex-col pb-20 md:pb-0">
        {hasDemo && (
          <div className="flex flex-wrap items-center justify-center gap-3 border-b border-border bg-primary/10 px-4 py-2 text-center text-xs text-primary">
            Exibindo dados de demonstração — não são reservas reais.
            <button onClick={clearDemo} className="underline underline-offset-2">Remover exemplos</button>
          </div>
        )}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-5 md:px-8 md:py-7">
          <h1 className="truncate text-3xl font-bold uppercase md:text-4xl">{title}</h1>
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        </header>
        <main className="flex-1 px-4 pb-8 md:px-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-sidebar/95 backdrop-blur md:hidden">
        {mobileNav.map((n) => {
          const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to} className={`flex flex-col items-center gap-1 py-2.5 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}>
              <n.icon className="h-5 w-5" />
              {n.label === "Visualização na TV" ? "TV" : n.label === "Configurações" ? "Ajustes" : n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center">
      <p className="font-display text-xl font-bold uppercase">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export { Button };
