import { describe,expect,it } from "vitest";
import { normalizePhone,shopNow,validServiceDuration,validHours } from "@/lib/domain";
import { adjustmentError,bookingDuration,endOf,isBlocked,serviceNames,uid,type Booking,type State } from "@/lib/store";

const state: State = {
  loaded:true,services:[{id:"corte",name:"Novo nome",duration:60,price:50}],bookings:[],
  settings:{shopName:"Teste",open:"09:00",close:"19:00",workDays:[1,2,3,4,5,6],breakStart:"12:00",breakEnd:"13:00",slot:30,showFreeOnTv:true,tvClientInfo:"first",sound:false,vacations:[],vacationMessage:""},
  tv:{code:null,expires:0,connected:false},blacklist:[],adjusts:[],updatedAt:0,
};
const booking: Booking={id:"b",client:"Cliente",phone:"5531999999999",serviceId:"corte",date:"2026-11-02",start:"10:00",status:"confirmada",createdAt:0,
  serviceSnapshots:[{id:"corte",name:"Corte original",duration:30,price:35}]};

describe("segurança dos contratos",()=>{
  it("normaliza telefone sem duplicar DDI e rejeita contato incompleto",()=>{
    expect(normalizePhone("(31) 99999-9999")).toBe("5531999999999");
    expect(normalizePhone("+55 31 99999-9999")).toBe("5531999999999");
    expect(normalizePhone("9999-9999")).toBeNull();
  });
  it("não bloqueia pessoa de outro DDD com o mesmo sufixo",()=>{
    const s={...state,blacklist:[{id:"x",phone:"5531999999999",createdAt:0}]};
    expect(isBlocked(s,"(11) 99999-9999")).toBeUndefined();
    expect(isBlocked(s,"(31) 99999-9999")?.id).toBe("x");
  });
  it("preserva nome, duração e preço contratados após editar o catálogo",()=>{
    expect(bookingDuration(booking,state.services)).toBe(30);
    expect(endOf(booking,state.services)).toBe("10:30");
    expect(serviceNames(booking,state.services)).toBe("Corte original");
    expect(booking.serviceSnapshots?.[0]?.price).toBe(35);
  });
  it("mantém 45 minutos de pigmentação como duração válida",()=>{
    expect(validServiceDuration("45")).toBe(45);
    expect(validServiceDuration("20")).toBeNull();
    expect(validServiceDuration("495")).toBeNull();
  });
  it("usa a data e hora de São Paulo mesmo próximo da virada UTC",()=>{
    const d=shopNow(new Date("2026-10-29T01:30:00Z"));
    expect([d.getFullYear(),d.getMonth()+1,d.getDate(),d.getHours(),d.getMinutes()]).toEqual([2026,10,28,22,30]);
  });
  it("rejeita ajustes que cruzam o dia ou outra reserva",()=>{
    expect(adjustmentError({...state,bookings:[{...booking,shift:-601}]})).toContain("dia");
    expect(adjustmentError({...state,bookings:[booking,{...booking,id:"c",start:"10:15"}]})).toContain("conflita");
    expect(adjustmentError({...state,bookings:[booking,{...booking,id:"c",start:"10:30"}]})).toBeNull();
  });
  it("valida o conjunto dos horários, incluindo ausência de pausa",()=>{
    expect(validHours("09:00","19:00","12:00","13:00")).toBe(true);
    expect(validHours("09:00","19:00","","")).toBe(true);
    expect(validHours("09:00","19:00","13:00","12:00")).toBe(false);
    expect(validHours("20:00","19:00","","")).toBe(false);
  });
  it("gera novos IDs UUID sem alterar IDs históricos",()=>{
    expect(uid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(state.services[0]?.id).toBe("corte");
  });
});
