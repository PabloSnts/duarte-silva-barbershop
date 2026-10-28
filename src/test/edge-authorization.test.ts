import { describe,expect,it,vi } from "vitest";
import { createHandler } from "../../supabase/functions/barbershop/handler";

const secret="server-only-sentinel";
const snapshot={revision:"revision",state:{loaded:true,services:[{id:"corte",active:true}],
  bookings:[{id:"private-booking-id",client:"João Silva",phone:"5531999999999",clientId:"private-client",notes:"private-note",createdAt:123,date:"2026-11-02",start:"09:00",shift:0,status:"confirmada",serviceId:"corte",serviceIds:["corte"],serviceSnapshots:[{id:"corte",name:"Corte",duration:30,price:123}]}],
  settings:{tvClientInfo:"first"},tv:{connected:true},blacklist:[{phone:"private-blocked"}],adjusts:[{id:"private-adjustment"}],updatedAt:1}};
function setup(overrides:Record<string,unknown>={}) {
  const calls: {name:string;args:Record<string,unknown>}[]=[];
  const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=String(input);
    if(url.endsWith("/auth/v1/user")) return new Response(JSON.stringify(overrides["authUser"] ?? {email:"someone@example.invalid",email_confirmed_at:"2026-01-01",user_metadata:{role:"barber"}}));
    const name=url.split("/").at(-1)!;
    const args=JSON.parse(String(init?.body)) as Record<string,unknown>;
    calls.push({name,args});
    const defaults:Record<string,unknown>={barbershop_rate_limit:true,barbershop_snapshot:snapshot,barbershop_allowed:false,barbershop_tv_allowed:false,barbershop_complete_elapsed:0,barbershop_save_booking:{id:"saved",status:"confirmada"}};
    return new Response(JSON.stringify(name in overrides ? overrides[name] : defaults[name]));
  }) as typeof fetch;
  const handle=createHandler({url:"https://example.invalid",secret,fetcher});
  const request=(action:string,payload:unknown={},headers:Record<string,string>={},revision?:string)=>handle(new Request("https://example.invalid/api",{method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify({action,payload,revision})}));
  return {request,calls,handle};
}
describe("autorização da API",()=>{
  it("permite atualização com identidade confirmada, autorizada e revisão correta",async()=>{
    const {request,calls}=setup({barbershop_allowed:true,barbershop_patch:snapshot});
    const response=await request("patch",{changes:{services:[]}}, {Authorization:"Bearer verified-session"},"revision");
    expect(response.status).toBe(200);
    expect((await response.json()).state.access).toBe("barber");
    expect(calls.find((c)=>c.name==="barbershop_patch")?.args).toEqual({p_changes:{services:[]},p_revision:"revision"});
  });
  it("rejeita conta com e-mail ainda não confirmado",async()=>{
    const {request,calls}=setup({authUser:{email:"someone@example.invalid"},barbershop_allowed:true});
    expect((await request("patch",{}, {Authorization:"Bearer unconfirmed-session"})).status).toBe(401);
    expect(calls.some((c)=>c.name==="barbershop_patch")).toBe(false);
  });
  it("não oferece ações do barbeiro a visitante",async()=>{
    const {request,calls}=setup();
    for(const action of ["snapshot","patch","pair-code","disconnect-tv"]) expect((await request(action)).status).toBe(401);
    expect(calls).toHaveLength(0);
  });
  it("ignora user_metadata e exige a lista autorizada no servidor",async()=>{
    const {request,calls}=setup();
    expect((await request("patch",{}, {Authorization:"Bearer fake-session"})).status).toBe(401);
    expect(calls.find((c)=>c.name==="barbershop_allowed")?.args).toEqual({p_email:"someone@example.invalid"});
    expect(calls.some((c)=>c.name==="barbershop_patch")).toBe(false);
  });
  it("catálogo público só contém intervalos ocupados sem PII nem preços históricos",async()=>{
    const {request}=setup();
    const r=await request("catalog"); expect(r.status).toBe(200);
    const text=await r.text();
    for(const privateValue of ["João","5531999999999","private-booking-id","private-client","private-note","private-blocked","private-adjustment",secret]) expect(text).not.toContain(privateValue);
    const body=JSON.parse(text);
    expect(body.state.bookings[0].serviceSnapshots[0]).toEqual({id:"busy",name:"Ocupado",duration:30,price:0});
  });
  it("TV não pode atualizar configurações, serviços ou reservas via patch",async()=>{
    const {request,calls}=setup({barbershop_tv_allowed:true});
    expect((await request("patch",{changes:{services:[]}}, {"x-tv-session":"device-session"})).status).toBe(403);
    expect(calls.some((c)=>c.name==="barbershop_patch")).toBe(false);
  });
  it("TV recebe o nome reduzido, sem telefone, notas, cliente ou preço histórico",async()=>{
    const {request}=setup({barbershop_tv_allowed:true});
    const r=await request("snapshot",{}, {"x-tv-session":"device-session"});
    expect(r.status).toBe(200);
    const body=await r.json();
    expect(body.state.bookings[0].client).toBe("João");
    expect(body.state.bookings[0].phone).toBe("");
    expect(body.state.bookings[0].notes).toBe("");
    expect(body.state.bookings[0].clientId).toBeUndefined();
    expect(body.state.bookings[0].serviceSnapshots[0].price).toBe(0);
  });
  it("agendamento público não controla ID, status, deslocamento ou preço",async()=>{
    const {request,calls}=setup();
    const response=await request("book",{booking:{id:"overwrite-id",client:"Cliente",phone:"31999999999",date:"2026-11-02",start:"09:00",serviceIds:["corte"],status:"concluida",shift:100,price:0,notes:"injected"}});
    expect(response.status).toBe(200);
    expect(calls.find((c)=>c.name==="barbershop_save_booking")?.args).toEqual({p_booking:{client:"Cliente",phone:"31999999999",date:"2026-11-02",start:"09:00",serviceIds:["corte"],notes:""}});
  });
  it("limita tentativas sem revelar detalhes internos",async()=>{
    const {request}=setup({barbershop_rate_limit:false});
    const response=await request("pair",{code:"ABCDEF"});
    expect(response.status).toBe(429);
    expect(await response.text()).not.toContain(secret);
  });
  it("rejeita método inesperado e atende CORS sem cookies",async()=>{
    const {handle}=setup();
    expect((await handle(new Request("https://example.invalid"))).status).toBe(405);
    const r=await handle(new Request("https://example.invalid",{method:"OPTIONS"}));
    expect(r.status).toBe(204); expect(r.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });
});
