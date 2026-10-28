export type Environment = { url: string; secret: string; fetcher?: typeof fetch };
type Snapshot = { state: { loaded: boolean; services: any[]; bookings: any[]; settings: any; tv: any; blacklist: any[]; adjusts: any[]; updatedAt: number; access?: string }; revision: string };
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-tv-session, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
class ApiError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
const hash = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))), (b) => b.toString(16).padStart(2,"0")).join("");
const dateKey = () => new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

/** No service credential or database error details ever leave this boundary. */
export function createHandler(env: Environment) {
  const send = env.fetcher ?? fetch;
  async function rpc<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const response = await send(env.url + "/rest/v1/rpc/" + name, {
      method: "POST", headers: { apikey: env.secret, Authorization: "Bearer " + env.secret, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { code?: string };
      if (error.code === "40001") throw new ApiError("A agenda mudou em outro aparelho. Atualize e tente novamente.",409);
      if (error.code === "23P01") throw new ApiError("Esse horário não está mais disponível.",409);
      throw new ApiError("Não foi possível salvar. Confira os dados, o expediente e os serviços.",400);
    }
    return response.status === 204 ? null as T : response.json() as Promise<T>;
  }
  async function limit(name: string, max: number) {
    if (!await rpc<boolean>("barbershop_rate_limit",{p_bucket:name,p_limit:max})) throw new ApiError("Muitas tentativas. Aguarde um minuto.",429);
  }
  async function isTv(request: Request): Promise<boolean> {
    const token = request.headers.get("x-tv-session");
    return !!token && token.length <= 256 && await rpc<boolean>("barbershop_tv_allowed",{p_hash:await hash(token)});
  }
  function project(snapshot: Snapshot, role: "barber" | "tv" | "public"): Snapshot {
    if (role === "barber") return { ...snapshot, state: {...snapshot.state,tv:{code:null,...snapshot.state.tv},access:role} };
    const s = snapshot.state;
    const bookings = s.bookings.filter((b) => role !== "public" || b.status !== "cancelada").map((b, i) => {
      const name = role === "public" || s.settings.tvClientInfo === "none" ? "Cliente" :
        s.settings.tvClientInfo === "initials" ? b.client.trim().split(/\s+/).map((p: string) => p[0] + ".").join(" ") : b.client.trim().split(/\s+/)[0];
      if (role === "public") return {
        id:"busy-"+i,client:"Cliente",phone:"",date:b.date,start:b.start,shift:b.shift,
        status:"confirmada",createdAt:0,serviceId:"busy",serviceIds:["busy"],
        serviceSnapshots:[{id:"busy",name:"Ocupado",duration:b.serviceSnapshots.reduce((n: number,x: any)=>n+x.duration,0),price:0}],
      };
      return { ...b, client:name,phone:"",notes:"",clientId:undefined,createdAt:0,
        serviceSnapshots:b.serviceSnapshots.map((x: any)=>({...x,price:0})) };
    });
    return {revision: role === "public" ? "" : snapshot.revision, state:{
      ...s, services:s.services.filter((x: any) => x.active !== false),
      bookings,blacklist:[],adjusts:[],tv:{code:null,expires:0,connected:role==="tv"},access:role,
    }};
  }
  return async function handle(request: Request): Promise<Response> {
    const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data),{ status, headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"} });
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers:cors});
    if (request.method !== "POST") return reply({error:"Método não permitido"},405);
    try {
      const text = await request.text();
      if (text.length > 1_000_000) throw new ApiError("Solicitação muito grande",413);
      let body: {action?: string; payload?: any; revision?: string};
      try { body = JSON.parse(text); } catch { throw new ApiError("Solicitação inválida"); }
      if (!body || typeof body !== "object") throw new ApiError("Solicitação inválida");
      const action = body.action;
      const payload = body.payload ?? {};
      if (action === "catalog") {
        await limit("catalog",240);
        return reply(project(await rpc<Snapshot>("barbershop_snapshot"),"public"));
      }
      if (action === "pair") {
        await limit("pair",20);
        if (typeof payload.code !== "string" || !/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(payload.code.trim().toUpperCase())) throw new ApiError("Código inválido ou expirado");
        const token = crypto.randomUUID() + crypto.randomUUID();
        const ok = await rpc<boolean>("barbershop_pair_tv",{p_code_hash:await hash(payload.code.trim().toUpperCase()),p_token_hash:await hash(token)});
        if (!ok) throw new ApiError("Código inválido ou expirado");
        return reply({token});
      }
      if (action === "book") {
        await limit("book",30);
        // Public bookings can only create a confirmed reservation. Never trust id,
        // status, shift, prices, duration or snapshots supplied by a customer.
        const b = payload.booking;
        if (!b || typeof b !== "object") throw new ApiError("Reserva inválida");
        const booking = {client:b.client,phone:b.phone,date:b.date,start:b.start,serviceIds:b.serviceIds,notes:""};
        const saved = await rpc("barbershop_save_booking",{p_booking:booking});
        return reply({booking:saved});
      }
      // The owner explicitly chose an open administrative panel: no login or
      // Auth allowlist is required for administrative API operations.
      // A paired TV still uses its reduced projection and restricted actions.
      const hasTvToken = request.headers.has("x-tv-session");
      const tv = hasTvToken && await isTv(request);
      if (hasTvToken && !tv) throw new ApiError("Conecte esta TV novamente.",401);
      const barber = !hasTvToken;
      await limit("panel",480);
      if (action === "snapshot") {
        await limit("snapshot",480);
        await rpc("barbershop_complete_elapsed");
        return reply(project(await rpc<Snapshot>("barbershop_snapshot"),barber ? "barber" : "tv"));
      }
      if (action === "absent" && tv) {
        const snapshot = await rpc<Snapshot>("barbershop_snapshot");
        const booking = snapshot.state.bookings.find((b: any) => b.id===payload.id && b.date===dateKey() && ["confirmada","concluida"].includes(b.status));
        if (!booking) throw new ApiError("Atendimento indisponível");
        // Same CAS transaction as the barber; never allow a TV to patch other data.
        const changes = {bookings:snapshot.state.bookings.map((b: any) => b.id===payload.id ? {...b,status:"ausente"} : b)};
        return reply(project(await rpc<Snapshot>("barbershop_patch",{p_changes:changes,p_revision:snapshot.revision}),"tv"));
      }
      if (!barber) throw new ApiError("Esta ação é exclusiva do barbeiro.",403);
      if (action === "patch") {
        if (!payload.changes || typeof payload.changes !== "object" || typeof body.revision !== "string") throw new ApiError("Alteração inválida");
        return reply(project(await rpc<Snapshot>("barbershop_patch",{p_changes:payload.changes,p_revision:body.revision}),"barber"));
      }
      if (action === "pair-code") {
        const bytes=crypto.getRandomValues(new Uint8Array(6));
        const code=Array.from(bytes,x=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x%32]).join("");
        await rpc("barbershop_pair_code",{p_hash:await hash(code)});
        return reply({code,expires:Date.now()+600000});
      }
      if (action === "disconnect-tv") {
        await rpc("barbershop_disconnect_tv");
        return reply(project(await rpc<Snapshot>("barbershop_snapshot"),"barber"));
      }
      throw new ApiError("Ação inválida");
    } catch (error) {
      if (error instanceof ApiError) return reply({error:error.message},error.status);
      return reply({error:"Não foi possível concluir a solicitação."},500);
    }
  };
}
