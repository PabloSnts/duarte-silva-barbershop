import type { State } from "./store";

// Publishable key: safe for browsers. Privileged keys exist only in Edge secrets.
const url = import.meta.env["VITE_SUPABASE_URL"] || "https://rncocekcfjybpaujgqbs.supabase.co";
const publishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || "sb_publishable_0jgZyVhX-XGqHTCWkZ8SUw_8bFnJ0kp";
export type RemoteSnapshot = { state: State; revision: string };
const tvKey = "barbearia-tv-session-v1";
export async function api<T = RemoteSnapshot>(action: string, payload: unknown = {}, revision?: string): Promise<T> {
  const headers: Record<string,string> = { "Content-Type":"application/json", apikey:publishableKey };
  const tv = localStorage.getItem(tvKey);
  if (tv && window.location.pathname === "/painel-tv") headers["x-tv-session"] = tv;
  const response = await fetch(url + "/functions/v1/barbershop",{
    method:"POST",headers,body:JSON.stringify({action,payload,revision}),signal:AbortSignal.timeout(20000),
  });
  const data = await response.json() as T & {error?: string};
  if (!response.ok) {
    const error = new Error(data.error || "Não foi possível conectar. Tente novamente.");
    Object.assign(error,{status:response.status});
    throw error;
  }
  return data;
}
export function saveTvToken(token: string) { localStorage.setItem(tvKey,token); }
export function clearTvToken() { localStorage.removeItem(tvKey); }
