import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminEmail, invalidLoginMessage } from "@/lib/admin-login";
import { LoginPanel } from "@/components/LoginPanel";

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/remote", () => ({ getAuthClient: () => ({ auth: { signInWithPassword: mocks.signIn } }) }));
vi.mock("@/lib/store", () => ({ exportBrowserBackup: vi.fn(), refreshStore: mocks.refresh }));

afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

function submit(username: string) {
  render(<LoginPanel />);
  fireEvent.change(screen.getByLabelText("Usuário"), { target: { value: username } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "test-only-credential" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("login administrativo por usuário", () => {
  it("resolve os nomes aprovados e rejeita propriedades herdadas e e-mail direto", () => {
    expect(adminEmail("  PABLO   SANTOS  ")).toBe("pablohenrique1910@live.com");
    expect(adminEmail("Elias")).toBe("barbeariaduartesilva@gmail.com");
    for (const value of ["constructor", "__proto__", "someone", "pablohenrique1910@live.com"]) {
      expect(adminEmail(value)).toBeUndefined();
    }
  });

  it("exige sessão real antes de carregar o painel e limpa a senha", async () => {
    mocks.signIn.mockResolvedValue({ data: { session: { access_token: "test-session" } }, error: null });
    submit("Pablo Santos");
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledWith(true));
    expect(mocks.signIn).toHaveBeenCalledWith({ email: "pablohenrique1910@live.com", password: "test-only-credential" });
    expect(screen.getByLabelText("Senha")).toHaveValue("");
    expect(screen.queryByText(/Primeiro acesso/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("E-mail")).not.toBeInTheDocument();
  });

  it("não carrega dados privados quando o servidor rejeita a senha", async () => {
    mocks.signIn.mockResolvedValue({ data: { session: null }, error: { message: "Internal provider detail" } });
    submit("Elias");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(invalidLoginMessage));
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Senha")).toHaveValue("");
    expect(screen.queryByText("Internal provider detail")).not.toBeInTheDocument();
  });

  it("não autentica um nome desconhecido", async () => {
    submit("Outro usuário");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(invalidLoginMessage));
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
