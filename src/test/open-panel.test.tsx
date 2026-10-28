import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/AppShell";

const state = vi.hoisted(() => ({ loaded: true, access: "barber", error: "", settings: { shopName: "Barbearia" }, tv: { connected: false } }));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: () => "/",
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/lib/store", () => ({
  useStore: (select: (value: typeof state) => unknown) => select(state),
  useAutoCompleteBookings: vi.fn(), exportBrowserBackup: vi.fn(), refreshStore: vi.fn(),
}));
afterEach(cleanup);
describe("painel sem login", () => {
  it("exibe o painel carregado sem formulário de senha nem botão Sair", () => {
    state.access = "barber";
    render(<AppShell title="Hoje"><p>Agenda carregada</p></AppShell>);
    expect(screen.getByText("Agenda carregada")).toBeInTheDocument();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    expect(screen.queryByText("Sair")).not.toBeInTheDocument();
  });
  it("uma falha de conexão não exibe login nem conteúdo administrativo vazio", () => {
    state.access = "";
    state.error = "Falha na conexão";
    render(<AppShell title="Hoje"><p>Agenda carregada</p></AppShell>);
    expect(screen.getByRole("status")).toHaveTextContent("Falha na conexão");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(screen.queryByText("Agenda carregada")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
  });
});
