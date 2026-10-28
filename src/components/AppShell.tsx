import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Ban, CalendarClock, CalendarDays, CalendarPlus, LayoutDashboard, ListChecks, Menu, Scissors, Settings, Tv, Users } from "lucide-react";
import { exportBrowserBackup, useAutoCompleteBookings, useStore } from "@/lib/store";
import { getAuthClient } from "@/lib/remote";
import { LoginPanel } from "./LoginPanel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

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

const mobileNav = [nav[0], nav[1], nav[2], nav[7]];

export function AppShell({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const shop = useStore((s) => s.settings.shopName);
  const access = useStore((s) => s.access);
  const loaded = useStore((s) => s.loaded);
  const connectionError = useStore((s) => s.error);
  const tvOn = useStore((s) => s.tv.connected);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuActive = !mobileNav.some((item) => item.to === "/" ? path === "/" : path.startsWith(item.to));
  useAutoCompleteBookings();

  if (!loaded) return <main className="grid min-h-dvh place-items-center bg-background" role="status">Carregando agenda…</main>;
  if (access !== "barber") return <LoginPanel error={connectionError} />;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="hidden border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-6 py-6">
          <img
            src="/duarte-silva-logo.webp"
            alt="Logo Duarte & Silva Barbearia"
            width={190}
            height={81}
            className="h-11 w-[74px] shrink-0 object-contain"
          />
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

      <div className="flex min-w-0 flex-col pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <div className="flex flex-wrap justify-end gap-4 px-4 pt-2 text-xs text-muted-foreground">
          <button onClick={exportBrowserBackup} className="underline">Exportar dados antigos deste aparelho</button>
          <button onClick={()=>void getAuthClient().auth.signOut()} className="underline">Sair</button>
        </div>
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-5 md:px-8 md:py-7">
          <h1 className="truncate text-3xl font-bold uppercase md:text-4xl">{title}</h1>
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        </header>
        <main className="flex-1 px-4 pb-8 md:px-8">{children}</main>
      </div>

      {/* Atalhos principais e menu completo no celular e tablet. */}
      <nav aria-label="Navegação principal mobile"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {mobileNav.map((n) => {
          const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-3 text-[10px] font-medium transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <n.icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{n.label === "Visualização na TV" ? "TV" : n.label}</span>
            </Link>
          );
        })}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <button type="button" aria-label="Abrir todas as guias" aria-expanded={mobileMenuOpen}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-3 text-[10px] font-medium transition-colors ${menuActive || mobileMenuOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Menu className="h-5 w-5 shrink-0" />
              <span>Menu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="flex h-dvh w-[min(90vw,360px)] flex-col overflow-hidden border-sidebar-border bg-sidebar p-0">
            <SheetHeader className="shrink-0 border-b border-sidebar-border px-5 py-6 text-left">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src="/duarte-silva-logo.webp"
                  alt="Logo Duarte & Silva Barbearia"
                  width={190}
                  height={81}
                  className="h-12 w-24 shrink-0 object-contain"
                />
                <SheetTitle className="min-w-0 truncate font-display text-xl font-bold uppercase">{shop}</SheetTitle>
              </div>
              <SheetDescription>Todas as guias do sistema</SheetDescription>
            </SheetHeader>
            <nav aria-label="Todas as guias" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {nav.map((item) => {
                const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
                return (
                  <Link key={item.to} to={item.to} aria-current={active ? "page" : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex min-h-11 items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${active ? "bg-primary/15 text-primary" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground"}`}>
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1">{item.label}</span>
                    {active && <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
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
