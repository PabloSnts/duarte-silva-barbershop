import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

// Public key only. Do not accept or print service credentials in this check.
const config = await readFile(new URL("../src/lib/remote.ts",import.meta.url),"utf8");
const key = config.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
assert.ok(key,"Missing publishable configuration");
const url = "https://rncocekcfjybpaujgqbs.supabase.co";
async function request(action,payload={}) {
  const r = await fetch(url+"/functions/v1/barbershop",{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify({action,payload}),signal:AbortSignal.timeout(20000)});
  return {status:r.status,data:await r.json()};
}
const catalog = await request("catalog");
assert.equal(catalog.status,200,JSON.stringify({status:catalog.status,error:catalog.data.error}));
assert.equal(catalog.data.state.access,"public");
assert.equal(catalog.data.state.blacklist.length,0);
assert.equal(catalog.data.state.adjusts.length,0);
assert.ok(catalog.data.state.services.length>=4);
for (const b of catalog.data.state.bookings) {
  assert.equal(b.phone,""); assert.equal(b.client,"Cliente"); assert.ok(!b.clientId); assert.ok(!b.notes);
  assert.ok(b.id.startsWith("busy-"));
}
for (const action of ["snapshot","patch","pair-code","disconnect-tv"]) {
  assert.equal((await request(action)).status,401,action+" unexpectedly allowed");
}
assert.equal((await request("book",{booking:{}})).status,400);
for (const path of ["/rest/v1/bookings?select=id","/rest/v1/rpc/barbershop_snapshot"]) {
  const r=await fetch(url+path,{headers:{apikey:key},signal:AbortSignal.timeout(20000)});
  assert.ok([401,403,404].includes(r.status),"Direct data access unexpectedly allowed");
}
console.log("PASS: live catalogue, private actions denied, invalid booking rejected, direct tables/RPC protected.");
