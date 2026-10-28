import { act,cleanup,renderHook } from "@testing-library/react";
import { afterEach,expect,it,vi } from "vitest";
import type { State } from "@/lib/store";

const transport=vi.hoisted(()=>({api:vi.fn(),auth:vi.fn()}));
vi.mock("@/lib/remote",()=>({api:transport.api,getAuthClient:()=>({auth:{onAuthStateChange:transport.auth,getSession:async()=>({data:{session:{access_token:"t"}}})}}),saveTvToken:vi.fn()}));
const initial: State={loaded:true,access:"barber",services:[],bookings:[],blacklist:[],adjusts:[],updatedAt:1,
  tv:{code:null,expires:0,connected:false},settings:{shopName:"Antes",open:"09:00",close:"19:00",workDays:[1],breakStart:"",breakEnd:"",slot:30,showFreeOnTv:true,tvClientInfo:"first",sound:false,vacations:[],vacationMessage:""}};
type Snapshot={state:State;revision:string};
function deferred() {
  let resolve!: (s:Snapshot)=>void;
  const promise=new Promise<Snapshot>((done)=>{resolve=done;});
  return {promise,resolve};
}
afterEach(()=>{cleanup();vi.clearAllTimers();vi.useRealTimers();vi.resetModules();vi.clearAllMocks();});

it("uma leitura atrasada não sobrescreve a gravação já confirmada",async()=>{
  vi.useFakeTimers();
  window.history.replaceState(null,"","/");
  transport.api.mockResolvedValueOnce({state:initial,revision:"r1"});
  const store=await import("@/lib/store");
  const view=renderHook(()=>store.useStore((s)=>s.settings.shopName));
  await act(async()=>{await Promise.resolve();});
  expect(view.result.current).toBe("Antes");
  const poll=deferred(); const write=deferred();
  transport.api.mockImplementationOnce(()=>poll.promise).mockImplementationOnce(()=>write.promise);
  let polling!:Promise<void>; let writing!:Promise<boolean>;
  act(()=>{polling=store.refreshStore();});
  await act(async()=>{writing=store.setState((s)=>({settings:{...s.settings,shopName:"Depois"}}));await Promise.resolve();});
  const updated={...initial,settings:{...initial.settings,shopName:"Depois"},updatedAt:2};
  await act(async()=>{write.resolve({state:updated,revision:"r2"});expect(await writing).toBe(true);});
  expect(view.result.current).toBe("Depois");
  await act(async()=>{poll.resolve({state:initial,revision:"r1"});await polling;});
  expect(view.result.current).toBe("Depois");
  expect(transport.api.mock.calls[2]?.[0]).toBe("patch");
});
