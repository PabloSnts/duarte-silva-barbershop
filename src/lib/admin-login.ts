// Login aliases only. Permissions are checked by the API's private allowlist;
// changing this mapping never grants access or replaces password verification.
const accounts: Readonly<Record<string, string>> = {
  "pablo santos": "pablohenrique1910@live.com",
  elias: "barbeariaduartesilva@gmail.com",
};

export const invalidLoginMessage = "Usuário ou senha inválidos.";

export function adminEmail(username: string): string | undefined {
  const normalized = username.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
  return Object.hasOwn(accounts, normalized) ? accounts[normalized] : undefined;
}
